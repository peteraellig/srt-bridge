package main

// Start with Windows: an entry under HKCU\...\Run for the user the bridge
// runs as. No administrator rights are needed; the uninstaller removes it.

import (
	"os"
	"strings"

	"golang.org/x/sys/windows/registry"
)

const (
	runKey   = `Software\Microsoft\Windows\CurrentVersion\Run`
	runValue = "SRT Bridge"
)

// autostartCommand is what Windows runs at login: this program, as it runs now.
func autostartCommand() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	return `"` + exe + `"`
}

func autostartState() AutostartState {
	k, err := registry.OpenKey(registry.CURRENT_USER, runKey, registry.QUERY_VALUE)
	if err != nil {
		return AutostartState{}
	}
	defer k.Close()
	v, _, err := k.GetStringValue(runValue)
	if err != nil || v == "" {
		return AutostartState{}
	}
	st := AutostartState{On: true}
	if !strings.EqualFold(v, autostartCommand()) {
		st.Other = strings.Trim(v, `"`)
	}
	return st
}

func setAutostart(on bool) error {
	k, _, err := registry.CreateKey(registry.CURRENT_USER, runKey, registry.SET_VALUE)
	if err != nil {
		return err
	}
	defer k.Close()
	if !on {
		if err := k.DeleteValue(runValue); err != nil && err != registry.ErrNotExist {
			return err
		}
		return nil
	}
	return k.SetStringValue(runValue, autostartCommand())
}
