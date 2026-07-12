//go:build !linux

package qmicore

import "net"

func bindDialerToInterface(*net.Dialer, string) {}
