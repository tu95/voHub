package config

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const defaultConfigYAML = `server:
  debug: false
  port: 8000

web:
  username: admin
  password: admin

devices: []

vowifi:
  enabled: false

webhook:
  enabled: false
`

// EnsureDefaultFile 仅在配置不存在时创建最小配置，不覆盖已有内容。
func EnsureDefaultFile(path string) (bool, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return false, fmt.Errorf("创建配置目录失败: %w", err)
	}

	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if errors.Is(err, os.ErrExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("创建默认配置失败: %w", err)
	}

	if _, err := f.WriteString(defaultConfigYAML); err != nil {
		_ = f.Close()
		_ = os.Remove(path)
		return false, fmt.Errorf("写入默认配置失败: %w", err)
	}
	if err := f.Close(); err != nil {
		_ = os.Remove(path)
		return false, fmt.Errorf("保存默认配置失败: %w", err)
	}
	return true, nil
}
