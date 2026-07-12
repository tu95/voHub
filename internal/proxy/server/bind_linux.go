//go:build linux

package server

import (
	"fmt"
	"net"
	"syscall"

	"github.com/tu95/vohub/pkg/logger"
)

func bindDialerToInterface(dialer *net.Dialer, id, iface string) {
	if iface == "" {
		return
	}
	dialer.Control = func(_, _ string, conn syscall.RawConn) error {
		var socketErr error
		if err := conn.Control(func(fd uintptr) {
			socketErr = syscall.SetsockoptString(int(fd), syscall.SOL_SOCKET, syscall.SO_BINDTODEVICE, iface)
		}); err != nil {
			return err
		}
		if socketErr != nil {
			logger.Error(fmt.Sprintf("[%s] 绑定设备失败", id), "iface", iface, "err", socketErr)
			return fmt.Errorf("SO_BINDTODEVICE(%s) 失败: %w", iface, socketErr)
		}
		return nil
	}
}
