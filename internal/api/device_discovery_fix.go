package api

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

// fixDiscoveredUSBNetRequest is intentionally small: the discovery page only
// needs a safe, fixed recovery operation for a modem that is exposing the
// wrong USB network mode.  The port must come from discovery and may not be an
// arbitrary path on the host.
type fixDiscoveredUSBNetRequest struct {
	ATPort string `json:"at_port"`
}

// handleFixDiscoveredUSBNet sends the Quectel USBNET reset sequence directly
// to a discovered AT port.  Discovered devices are not workers yet, so the
// normal worker modem manager cannot be used here.
func (s *Server) handleFixDiscoveredUSBNet(c *gin.Context) {
	var req fixDiscoveredUSBNetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "参数错误"})
		return
	}

	port := strings.TrimSpace(req.ATPort)
	if port == "" {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "at_port 不能为空"})
		return
	}
	if !strings.HasPrefix(port, "/dev/") {
		c.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "at_port 必须是设备串口路径"})
		return
	}

	// Quectel USBNET mode 0 is the modem's standard QMI/MBIM-compatible mode.
	// A restart is required before the kernel re-enumerates the interfaces.
	if _, err := executeManualATOnPort(port, `AT+QCFG="usbnet",0`, 5*time.Second); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"status": "error", "message": "设置 USBNET 模式失败: " + err.Error()})
		return
	}
	if _, err := executeManualATOnPort(port, "AT+CFUN=1,1", 5*time.Second); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"status": "error", "message": "重启模组失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "USBNET 模式已修复，设备正在重启…",
	})
}
