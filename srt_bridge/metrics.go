package main

import (
	"fmt"
	"net/http"
	"strings"
)

func handleMetrics(h *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		st := h.state()
		sys := sysSnapshot()

		var b strings.Builder

		b.WriteString("# HELP srt_bridge_up Whether the SRT Bridge daemon is running\n")
		b.WriteString("# TYPE srt_bridge_up gauge\n")
		b.WriteString("srt_bridge_up 1\n\n")

		b.WriteString("# HELP srt_bridge_slots_total Total configured channel slots\n")
		b.WriteString("# TYPE srt_bridge_slots_total gauge\n")
		fmt.Fprintf(&b, "srt_bridge_slots_total %d\n\n", len(st.Places))

		var (
			liveCount   int
			totalRecv   int
			totalInMbps float64
			totalOutMbps float64
			totalPktsIn uint64
			totalPktsOut uint64
			totalLoss   uint64
			totalDrops  uint64
		)

		for _, p := range st.Places {
			if p.Sender != nil {
				liveCount++
				totalInMbps += p.Sender.Mbps
				totalPktsIn += p.Sender.Pkts
				totalLoss += p.Sender.Loss
				totalDrops += p.Sender.Drops
			}
			recvs := len(p.Receivers) + len(p.Forward)
			totalRecv += recvs
			for _, rc := range p.Receivers {
				totalOutMbps += rc.Mbps
				totalPktsOut += rc.Pkts
			}
			for _, fw := range p.Forward {
				totalOutMbps += fw.Mbps
				totalPktsOut += fw.Pkts
			}
		}

		b.WriteString("# HELP srt_bridge_live_inputs Number of active incoming SRT streams\n")
		b.WriteString("# TYPE srt_bridge_live_inputs gauge\n")
		fmt.Fprintf(&b, "srt_bridge_live_inputs %d\n\n", liveCount)

		b.WriteString("# HELP srt_bridge_receivers_total Total connected output receivers\n")
		b.WriteString("# TYPE srt_bridge_receivers_total gauge\n")
		fmt.Fprintf(&b, "srt_bridge_receivers_total %d\n\n", totalRecv)

		b.WriteString("# HELP srt_bridge_rate_in_mbps Total incoming data rate in Mbps\n")
		b.WriteString("# TYPE srt_bridge_rate_in_mbps gauge\n")
		fmt.Fprintf(&b, "srt_bridge_rate_in_mbps %.3f\n\n", totalInMbps)

		b.WriteString("# HELP srt_bridge_rate_out_mbps Total outgoing data rate in Mbps\n")
		b.WriteString("# TYPE srt_bridge_rate_out_mbps gauge\n")
		fmt.Fprintf(&b, "srt_bridge_rate_out_mbps %.3f\n\n", totalOutMbps)

		b.WriteString("# HELP srt_bridge_packets_in_total Total SRT packets received\n")
		b.WriteString("# TYPE srt_bridge_packets_in_total counter\n")
		fmt.Fprintf(&b, "srt_bridge_packets_in_total %d\n\n", totalPktsIn)

		b.WriteString("# HELP srt_bridge_packets_out_total Total SRT packets sent\n")
		b.WriteString("# TYPE srt_bridge_packets_out_total counter\n")
		fmt.Fprintf(&b, "srt_bridge_packets_out_total %d\n\n", totalPktsOut)

		b.WriteString("# HELP srt_bridge_packets_lost_total Total SRT packets lost\n")
		b.WriteString("# TYPE srt_bridge_packets_lost_total counter\n")
		fmt.Fprintf(&b, "srt_bridge_packets_lost_total %d\n\n", totalLoss)

		b.WriteString("# HELP srt_bridge_packets_dropped_total Total SRT packets dropped\n")
		b.WriteString("# TYPE srt_bridge_packets_dropped_total counter\n")
		fmt.Fprintf(&b, "srt_bridge_packets_dropped_total %d\n\n", totalDrops)

		b.WriteString("# HELP srt_bridge_cpu_percent System CPU usage percent\n")
		b.WriteString("# TYPE srt_bridge_cpu_percent gauge\n")
		fmt.Fprintf(&b, "srt_bridge_cpu_percent %.2f\n\n", sys.CPU)

		b.WriteString("# HELP srt_bridge_memory_percent System RAM usage percent\n")
		b.WriteString("# TYPE srt_bridge_memory_percent gauge\n")
		fmt.Fprintf(&b, "srt_bridge_memory_percent %d\n\n", sys.RAMPct)

		b.WriteString("# HELP srt_bridge_slot_live Live status per channel slot (1=live, 0=waiting/free)\n")
		b.WriteString("# TYPE srt_bridge_slot_live gauge\n")
		for _, p := range st.Places {
			liveVal := 0
			var slotInMbps float64
			var slotRtt float64
			if p.Sender != nil {
				liveVal = 1
				slotInMbps = p.Sender.Mbps
				slotRtt = p.Sender.RTTMs
			}
			var slotOutMbps float64
			for _, rc := range p.Receivers {
				slotOutMbps += rc.Mbps
			}
			for _, fw := range p.Forward {
				slotOutMbps += fw.Mbps
			}

			label := p.Name
			if label == "" {
				label = fmt.Sprintf("Line %d", p.Slot)
			}
			recvs := len(p.Receivers) + len(p.Forward)

			fmt.Fprintf(&b, "srt_bridge_slot_live{slot=\"%d\",name=\"%s\",id=\"%s\"} %d\n", p.Slot, label, p.ID, liveVal)
			fmt.Fprintf(&b, "srt_bridge_slot_source{slot=\"%d\"} %d\n", p.Slot, p.Source)
			fmt.Fprintf(&b, "srt_bridge_slot_receivers{slot=\"%d\"} %d\n", p.Slot, recvs)
			fmt.Fprintf(&b, "srt_bridge_slot_bitrate_in_mbps{slot=\"%d\"} %.3f\n", p.Slot, slotInMbps)
			fmt.Fprintf(&b, "srt_bridge_slot_bitrate_out_mbps{slot=\"%d\"} %.3f\n", p.Slot, slotOutMbps)
			fmt.Fprintf(&b, "srt_bridge_slot_rtt_ms{slot=\"%d\"} %.2f\n", p.Slot, slotRtt)
		}

		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(b.String()))
	}
}
