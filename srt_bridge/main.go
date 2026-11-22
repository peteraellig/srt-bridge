// SRT Bridge: receives SRT streams as a listener and hands them out again as
// a listener, all on one UDP port. The stream ID says which place a device
// talks to; a matrix decides what goes out on "<id>*forward".
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

const version = "0.5.4"

func main() {
	headless := flag.Bool("headless", false, "run without the window (the interface stays reachable in a browser)")
	defCfg, defLog := dataPaths()
	cfgPath := flag.String("config", defCfg, "configuration file")
	logPath := flag.String("log", defLog, "log file; \"-\" writes to the console")
	flag.Parse()
	configFile, logFile = *cfgPath, *logPath
	if abs, err := filepath.Abs(configFile); err == nil {
		configFile = abs
	}
	if abs, err := filepath.Abs(logFile); err == nil && logFile != "-" {
		logFile = abs
	}

	if *logPath != "-" {
		// One file is enough: start over when it has grown past 5 MB.
		if st, err := os.Stat(*logPath); err == nil && st.Size() > 5<<20 {
			os.Remove(*logPath + ".old")
			os.Rename(*logPath, *logPath+".old")
		}
		if f, err := os.OpenFile(*logPath, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644); err == nil {
			log.SetOutput(f)
		}
	}
	log.Printf("SRT Bridge %s starting", version)

	cfg, err := loadConfig(*cfgPath)
	if err != nil {
		fatal("The configuration could not be read:\n" + err.Error())
	}

	webLn, err := listenWeb(cfg.WebAddr)
	if err != nil {
		fatal(fmt.Sprintf("The interface could not be opened on %s.\nIs SRT Bridge running already?\n\n%v", cfg.WebAddr, err))
	}

	hub := newHub(cfg, *cfgPath)
	hub.start()
	go hub.statsLoop()
	go watchSystem()
	// Remote access: the certificate sits next to config.json.
	remote := newRemote(hub, filepath.Dir(configFile))
	output := newOutput(hub)
	whip := newWhip(hub)
	web := newWebServer(hub, remote, output, whip)
	remote.inner = web
	remote.sync()
	go remote.loop()
	go func() {
		if err := http.Serve(webLn, web); err != nil {
			log.Printf("web server stopped: %v", err)
		}
	}()
	// Bridge Output reads the bridge, so it is looked after once the interface answers.
	go output.loop()
	go whip.loop()
	videohub := newVideohubServer(hub, ":9990")
	go videohub.Start()

	url := "http://" + webLn.Addr().String() + "/"
	log.Printf("interface on %s", url)
	if *headless {
		select {}
	}
	runWindow(url, hub)
	whip.stop()
	videohub.Stop()
	output.shutdown()
	remote.stop()
	hub.stop()
	time.Sleep(200 * time.Millisecond) // let the goodbye packets leave
	log.Print("window closed, SRT Bridge ends")
}

func fatal(msg string) {
	log.Print(msg)
	showError(msg)
	os.Exit(1)
}
