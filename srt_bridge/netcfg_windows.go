package main

import (
	"crypto/rand"
	"encoding/binary"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
	"unsafe"
)

// The inbound rule of the bridge in the Windows Firewall. One rule, found by
// its name; it is replaced when the port changes.
const firewallRule = "SRT Bridge"

func system32(name string) string {
	root := os.Getenv("SystemRoot")
	if root == "" {
		root = `C:\Windows`
	}
	return filepath.Join(root, "System32", name)
}

// The second rule, for remote access: TCP on the number of the SRT port.
const firewallRuleWeb = "SRT Bridge (remote)"

// The third rule, for the WHIP input: TCP and UDP on its port.
const firewallRuleWhip = "SRT Bridge (WHIP)"

// showRule returns the output of netsh for one of our rules; nil = no such rule.
func showRule(name string) ([]byte, error) {
	cmd := exec.Command(system32("netsh.exe"), "advfirewall", "firewall", "show", "rule", "name="+name)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := cmd.Output()
	if err != nil {
		var exit *exec.ExitError
		if errors.As(err, &exit) { // exit code 1 just means: no such rule
			return nil, nil
		}
		return nil, err
	}
	return out, nil
}

// firewallState reads the rules. That needs no administrator rights. The
// output of netsh is translated by Windows, so only the name (given by us),
// the protocol and the port number are looked for.
func firewallState(ports string, webPort, whipPort int) FirewallState {
	st := FirewallState{Ports: ports, WebPort: webPort, WhipPort: whipPort}
	out, err := showRule(firewallRule)
	if err != nil {
		st.Detail = err.Error()
		return st
	}
	st.Rule = out != nil
	st.UDPMatch = out != nil && protocolUDP.Match(out) && ruleCovers(string(out), ports)
	if webPort > 0 {
		web, err := showRule(firewallRuleWeb)
		if err != nil {
			st.Detail = err.Error()
			return st
		}
		st.WebMatch = web != nil && protocolTCP.Match(web) && ruleCovers(string(web), strconv.Itoa(webPort))
	}
	if whipPort > 0 {
		// One rule cannot hold two protocols: netsh lists the two under the same name.
		whip, err := showRule(firewallRuleWhip)
		if err != nil {
			st.Detail = err.Error()
			return st
		}
		st.WhipMatch = whip != nil && protocolTCP.Match(whip) && protocolUDP.Match(whip) && ruleCovers(string(whip), strconv.Itoa(whipPort))
	}
	st.Match = st.UDPMatch && (webPort == 0 || st.WebMatch) && (whipPort == 0 || st.WhipMatch)
	return st
}

var (
	protocolUDP = regexp.MustCompile(`(?m):\s+UDP\s*$`)
	protocolTCP = regexp.MustCompile(`(?m):\s+TCP\s*$`)
)

var portListLine = regexp.MustCompile(`(?m):\s+(\d[\d,\- ]*?)\s*$`)

// ruleCovers says whether a port list in the output of netsh ("21101",
// "21101-21108", "21101,21105-21110") opens every port that is needed. A rule that
// opens more than needed counts as open: after switching back from a port per
// signal to one port, the wider rule still does the job.
func ruleCovers(out, need string) bool {
	lo, hi, ok := portSpan(need)
	if !ok {
		return false
	}
	for _, m := range portListLine.FindAllStringSubmatch(out, -1) {
		open := map[int]bool{}
		for _, part := range strings.Split(m[1], ",") {
			a, b, ok := portSpan(strings.TrimSpace(part))
			if !ok {
				continue
			}
			for p := max(a, lo); p <= min(b, hi); p++ {
				open[p] = true
			}
		}
		if len(open) == hi-lo+1 {
			return true
		}
	}
	return false
}

// portSpan reads "21101" or "21101-21108".
func portSpan(s string) (lo, hi int, ok bool) {
	a, b, isRange := strings.Cut(s, "-")
	lo, err := strconv.Atoi(strings.TrimSpace(a))
	if err != nil {
		return 0, 0, false
	}
	hi = lo
	if isRange {
		if hi, err = strconv.Atoi(strings.TrimSpace(b)); err != nil {
			return 0, 0, false
		}
	}
	return lo, hi, lo >= 1 && hi >= lo
}

// mainHwnd is the window of the interface; 0 when running headless.
var mainHwnd atomic.Uintptr

