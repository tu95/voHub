//go:build !linux

package netprobe

import "net"

func bindDialerToInterface(*net.Dialer, string) {}
