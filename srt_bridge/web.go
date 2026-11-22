package main

import (
	"embed"
	"encoding/json"
	"errors"
	"io/fs"
	"net"
	"net/http"
	"strings"

	qrcode "github.com/skip2/go-qrcode"
)

//go:embed web
var webFiles embed.FS

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(v)
}

func readBody(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(v); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return false
	}
	return true
}

// sameOrigin keeps other web pages in a browser on this PC from changing the
// bridge: a change must come from the interface itself.
func sameOrigin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			scheme := "http://"
			if r.TLS != nil {
				scheme = "https://"
			}
			if o := r.Header.Get("Origin"); o != "" && o != scheme+r.Host {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			if r.Header.Get("Content-Type") != "application/json" {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
		}
		next(w, r)
	}
}

// newWebServer is the interface. rm and out may be nil (tests): then there is
// no remote access and no Bridge Output.
func newWebServer(h *Hub, rm *Remote, out *Output, wp *Whip) http.Handler {
	mux := http.NewServeMux()
	static, _ := fs.Sub(webFiles, "web")
	mux.Handle("GET /", http.FileServerFS(static))
	mux.Handle("GET /metrics", handleMetrics(h))

	// full is the state of the hub plus what lives outside it; every answer
	// to a change carries it, so the page never draws half a state.
	var autostart statusCache[AutostartState]
	full := func(r *http.Request) *State {
		st := h.state()
		if rm != nil {
			st.Remote = rm.status(r)
		}
		if out != nil {
			st.Output = out.status()
		}
		as := autostart.get("", autostartState)
		st.Autostart = &as
		if wp != nil && st.Whip != nil {
			st.Whip.Program = wp.status()
		}
		st.ShutdownAt = shutdownAt()
		return st
	}
	// answer is the reply to a change: the new state, or the reason why nothing changed.
	answer := func(w http.ResponseWriter, r *http.Request, err error) {
		if err != nil {
			w.Header().Set("Content-Type", "application/json; charset=utf-8")
			status := http.StatusBadRequest
			if errors.Is(err, errConfigSave) {
				status = http.StatusInternalServerError
			}
			w.WriteHeader(status)
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, full(r))
	}

	mux.HandleFunc("GET /api/state", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, full(r))
	})
	// Start with Windows (for the user the bridge runs as).
	mux.HandleFunc("PUT /api/autostart", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			On bool `json:"on"`
		}
		if !readBody(w, r, &in) {
			return
		}
		err := setAutostart(in.On)
		if err == nil {
			autostart.invalidate()
			h.note("start with Windows %s", map[bool]string{true: "on", false: "off"}[in.On])
		}
		answer(w, r, err)
	}))
	// Shut down this computer (with a countdown that can be cancelled), also over remote access.
	mux.HandleFunc("POST /api/shutdown", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		err := requestShutdown()
		if err == nil {
			h.note("shutdown of this computer asked for (%s), in %d s", map[bool]string{true: "over remote access", false: "on this PC"}[isRemote(r)], int(shutdownDelay.Seconds()))
		}
		answer(w, r, err)
	}))
	mux.HandleFunc("POST /api/shutdown/cancel", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		err := cancelShutdown()
		if err == nil {
			h.note("shutdown of this computer cancelled")
		}
		answer(w, r, err)
	}))
	// Bridge Output: start, stop, its settings per signal, and where it is.
	mux.HandleFunc("POST /api/output/start", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		if out == nil {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		err := out.start()
		if err != nil {
			out.setErr(err.Error())
		}
		answer(w, r, err)
	}))
	mux.HandleFunc("POST /api/output/stop", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		if out == nil {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		err := out.stop()
		if err == nil {
			out.poll()
		}
		answer(w, r, err)
	}))
	mux.HandleFunc("PUT /api/output/out", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Slot int    `json:"slot"`
			Out  string `json:"out"`
			Name string `json:"name"`
		}
		if !readBody(w, r, &in) {
			return
		}
		if out == nil {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		body, _ := json.Marshal(in)
		answer(w, r, out.setOut(body))
	}))
	mux.HandleFunc("PUT /api/output/settings", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in OutputSettings
		if !readBody(w, r, &in) {
			return
		}
		// Which program the bridge starts is set on the bridge PC only: from
		// outside it would be a way to run any program there.
		if isRemote(r) && strings.TrimSpace(in.Path) != h.outputPath() {
			answer(w, r, errors.New("the program path can only be changed on the bridge PC itself"))
			return
		}
		answer(w, r, h.updateOutputSettings(in))
	}))
	// Remote access: on/off, password, API token. Only on the bridge PC (remote.go refuses it over HTTPS).
	mux.HandleFunc("PUT /api/remote", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in RemoteUpdate
		if !readBody(w, r, &in) {
			return
		}
		if rm == nil || isRemote(r) {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		if err := h.updateRemote(in); err != nil {
			answer(w, r, err)
			return
		}
		if in.Password != nil {
			rm.endSessions()
		}
		rm.sync()
		writeJSON(w, full(r))
	}))
	// QR code of a link, as a PNG. The link comes in the body, not in the
	// address: it can contain a passphrase.
	mux.HandleFunc("POST /api/qr", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Text string `json:"text"`
		}
		if !readBody(w, r, &in) {
			return
		}
		if in.Text == "" || len(in.Text) > 1200 {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		png, err := qrcode.Encode(in.Text, qrcode.Medium, 420)
		if err != nil {
			http.Error(w, "the link is too long for a QR code", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "no-store")
		w.Write(png)
	}))
	// A program on this PC (SRT Bridge Output) asks for the inputs as plain UDP on 127.0.0.1.
	mux.HandleFunc("POST /api/taps", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Taps map[int]int `json:"taps"` // signal number -> UDP port
		}
		if !readBody(w, r, &in) {
			return
		}
		if err := h.setTaps(in.Taps); err != nil {
			answer(w, r, err)
			return
		}
		writeJSON(w, map[string]bool{"ok": true})
	}))
	// WHIP input: its settings, and disconnecting the sender.
	mux.HandleFunc("PUT /api/whip", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in WhipUpdate
		if !readBody(w, r, &in) {
			return
		}
		// Which program the bridge starts is set on the bridge PC only (as for Bridge Output).
		if isRemote(r) && in.Path != nil && strings.TrimSpace(*in.Path) != h.whipPath() {
			answer(w, r, errors.New("the program path can only be changed on the bridge PC itself"))
			return
		}
		restart, err := h.updateWhip(in)
		if err == nil && restart && wp != nil {
			wp.restart()
		}
		answer(w, r, err)
	}))
	mux.HandleFunc("POST /api/whip/disconnect", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		if wp == nil {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		err := wp.disconnect()
		if err == nil {
			h.note("WHIP input: sender disconnected by hand")
		}
		answer(w, r, err)
	}))
	mux.HandleFunc("POST /api/places", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			ID string `json:"id"`
		}
		if readBody(w, r, &in) {
			answer(w, r, h.addPlace(in.ID))
		}
	}))
	mux.HandleFunc("PUT /api/places", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in PlaceUpdate
		if readBody(w, r, &in) {
			answer(w, r, h.updatePlace(in))
		}
	}))
	// Receiving the original with the sender key: allowed or switched off.
	mux.HandleFunc("PUT /api/original", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Allow bool `json:"allow"`
		}
		if readBody(w, r, &in) {
			answer(w, r, h.setOriginal(in.Allow))
		}
	}))
	mux.HandleFunc("POST /api/disconnect", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			Slot int `json:"slot"`
		}
		if readBody(w, r, &in) {
			answer(w, r, h.disconnectInput(in.Slot))
		}
	}))
	mux.HandleFunc("PUT /api/settings", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in SettingsUpdate
		if !readBody(w, r, &in) {
			return
		}
		// Over remote access the port must stay: it is the port of the viewer too.
		if port, mode := h.srtPortAndMode(); isRemote(r) && (in.SRTPort != port || (in.PortMode != "" && in.PortMode != mode)) {
			answer(w, r, errors.New("the port and the port mode can only be changed on the bridge PC itself"))
			return
		}
		err := h.updateSettings(in)
		if err == nil && rm != nil {
			rm.sync() // a new SRT port moves the HTTPS port with it
		}
		answer(w, r, err)
	}))
	// Internet access: the Windows Firewall rules and the public address for the links.
	webPort := func() int {
		if rm == nil {
			return 0
		}
		return rm.firewallPort()
	}
	mux.HandleFunc("GET /api/firewall", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, firewallState(h.portRange(), webPort(), h.whipFirewallPort()))
	})
	mux.HandleFunc("POST /api/firewall", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		if err := requestFirewallRule(h.portRange(), webPort(), h.whipFirewallPort()); err != nil {
			answer(w, r, err)
			return
		}
		writeJSON(w, map[string]string{"state": "confirmation_requested"})
	}))
	mux.HandleFunc("POST /api/public-ip/detect", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		ip, err := detectPublicIPv4()
		if err != nil {
			answer(w, r, err)
			return
		}
		writeJSON(w, map[string]string{"ip": ip})
	}))
	mux.HandleFunc("PUT /api/public-ip", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		var in struct {
			IP string `json:"ip"`
		}
		if readBody(w, r, &in) {
			answer(w, r, h.setPublicIP(in.IP))
		}
	}))
	mux.HandleFunc("DELETE /api/rejected", sameOrigin(func(w http.ResponseWriter, r *http.Request) {
		h.clearRejected()
		writeJSON(w, full(r))
	}))
	return mux
}

// listenWeb opens the port of the interface. The address that was really
// bound is returned, so ":0" works for tests.
func listenWeb(addr string) (net.Listener, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	if strings.EqualFold(host, "localhost") {
		host = "127.0.0.1"
	}
	if !net.ParseIP(host).IsLoopback() {
		return nil, errors.New("the local interface requires a loopback address; enable HTTPS remote access for network clients")
	}
	return net.Listen("tcp", net.JoinHostPort(host, port))
}
