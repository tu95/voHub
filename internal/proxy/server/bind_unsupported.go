//go:build !linux

package server

import "net"

func bindDialerToInterface(*net.Dialer, string, string) {}
