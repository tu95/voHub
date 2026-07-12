package db

import (
	"path/filepath"
	"testing"
)

func TestCheckSchema(t *testing.T) {
	if err := Init(filepath.Join(t.TempDir(), "vohub.db")); err != nil {
		t.Fatalf("init test database: %v", err)
	}
	var m []map[string]interface{}
	if err := DB.Raw("PRAGMA table_info(devices)").Scan(&m).Error; err != nil {
		t.Fatalf("inspect devices schema: %v", err)
	}
	if len(m) == 0 {
		t.Fatal("devices schema is empty")
	}
}
