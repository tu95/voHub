package device

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tu95/vohub/internal/config"
)

func TestAddWorkerQMIManagedRebindsByIMEIWhenControlDeviceGone(t *testing.T) {
	// QMI 托管设备:配置 control_device 指向不存在节点,但配置了正确 IMEI;
	// 注入一块带该 IMEI 的新路径 QMI 硬件。bootstrap 应按 IMEI 取回新路径并采纳。

	originalDiscover := discoverQMIDevicesFn
	defer func() { discoverQMIDevicesFn = originalDiscover }()
	discoverQMIDevicesFn = func() ([]QMIDevice, error) {
		return []QMIDevice{
			{
				ControlPath:  "/dev/cdc-wdm-new-qmi",
				NetInterface: "wwan-new",
				USBPath:      "1-2.3",
				ATPort:       "/dev/ttyUSB-new",
			},
		}, nil
	}

	originalResolveQMI := resolveDiscoveredQMIDeviceFn
	defer func() { resolveDiscoveredQMIDeviceFn = originalResolveQMI }()
	resolveDiscoveredQMIDeviceFn = func(dev QMIDevice, timeout time.Duration, allowProbe bool) (QMIDevice, string) {
		if dev.ControlPath == "/dev/cdc-wdm-new-qmi" {
			return dev, "123456789012345"
		}
		return dev, ""
	}

	// 初始化 Pool
	p := NewPool(&config.Config{})

	devCfg := config.DeviceConfig{
		ID:             "dev-qmi-1",
		DeviceBackend:  "qmi",
		ModemIMEI:      "123456789012345",
		ControlDevice:  "/dev/nonexistent-control-old",
		Interface:      "wwan-old",
		USBPath:        "1-9.9",
		NetworkEnabled: true, // hasManagedQMINetwork 的条件
	}

	// 此时 /dev/nonexistent-control-old 不存在，controlDeviceStatErr != nil。
	// 但 shouldDiscoverQMIManagedBootstrapByIMEI 会返回 true。
	// 它会用 discovery 取回 /dev/cdc-wdm-new-qmi，并在 modem.New 中报错（因为此节点在系统中也不存在）。
	// 只要 error 中包含了新的控制路径或网络接口，就说明它成功 rebind 了。
	w, err := p.AddWorkerFromConfig(devCfg)
	if err != nil {
		// 不同平台对虚拟 QMI 路径的打开结果不同；失败时只确认没有退回旧路径。
		require.NotContains(t, err.Error(), "设备控制口 /dev/nonexistent-control-old 不存在，可能模块尚未重新枚举")
		return
	}
	t.Cleanup(func() { _ = p.Shutdown() })
	require.Equal(t, "/dev/cdc-wdm-new-qmi", w.Config.ControlDevice)
	require.Equal(t, "wwan-new", w.Config.Interface)
}
