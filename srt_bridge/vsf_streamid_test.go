package main

import (
	"testing"
)

func TestVSFStreamIDParsing(t *testing.T) {
	suffixes := []string{"forward"}

	tests := []struct {
		input       string
		expectedID  string
		expectedFwd bool
	}{
		{"cam1", "cam1", false},
		{"cam1*forward", "cam1", true},
		{"cam1*FORWARD", "cam1", true},
		{"line2", "line2", false},

		{"#!::r=cam1,m=publish", "cam1", false},
		{"#!::r=cam1,m=request", "cam1", true},
		{"#!::r=cam1,s=forward", "cam1", true},
		{"#!::u=user1,r=cam2,m=publish,s=live", "cam2", false},
		{"#!::u=operator,r=cam2*forward,m=request", "cam2", true},
		{"r=studio,m=publish", "studio", false},
		{"r=studio,m=request", "studio", true},
	}

	for _, tt := range tests {
		id, fwd := splitStreamID(tt.input, suffixes)
		if id != tt.expectedID || fwd != tt.expectedFwd {
			t.Errorf("splitStreamID(%q): got id=%q fwd=%v, want id=%q fwd=%v",
				tt.input, id, fwd, tt.expectedID, tt.expectedFwd)
		}
	}
}
