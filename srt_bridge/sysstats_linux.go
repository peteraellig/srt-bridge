//go:build linux

package main

import (
	"bufio"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	sysMu  sync.Mutex
	sysNow SysState
)

func watchSystem() {
	var prevIdle, prevTotal uint64
	for {
		time.Sleep(1 * time.Second)
		cpu, idle, total := readLinuxCPU(prevIdle, prevTotal)
		if total > 0 {
			prevIdle, prevTotal = idle, total
		}
		ramPct, ramGB, procMB := readLinuxMem()

		sysMu.Lock()
		sysNow = SysState{
			CPU:     cpu,
			ProcCPU: cpu,
			RAMPct:  ramPct,
			RAMGB:   ramGB,
			ProcMB:  procMB,
		}
		sysMu.Unlock()
	}
}

func readLinuxCPU(prevIdle, prevTotal uint64) (pct float64, idle, total uint64) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return 0, 0, 0
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	if scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) >= 5 && fields[0] == "cpu" {
			var vals [4]uint64
			for i := 0; i < 4; i++ {
				vals[i], _ = strconv.ParseUint(fields[i+1], 10, 64)
			}
			idle = vals[3]
			total = vals[0] + vals[1] + vals[2] + vals[3]
			if prevTotal > 0 && total > prevTotal {
				dTotal := total - prevTotal
				dIdle := idle - prevIdle
				pct = float64(dTotal-dIdle) / float64(dTotal) * 100.0
			}
		}
	}
	return pct, idle, total
}

func readLinuxMem() (ramPct int, ramGB float64, procMB float64) {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	procMB = float64(m.Alloc) / (1024 * 1024)

	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0, procMB
	}
	defer f.Close()

	var totalKB, availKB float64
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "MemTotal:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				totalKB, _ = strconv.ParseFloat(fields[1], 64)
			}
		} else if strings.HasPrefix(line, "MemAvailable:") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				availKB, _ = strconv.ParseFloat(fields[1], 64)
			}
		}
	}
	if totalKB > 0 {
		ramGB = totalKB / (1024 * 1024)
		if availKB > 0 {
			ramPct = int(((totalKB - availKB) / totalKB) * 100.0)
		}
	}
	return ramPct, ramGB, procMB
}

func sysSnapshot() SysState {
	sysMu.Lock()
	defer sysMu.Unlock()
	return sysNow
}
