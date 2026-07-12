//go:build !linux

package qmicore

import "strings"

type qmiControlDeviceHolder struct {
	PID     int
	Command string
}

type qmiControlDeviceHolders struct {
	Holders []qmiControlDeviceHolder
	Unknown bool
}

func (h qmiControlDeviceHolders) onlyQMIProxy() bool {
	if len(h.Holders) == 0 {
		return false
	}
	for _, holder := range h.Holders {
		if !strings.Contains(strings.ToLower(strings.TrimSpace(holder.Command)), "qmi-proxy") {
			return false
		}
	}
	return true
}

var detectQMIControlDeviceHolders = func(string) (qmiControlDeviceHolders, error) {
	return qmiControlDeviceHolders{Unknown: true}, nil
}
