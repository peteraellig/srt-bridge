//go:build linux

package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"
)

func showError(msg string) {
	log.Printf("[ERROR] %s", msg)
}

func runWindow(url string, hub *Hub) {
	log.Printf("SRT Bridge running in headless mode. Web interface: %s", url)
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	<-sigCh
	log.Println("Received termination signal, stopping...")
}
