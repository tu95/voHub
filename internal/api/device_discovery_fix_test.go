package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

type recordingATSession struct {
	commands *[]string
}

func (s *recordingATSession) Execute(command string, _ time.Duration) (string, error) {
	*s.commands = append(*s.commands, command)
	return "OK", nil
}

func (s *recordingATSession) Close() error { return nil }

func TestHandleFixDiscoveredUSBNetSendsRecoverySequence(t *testing.T) {
	var commands []string
	original := openManualATSession
	openManualATSession = func(port string) (manualATSession, error) {
		if port != "/dev/ttyUSB2" {
			t.Fatalf("opened port %q, want /dev/ttyUSB2", port)
		}
		return &recordingATSession{commands: &commands}, nil
	}
	t.Cleanup(func() { openManualATSession = original })

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/device-mgmt/discovered/fix-usbnet", strings.NewReader(`{"at_port":"/dev/ttyUSB2"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	(&Server{}).handleFixDiscoveredUSBNet(ctx)
	if ctx.Writer.Status() != http.StatusOK {
		t.Fatalf("status=%d body=%s", ctx.Writer.Status(), recorder.Body.String())
	}
	if got, want := strings.Join(commands, "|"), `AT+QCFG="usbnet",0|AT+CFUN=1,1`; got != want {
		t.Fatalf("commands=%q, want %q", got, want)
	}
}

func TestHandleFixDiscoveredUSBNetRejectsUnsafePort(t *testing.T) {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/device-mgmt/discovered/fix-usbnet", strings.NewReader(`{"at_port":"/tmp/fake"}`))
	ctx.Request.Header.Set("Content-Type", "application/json")

	(&Server{}).handleFixDiscoveredUSBNet(ctx)
	if ctx.Writer.Status() != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", ctx.Writer.Status(), recorder.Body.String())
	}
}
