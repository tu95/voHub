package global

var (
	// Version 应用程序版本，由编译时 -ldflags -X 注入
	Version = "v0.0.1"

	// BuildTime 构建时间，由编译时 -ldflags -X 注入
	BuildTime = "Unknown"
)
