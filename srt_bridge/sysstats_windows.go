package main

import (
	"runtime"
	"sync"
	"syscall"
	"time"
	"unsafe"
)

var (
	kernel32                 = syscall.NewLazyDLL("kernel32.dll")
	procGetSystemTimes       = kernel32.NewProc("GetSystemTimes")
	procGlobalMemoryStatusEx = kernel32.NewProc("GlobalMemoryStatusEx")
	procGetProcessMemoryInfo = kernel32.NewProc("K32GetProcessMemoryInfo")

	sysMu  sync.Mutex
	sysNow SysState
)

func ticks(f syscall.Filetime) uint64 { return uint64(f.HighDateTime)<<32 | uint64(f.LowDateTime) }

type memoryStatusEx struct {
	Length                                      uint32
	MemoryLoad                                  uint32
	TotalPhys, AvailPhys                        uint64
	TotalPageFile, AvailPageFile                uint64
	TotalVirtual, AvailVirtual, AvailExtVirtual uint64
}

type processMemoryCounters struct {
	Cb                                                                uint32
	PageFaultCount                                                    uint32
	PeakWorkingSetSize, WorkingSetSize                                uintptr
	QuotaPeakPagedPoolUsage, QuotaPagedPoolUsage                      uintptr
	QuotaPeakNonPagedPoolUsage, QuotaNonPagedPoolUsage, PagefileUsage uintptr
	PeakPagefileUsage                                                 uintptr
}

// watchSystem measures every two seconds; reading the result costs nothing.
func watchSystem() {
	self, _ := syscall.GetCurrentProcess()
	var lastIdle, lastAll, lastProc uint64
	var lastTime time.Time
	for {
		var idle, kernel, user syscall.Filetime
		procGetSystemTimes.Call(uintptr(unsafe.Pointer(&idle)), uintptr(unsafe.Pointer(&kernel)), uintptr(unsafe.Pointer(&user)))
		all := ticks(kernel) + ticks(user) // kernel time includes idle time
		var created, exited, pk, pu syscall.Filetime
		syscall.GetProcessTimes(self, &created, &exited, &pk, &pu)
		proc := ticks(pk) + ticks(pu)
		now := time.Now()

		var st SysState
		if !lastTime.IsZero() {
			if d := all - lastAll; d > 0 {
				st.CPU = 100 * (1 - float64(ticks(idle)-lastIdle)/float64(d))
			}
			if wall := now.Sub(lastTime).Seconds(); wall > 0 {
				st.ProcCPU = 100 * float64(proc-lastProc) / 1e7 / wall / float64(runtime.NumCPU())
			}
		}
		lastIdle, lastAll, lastProc, lastTime = ticks(idle), all, proc, now

		mem := memoryStatusEx{}
		mem.Length = uint32(unsafe.Sizeof(mem))
		if r, _, _ := procGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&mem))); r != 0 {
			st.RAMPct = int(mem.MemoryLoad)
			st.RAMGB = float64(mem.TotalPhys) / (1 << 30)
		}
		pmc := processMemoryCounters{}
		pmc.Cb = uint32(unsafe.Sizeof(pmc))
		if r, _, _ := procGetProcessMemoryInfo.Call(uintptr(self), uintptr(unsafe.Pointer(&pmc)), uintptr(pmc.Cb)); r != 0 {
			st.ProcMB = float64(pmc.WorkingSetSize) / (1 << 20)
		}
		sysMu.Lock()
		sysNow = st
		sysMu.Unlock()
		time.Sleep(2 * time.Second)
	}
}

func sysSnapshot() SysState {
	sysMu.Lock()
	defer sysMu.Unlock()
	return sysNow
}
