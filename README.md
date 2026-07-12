# voHub

> voHive的低劣模仿者（codex版）

voHub 是一个面向 Quectel 等移动网络模组的自托管管理平台。项目复刻了
VoHive 的主要页面与交互，并提供设备管理、蜂窝数据连接、短信、代理、
eSIM、VoWiFi、通知和运行维护能力。Web 前端会嵌入 Go 可执行文件，部署时
无需单独运行前端服务。

## 功能简介

- **设备管理**：发现并管理 QMI、MBIM 和 AT 模组，展示信号、运营商、
  网络制式、IMEI、ICCID、公网 IP 和运行状态。
- **蜂窝网络**：建立和断开数据连接，切换飞行模式、重启模组、换 IP、
  搜索运营商并选择网络。
- **短信与 USSD**：短信收发、会话管理、联系人搜索、GSM7/UCS2 编码、
  AT/QMI 短信以及 SMS over IMS。
- **代理服务**：提供 SOCKS5 / HTTP 出口代理、上游代理、VoWiFi 前置代理、
  流量统计和国家路由规则。
- **eSIM 管理**：读取 eUICC 信息，下载、启用、切换、重命名和删除 Profile。
- **VoWiFi / IMS**：提供 SWu、IKEv2/EAP-AKA、IMS 注册、E911 和短信能力。
- **卡策略**：按 ICCID 保存数据网络、VoWiFi、飞行模式和切卡恢复策略。
- **消息通知**：支持 Telegram、Email、Webhook、Bark、飞书、QQ 和 PushPlus。
- **运维能力**：实时日志、流量分析、OpenAPI 文档、在线更新和配置管理。

## 支持平台

- Linux amd64
- Linux arm64
- Linux armv7
- macOS arm64（Apple Silicon）
- macOS amd64（Intel）

## 技术栈

- Go 1.26.5、Gin、GORM、SQLite、Viper
- 生产界面：VoHive Vue 3 / Element Plus 构建产物
- 保留界面：React 19.2.7、React Router 7.18.1、TypeScript 6.0.3、Vite 8.1.4
- 前端构建产物通过 `embed.FS` 嵌入单个 Go 可执行文件

## 目录

```text
cmd/vohub/       主程序
internal/        设备、代理、短信、eSIM、VoWiFi 和 API 实现
pkg/             可复用协议与日志包
web/             VoHive 1:1 生产界面与保留的 React 源码
packaging/       OpenWrt 服务脚本
```

## 编译运行教程

### 1. 准备环境

需要安装：

- Go 1.26.5
- Node.js 22.12 或更高版本及 npm
- GNU Make
- Git
- 可选：UPX，用于压缩 Linux 可执行文件

获取源码并安装前端依赖：

```bash
git clone https://github.com/tu95/voHub.git
cd voHub
npm ci --prefix web
```

### 2. 编译

根据目标机器选择一个命令：

```bash
# Linux x86-64
make build-amd64 VERSION=v1.0.0

# Linux ARM64，例如 64 位树莓派
make build-arm64 VERSION=v1.0.0

# Linux ARMv7，例如 32 位树莓派
make build-armv7 VERSION=v1.0.0

# Apple Silicon Mac
make build-mac-arm64 VERSION=v1.0.0

# Intel Mac
make build-mac-amd64 VERSION=v1.0.0

# 一次构建以上全部目标
make build-all VERSION=v1.0.0
```

生成的文件位于 `dist/`。Linux ARM64 对应：

```text
dist/vohub_v1.0.0_linux_arm64
```

### 3. 创建配置

```bash
mkdir -p config data logs
cp packaging/openwrt/vohub/files/config.yaml config/config.yaml
```

默认 Web 端口是 `8000`，初始账号和密码均为 `admin`。正式使用前请修改
`config/config.yaml` 中的密码。`devices: []` 表示启动后自动发现模组；也可以
在 Web 页面中添加设备。

### 4. 启动

Linux ARM64 示例：

