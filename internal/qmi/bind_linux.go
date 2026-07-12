//go:build linux

package qmicore

import (
	"net"
	"syscall"
)

func bindDialerToInterface(dialer *net.Dialer, iface string) {
	dialer.Control = func(_, _ string, conn syscall.RawConn) error {
		var socketErr error
		if err := conn.Control(func(fd uintptr) {
			socketErr = syscall.SetsockoptString(int(fd), syscall.SOL_SOCKET, syscall.SO_BINDTODEVICE, iface)
		}); err != nil {
			return err
		}
		return socketErr
	}
}
