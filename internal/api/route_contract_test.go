package api

import (
	"bufio"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/tu95/vohub/internal/config"
	"github.com/tu95/vohub/internal/db"
	"github.com/tu95/vohub/internal/device"
	"github.com/tu95/vohub/internal/updater"
)

type referenceRoute struct {
	method string
	path   string
	auth   string
}

func loadReferenceRoutes(t *testing.T) []referenceRoute {
	t.Helper()

	f, err := os.Open("testdata/reference_routes.tsv")
	if err != nil {
		t.Fatalf("open reference route manifest: %v", err)
	}
	defer f.Close()

	var routes []referenceRoute
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Split(line, "\t")
		if len(fields) != 5 {
			t.Fatalf("invalid reference route row %q", line)
		}
		routes = append(routes, referenceRoute{method: fields[0], path: fields[1], auth: fields[2]})
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("read reference route manifest: %v", err)
	}
	return routes
}

func TestRouterMatchesReferenceRouteManifest(t *testing.T) {
	router := (&Server{cfg: config.ServerConfig{}}).newRouter()
	routes := loadReferenceRoutes(t)

	want := make([]string, 0, len(routes))
	for _, route := range routes {
		want = append(want, route.method+" "+route.path)
	}
	got := make([]string, 0, len(router.Routes()))
	for _, route := range router.Routes() {
		got = append(got, route.Method+" "+route.Path)
	}
	sort.Strings(want)
	sort.Strings(got)

	if strings.Join(got, "\n") != strings.Join(want, "\n") {
		t.Fatalf("registered routes differ from reference manifest\nwant:\n%s\n\ngot:\n%s", strings.Join(want, "\n"), strings.Join(got, "\n"))
	}
}

func TestEveryBearerRouteRejectsUnauthenticatedRequests(t *testing.T) {
	router := (&Server{cfg: config.ServerConfig{}}).newRouter()

	for _, route := range loadReferenceRoutes(t) {
		if route.auth != "bearer" {
			continue
		}
		t.Run(route.method+"_"+route.path, func(t *testing.T) {
			path := materializeRoutePath(route.path)
			req := httptest.NewRequest(route.method, path, strings.NewReader("{}"))
			req.Header.Set("Content-Type", "application/json")
			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)
			if resp.Code != http.StatusUnauthorized {
				t.Fatalf("%s %s returned %d without auth, want 401; body=%s", route.method, path, resp.Code, resp.Body.String())
			}
		})
	}
}

// TestEveryReferenceRouteReachesHandlerAuthenticated is deliberately a smoke
// test rather than a success-path test. It protects the complete route surface
// against stale registrations, auth wiring mistakes and nil-fixture panics.
// Mutating handlers receive malformed JSON so they stop at validation; the two
// host-changing system operations and the networked update check use explicit
// test seams.
func TestEveryReferenceRouteReachesHandlerAuthenticated(t *testing.T) {
	if err := db.Init(filepath.Join(t.TempDir(), "route-smoke.db")); err != nil {
		t.Fatalf("init smoke database: %v", err)
	}
	t.Cleanup(func() {
		if db.DB != nil {
			if sqlDB, err := db.DB.DB(); err == nil {
				_ = sqlDB.Close()
			}
			db.DB = nil
		}
	})

	oldDiscoverQMI := discoverQMIForMgmtFn
	oldDiscoverCompatible := discoverCompatibleModemsFromQMIFn
	discoverQMIForMgmtFn = func() ([]device.QMIDevice, error) { return nil, nil }
	discoverCompatibleModemsFromQMIFn = func([]device.QMIDevice) ([]device.CompatibleModem, error) { return nil, nil }
	t.Cleanup(func() {
		discoverQMIForMgmtFn = oldDiscoverQMI
		discoverCompatibleModemsFromQMIFn = oldDiscoverCompatible
	})

	cfg := &config.Config{}
	cfg.Web.Username = "smoke-admin"
	cfg.Web.Password = "smoke-password"
	server := New(cfg, device.NewPool(cfg), nil, nil, nil, nil, filepath.Join(t.TempDir(), "config.yaml"))
	server.checkUpdateFn = func() (*updater.UpdateInfo, error) {
		return &updater.UpdateInfo{CurrentVer: "v0.0.0", LatestVer: "v0.0.0"}, nil
	}
	server.applyUpdateFn = func() error { return nil }
	server.uninstallFn = func() {}
	router := server.newRouter()

	loginBody := `{"username":"smoke-admin","password":"smoke-password"}`
	loginReq := httptest.NewRequest(http.MethodPost, "/api/auth/login", strings.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginResp := httptest.NewRecorder()
	router.ServeHTTP(loginResp, loginReq)
	if loginResp.Code != http.StatusOK {
		t.Fatalf("real login returned %d: %s", loginResp.Code, loginResp.Body.String())
	}
	var login struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(loginResp.Body.Bytes(), &login); err != nil || login.Token == "" {
		t.Fatalf("decode real login token: err=%v body=%s", err, loginResp.Body.String())
	}

	routes := loadReferenceRoutes(t)
	if len(routes) != 97 {
		t.Fatalf("reference route count=%d want 97", len(routes))
	}
	for _, route := range routes {
		route := route
		t.Run(route.method+"_"+route.path, func(t *testing.T) {
			requestBody := "{invalid-json"
			if route.path == "/api/auth/login" {
				requestBody = loginBody
			}
			ctx := context.Background()
			if strings.HasSuffix(route.path, "/stream") && route.method == http.MethodGet {
				var cancel context.CancelFunc
				ctx, cancel = context.WithCancel(ctx)
				cancel() // let SSE handlers emit any initial event and return
			}
			path := materializeRoutePath(route.path)
			req := httptest.NewRequest(route.method, path, strings.NewReader(requestBody)).WithContext(ctx)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer "+login.Token)
			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			body := resp.Body.String()
			if route.auth == "bearer" && resp.Code == http.StatusUnauthorized {
				t.Fatalf("valid bearer token did not pass middleware: body=%s", body)
			}
			if strings.Contains(body, `"message":"API 不存在"`) {
				t.Fatalf("request fell through to generic API 404: status=%d body=%s", resp.Code, body)
			}
			// gin.Default installs Recovery. A recovered panic is a bare 500,
			// while intentional handler errors in this API return a body.
			if resp.Code == http.StatusInternalServerError && strings.TrimSpace(body) == "" {
				t.Fatal("handler panicked (gin recovery returned a bare 500)")
			}
		})
	}
}

func materializeRoutePath(path string) string {
	replacer := strings.NewReplacer(
		":device_id", "no-such-device",
		":message_id", "no-such-message",
		":instance_id", "no-such-instance",
		":proxy_id", "no-such-proxy",
		":country_code", "ZZ",
		":sequence", "0",
		":iccid", "8900000000000000000",
		":id", "no-such-id",
		"*filepath", "no-such-asset",
		"*target", "no-such-target",
	)
	return replacer.Replace(path)
}
