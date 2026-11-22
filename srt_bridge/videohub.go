package main

import (
	"bufio"
	"fmt"
	"log"
	"net"
	"strconv"
	"strings"
	"sync"
)

type VideohubServer struct {
	hub      *Hub
	addr     string
	ln       net.Listener
	mu       sync.Mutex
	clients  map[net.Conn]bool
	stopChan chan struct{}
}

func newVideohubServer(h *Hub, addr string) *VideohubServer {
	if addr == "" {
		addr = ":9990"
	}
	return &VideohubServer{
		hub:      h,
		addr:     addr,
		clients:  make(map[net.Conn]bool),
		stopChan: make(chan struct{}),
	}
}

func (s *VideohubServer) Start() {
	ln, err := net.Listen("tcp", s.addr)
	if err != nil {
		log.Printf("[Videohub] TCP port %s unavailable: %v (Companion control disabled)", s.addr, err)
		return
	}
	s.ln = ln
	log.Printf("[Videohub] Matrix control protocol listening on %s (Blackmagic protocol compatible)", s.addr)

	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				select {
				case <-s.stopChan:
					return
				default:
					return
				}
			}
			s.mu.Lock()
			s.clients[conn] = true
			s.mu.Unlock()

			go s.handleClient(conn)
		}
	}()
}

func (s *VideohubServer) Stop() {
	close(s.stopChan)
	if s.ln != nil {
		s.ln.Close()
	}
	s.mu.Lock()
	for c := range s.clients {
		c.Close()
	}
	s.clients = make(map[net.Conn]bool)
	s.mu.Unlock()
}

func (s *VideohubServer) broadcast(msg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for c := range s.clients {
		c.Write([]byte(msg))
	}
}

func (s *VideohubServer) handleClient(conn net.Conn) {
	defer func() {
		conn.Close()
		s.mu.Lock()
		delete(s.clients, conn)
		s.mu.Unlock()
	}()

	s.hub.mu.Lock()
	places := make([]Place, len(s.hub.cfg.Places))
	for i, p := range s.hub.cfg.Places {
		places[i] = *p
	}
	s.hub.mu.Unlock()

	n := len(places)

	var sb strings.Builder
	sb.WriteString("PROTOCOL PREAMBLE:\nVersion: 2.3\n\n")
	sb.WriteString("VIDEOHUB DEVICE:\nDevice present: true\nModel name: SRT Bridge Matrix\n")
	fmt.Fprintf(&sb, "Video inputs: %d\nVideo outputs: %d\n\n", n, n)

	sb.WriteString("VIDEO OUTPUT ROUTING:\n")
	for i, p := range places {
		src := p.Source - 1
		if src < 0 {
			src = 0
		}
		fmt.Fprintf(&sb, "%d %d\n", i, src)
	}
	sb.WriteString("\n")

	sb.WriteString("INPUT LABELS:\n")
	for i, p := range places {
		lbl := p.Name
		if lbl == "" {
			lbl = fmt.Sprintf("Line %d", i+1)
		}
		fmt.Fprintf(&sb, "%d %s\n", i, lbl)
	}
	sb.WriteString("\n")

	sb.WriteString("OUTPUT LABELS:\n")
	for i, p := range places {
		lbl := p.Name
		if lbl == "" {
			lbl = fmt.Sprintf("Line %d", i+1)
		}
		fmt.Fprintf(&sb, "%d Fwd %s\n", i, lbl)
	}
	sb.WriteString("\n")

	sb.WriteString("END PREAMBLE:\n\n")
	conn.Write([]byte(sb.String()))

	scanner := bufio.NewScanner(conn)
	var currentBlock string

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			currentBlock = ""
			continue
		}
		if strings.HasSuffix(line, ":") {
			currentBlock = line
			continue
		}

		if currentBlock == "VIDEO OUTPUT ROUTING:" {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				outIdx, err1 := strconv.Atoi(parts[0])
				inIdx, err2 := strconv.Atoi(parts[1])
				if err1 == nil && err2 == nil && outIdx >= 0 && outIdx < n {
					slot := outIdx + 1
					source := inIdx + 1
					if inIdx < 0 {
						source = 0
					}
					s.hub.updatePlace(PlaceUpdate{
						Slot:   slot,
						Source: &source,
					})
					s.broadcast(fmt.Sprintf("VIDEO OUTPUT ROUTING:\n%d %d\n\n", outIdx, inIdx))
				}
			}
		} else if currentBlock == "PING:" {
			conn.Write([]byte("ACK\n\n"))
		}
	}
}
