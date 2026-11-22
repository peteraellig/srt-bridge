package main

import (
	"strings"
)

type VSFStreamID struct {
	IsVSF    bool
	Resource string
	Mode     string
	Session  string
	User     string
	Raw      string
}

func parseVSFStreamID(streamID string) (VSFStreamID, bool) {
	s := strings.TrimSpace(streamID)
	isPrefixed := false
	if strings.HasPrefix(s, "#!::") {
		s = strings.TrimPrefix(s, "#!::")
		isPrefixed = true
	} else if !strings.Contains(s, "r=") && !strings.Contains(s, "m=") {
		return VSFStreamID{Raw: streamID}, false
	}

	parts := strings.Split(s, ",")
	vsf := VSFStreamID{IsVSF: true, Raw: streamID}
	hasKey := false

	for _, p := range parts {
		kv := strings.SplitN(strings.TrimSpace(p), "=", 2)
		if len(kv) != 2 {
			continue
		}
		hasKey = true
		k := strings.ToLower(strings.TrimSpace(kv[0]))
		v := strings.TrimSpace(kv[1])
		switch k {
		case "r":
			vsf.Resource = v
		case "m":
			vsf.Mode = strings.ToLower(v)
		case "s":
			vsf.Session = v
		case "u":
			vsf.User = v
		}
	}

	if !isPrefixed && (!hasKey || vsf.Resource == "") {
		return VSFStreamID{Raw: streamID}, false
	}
	return vsf, true
}

func (v VSFStreamID) CleanResource(suffixes []string) (string, bool) {
	res := v.Resource
	i := strings.LastIndexByte(res, '*')
	if i >= 0 {
		tail := strings.ToLower(res[i+1:])
		for _, s := range suffixes {
			if tail == s {
				return res[:i], true
			}
		}
	}
	fwd := v.Mode == "request"
	if !fwd {
		s := strings.ToLower(v.Session)
		for _, suffix := range suffixes {
			if s == suffix {
				fwd = true
				break
			}
		}
	}
	return res, fwd
}