var (
	shell32           = syscall.NewLazyDLL("shell32.dll")
	procShellExecuteW = shell32.NewProc("ShellExecuteW")
)

// firewallCommand is the line for cmd /c: both rules are deleted and set
// again; the TCP rule for remote access only when it is on (webPort > 0),
// so switching remote access off and setting the rule again closes TCP.
func firewallCommand(netsh, ports string, webPort, whipPort int) string {
	cmd := fmt.Sprintf(`"%s" advfirewall firewall delete rule name="%s" & "%s" advfirewall firewall delete rule name="%s" & "%s" advfirewall firewall delete rule name="%s" & "%s" advfirewall firewall add rule name="%s" dir=in action=allow protocol=UDP localport=%s profile=any`,
		netsh, firewallRule, netsh, firewallRuleWeb, netsh, firewallRuleWhip, netsh, firewallRule, ports)
	if webPort > 0 {
		cmd += fmt.Sprintf(` & "%s" advfirewall firewall add rule name="%s" dir=in action=allow protocol=TCP localport=%d profile=any`,
			netsh, firewallRuleWeb, webPort)
	}
	if whipPort > 0 {
		for _, proto := range []string{"TCP", "UDP"} {
			cmd += fmt.Sprintf(` & "%s" advfirewall firewall add rule name="%s" dir=in action=allow protocol=%s localport=%d profile=any`,
				netsh, firewallRuleWhip, proto, whipPort)
		}
	}
	// The outer pair of quotes is needed: cmd /c strips the first and the last
	// quote of a line with more than two, which broke the command without them.
	return `/c "` + cmd + `"`
}

// requestFirewallRule asks Windows to set the rules. Windows shows its own
// confirmation (administrator); the user decides there. The call returns as
// soon as the confirmation is on screen or was refused.
func requestFirewallRule(ports string, webPort, whipPort int) error {
	args := firewallCommand(system32("netsh.exe"), ports, webPort, whipPort)
	verb, _ := syscall.UTF16PtrFromString("runas")
	file, _ := syscall.UTF16PtrFromString(system32("cmd.exe"))
	params, _ := syscall.UTF16PtrFromString(args)
	// With the window as owner the Windows confirmation comes to the front
	// instead of only blinking in the taskbar.
	r, _, _ := procShellExecuteW.Call(mainHwnd.Load(), uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(file)), uintptr(unsafe.Pointer(params)), 0, 0 /* SW_HIDE */)
	if r <= 32 {
		if r == 5 {
			return errors.New("the Windows confirmation was refused")
		}
		return fmt.Errorf("Windows could not start the confirmation (code %d)", r)
	}
	return nil
}

// detectPublicIPv4 asks a STUN server which address this site has on the
// internet (one binding request, RFC 5389), as FastVideo and FastIntercom do.
func detectPublicIPv4() (string, error) {
	conn, err := net.Dial("udp4", "stun.cloudflare.com:3478")
	if err != nil {
		return "", err
	}
	defer conn.Close()
	req := make([]byte, 20)
	binary.BigEndian.PutUint16(req[0:], 0x0001)
	binary.BigEndian.PutUint32(req[4:], 0x2112A442)
	rand.Read(req[8:])
	buf := make([]byte, 2048)
	for try := 0; try < 2; try++ {
		conn.SetDeadline(time.Now().Add(3 * time.Second))
		if _, err := conn.Write(req); err != nil {
			return "", err
		}
		n, err := conn.Read(buf)
		if err != nil || n < 20 || string(buf[8:20]) != string(req[8:20]) {
			continue
		}
		end := 20 + int(binary.BigEndian.Uint16(buf[2:]))
		if end > n {
			end = n
		}
		for pos := 20; pos+4 <= end; {
			kind, length := binary.BigEndian.Uint16(buf[pos:]), int(binary.BigEndian.Uint16(buf[pos+2:]))
			if pos+4+length > end {
				break
			}
			v := buf[pos+4 : pos+4+length]
			if (kind == 0x0020 || kind == 0x0001) && len(v) >= 8 && v[1] == 1 {
				raw := binary.BigEndian.Uint32(v[4:])
				if kind == 0x0020 {
					raw ^= 0x2112A442
				}
				ip := make(net.IP, 4)
				binary.BigEndian.PutUint32(ip, raw)
				return ip.String(), nil
			}
			pos += 4 + length + (4-length%4)%4
		}
	}
	return "", errors.New("no answer from the STUN server (outgoing UDP blocked?)")
}
