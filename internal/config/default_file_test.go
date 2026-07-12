package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEnsureDefaultFileCreatesLoadableConfig(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "config.yaml")
	created, err := EnsureDefaultFile(path)
	if err != nil {
		t.Fatalf("EnsureDefaultFile() error = %v", err)
	}
	if !created {
		t.Fatal("EnsureDefaultFile() created = false, want true")
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.Server.Port != ":8000" || cfg.Web.Username != "admin" || cfg.Web.Password != "admin" {
		t.Fatalf("unexpected defaults: %+v", cfg)
	}
	if len(cfg.Devices) != 0 {
		t.Fatalf("devices = %d, want 0", len(cfg.Devices))
	}
}

func TestEnsureDefaultFileDoesNotOverwriteExistingConfig(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	want := "server:\n  port: 9000\n"
	if err := os.WriteFile(path, []byte(want), 0o600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	created, err := EnsureDefaultFile(path)
	if err != nil {
		t.Fatalf("EnsureDefaultFile() error = %v", err)
	}
	if created {
		t.Fatal("EnsureDefaultFile() created = true, want false")
	}

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile() error = %v", err)
	}
	if strings.TrimSpace(string(got)) != strings.TrimSpace(want) {
		t.Fatalf("existing config was changed:\n%s", got)
	}
}
