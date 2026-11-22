package main

type AutostartState struct {
	On    bool   `json:"on"`
	Other string `json:"other"`
}

type FirewallState struct {
	Ports     string `json:"ports"`     // "21101" or "21101-21108"
	Rule      bool   `json:"rule"`      // a rule with our name exists
	Match     bool   `json:"match"`     // the rules open everything that is needed (UDP, and TCP if remote access is on)
	UDPMatch  bool   `json:"udpMatch"`  // the SRT rule opens all of these ports for UDP (it may open more)
	WebPort   int    `json:"webPort"`   // TCP port of remote access; 0 = remote access is off
	WebMatch  bool   `json:"webMatch"`  // the rule for remote access opens it
	WhipPort  int    `json:"whipPort"`  // TCP and UDP port of the WHIP input; 0 = WHIP is off
	WhipMatch bool   `json:"whipMatch"` // the WHIP rule opens it for TCP and UDP
	Detail    string `json:"detail"`    // why the state could not be read
}

type SysState struct {
	CPU     float64 `json:"cpu"`
	ProcCPU float64 `json:"procCpu"`
	RAMPct  int     `json:"ramPct"`
	RAMGB   float64 `json:"ramGb"`
	ProcMB  float64 `json:"procMb"`
}
