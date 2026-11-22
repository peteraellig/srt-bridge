//go:build linux

package main

import (
	"crypto/rand"
	"encoding/binary"
	"errors"
	"net"
	"time"
)

func firewallState(ports string, webPort int) FirewallState {
	return FirewallState{
		Ports:    ports,
		Rule:     true,
		Match:    true,
		UDPMatch: true,
		WebPort:  webPort,
		WebMatch: true,
		Detail:   "Managed by host/container environment (Linux)",
	}
}

func requestFirewallRule(ports string, webPort int) error {
	return nil
}

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
	return "", errors.New("no answer from the STUN server")
}
