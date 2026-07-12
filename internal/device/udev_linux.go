//go:build linux

package device

import (
	"errors"
	"time"

	"github.com/iniwex5/netlink/nl"
	"github.com/tu95/vohub/pkg/logger"
	"golang.org/x/sys/unix"
)

func runUdevLoop(w *UdevWatcher) {
	conn, err := nl.Subscribe(unix.NETLINK_KOBJECT_UEVENT)
	if err != nil {
		logger.Warn("udev 监听器启动失败，热插拔功能不可用", "err", err)
		return
	}
	defer conn.Close()
	logger.Info("udev 设备热插拔监听器已启动")
	for {
		select {
		case <-w.stop:
			logger.Info("udev 监听器已停止")
			return
		default:
		}
		timeout := unix.NsecToTimeval(time.Second.Nanoseconds())
		_ = conn.SetReceiveTimeout(&timeout)
		msgs, _, err := conn.Receive()
		if err != nil {
			if errors.Is(err, unix.EAGAIN) || errors.Is(err, unix.EWOULDBLOCK) {
				continue
			}
			continue
		}
		for _, msg := range msgs {
			if w.isModemEvent(msg.Data) {
				w.scheduleRescan()
				break
			}
		}
	}
}