```bash
chmod +x dist/vohub_v1.0.0_linux_arm64
sudo ./dist/vohub_v1.0.0_linux_arm64 -c config/config.yaml
```

Apple Silicon Mac 示例：

```bash
chmod +x dist/vohub_v1.0.0_darwin_arm64
./dist/vohub_v1.0.0_darwin_arm64 -c config/config.yaml
```

其他平台只需替换为对应的二进制文件名。启动成功后访问：

```text
http://设备IP:8000/
```

前台运行时按 `Ctrl+C` 即可停止。本教程只启动程序本身，不会自动创建
systemd、launchd 或其他保活服务。

### 5. Docker 运行

```bash
mkdir -p config data logs
cp packaging/openwrt/vohub/files/config.yaml config/config.yaml
docker compose build
docker compose up -d
docker compose logs -f vohub
```

停止并删除容器：

```bash
docker compose down
```

## 本地开发

`web/vohive-dist` 是实际嵌入发布二进制的生产界面。下面的 Vite 命令只用于运行保留的 React 源码：

```bash
cd web
npm ci
VOHUB_API_TARGET=http://127.0.0.1:8000 npm run dev
```

前端质量检查：

```bash
npm run typecheck
npm run lint
npm run test:contract
npm run build
```

后端测试：

```bash
GOTOOLCHAIN=go1.26.5 go test ./...
```

## 发布包与架构校验

macOS Apple Silicon 发布包（可从 `dist/` 直接分发）及校验文件：

```bash
make package-mac-arm64 VERSION=v1.0.0
make package-mac-amd64 VERSION=v1.0.0
# 等价的平台命名：make build-darwin-arm64 VERSION=v1.0.0
# Intel Mac 等价命名：make build-darwin-amd64 VERSION=v1.0.0
cat dist/vohub_v1.0.0_darwin_arm64.tar.gz.sha256
cat dist/vohub_v1.0.0_darwin_amd64.tar.gz.sha256
# 校验（macOS）
(cd dist && shasum -a 256 -c vohub_v1.0.0_darwin_arm64.tar.gz.sha256)
```

在 macOS arm64 主机上可运行完整后端测试并验证二进制目标架构：

```bash
make test-mac-arm64
make verify-mac-arm64 VERSION=v1.0.0
```

`test-mac-arm64` 会执行当前主机上的 Darwin 测试；在 Linux CI 上仅做
交叉编译（不能直接执行 Darwin 测试二进制）。

macOS arm64 可直接运行 API、Web、配置、数据库和业务测试；Linux 专属的
udev、`SO_BINDTODEVICE` 与 VoWiFi SWu 隧道在 macOS 构建中使用明确的平台边界，
实机蜂窝数据面和 SWu 隧道仍需在 Linux 上验证。

### VoWiFi 实现说明

上游的 `github.com/iniwex5/vowifi-go v1.1.2` 已转为私有仓库。voHub 在
`third_party/vowifi-go` 中维护兼容实现，并通过 `swu-go` 建立
ePDG/IKEv2/EAP-AKA 隧道，因此构建不再需要私有 GitHub 凭据。当前实现已经
包含 IMS SIP 注册和 SMS over IMS；语音媒体仍未完成实卡端到端验证。不同
运营商可能禁止 VoWiFi，实际可用性取决于 SIM 卡套餐、运营商策略、ePDG 和
IMS 配置。

## 鸣谢

感谢 [iniwex5/vohive-release](https://github.com/iniwex5/vohive-release)
提供的 VoHive 发布版本、产品设计和交互参考。voHub 的界面复刻与兼容性工作
离不开该项目。

同时感谢项目中使用的 Go、Vue、React、Gin、GORM、SQLite、sipgo、swu-go
等开源项目及其贡献者。

## 许可证和原始声明

本项目保留上游 [PolyForm Noncommercial License 1.0.0](LICENSE)，仅限非商业用途。

Required Notice: Copyright iniwex5 (https://github.com/iniwex5/vohive-release)

修改和重命不代表原作者对 voHub 项目进行背书。
