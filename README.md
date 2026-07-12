# voHub

> voHive的低劣模仿者（codex版）

移动网络模组管理面板，支持设备、网络、短信、代理、eSIM、VoWiFi 和通知管理。

## 一键安装并启动

Linux 或 macOS 执行这一条即可：

```bash
curl -fsSL https://raw.githubusercontent.com/tu95/voHub/main/scripts/install.sh | sudo bash
```

脚本会自动识别系统和 CPU 架构，下载并校验对应的 Release 二进制，安装后
直接启动。支持 Linux amd64/arm64/armv7 和 macOS amd64/arm64。访问：

```text
http://设备IP:8000/
```

初始账号：`admin`，初始密码：`admin`。按 `Ctrl+C` 停止，以后启动只需：

```bash
sudo vohub
```

首次启动会自动创建配置、数据和日志目录，不需要手动复制配置文件。安装脚本
不会创建 systemd 或其他保活服务。

## 功能

- QMI、MBIM、AT 模组发现与管理
- 蜂窝数据连接、飞行模式、换 IP、运营商选择
- 短信收发、会话、联系人、USSD、AT 终端
- SOCKS5 / HTTP 代理、上游代理、流量统计
- eSIM Profile 下载、切换、重命名和删除
- VoWiFi、IMS 注册、SMS over IMS、E911
- 卡策略、实时日志、OpenAPI 和在线更新
- Telegram、Email、Webhook、Bark、飞书、QQ、PushPlus 通知

## 自己编译

需要 Go 1.26.5、Node.js 22.12+、npm 和 Make。

```bash
git clone https://github.com/tu95/voHub.git
cd voHub
npm ci --prefix web
```

选择目标平台：

```bash
make build-amd64       # Linux amd64
make build-arm64       # Linux arm64
make build-armv7       # Linux armv7
make build-mac-arm64   # Apple Silicon Mac
make build-mac-amd64   # Intel Mac
make build-all         # 全部平台
```

编译结果在 `dist/`。例如 Linux ARM64：

```bash
sudo ./dist/vohub_v0.0.1_linux_arm64
```

macOS Apple Silicon：

```bash
./dist/vohub_v0.0.1_darwin_arm64
```

配置不存在时程序会自动创建 `config/config.yaml`。需要指定其他路径时使用：

```bash
./vohub -c /path/to/config.yaml
```

## Docker

```bash
docker compose up --build -d
```

查看日志和停止：

```bash
docker compose logs -f vohub
docker compose down
```

## 测试

```bash
npm ci --prefix web
make test
```

## 说明

- 默认端口为 `8000`。
- 默认自动发现模组，也可以登录 Web 后手动添加。
- 正式使用前请修改默认密码。
- VoWiFi 是否可用取决于 SIM 套餐、运营商策略、ePDG 和 IMS 配置。
- 语音媒体尚未完成实卡端到端验证。

## 鸣谢

感谢 [iniwex5/vohive-release](https://github.com/iniwex5/vohive-release)
提供的 VoHive 发布版本、产品设计和交互参考。

## 许可证

本项目使用 [PolyForm Noncommercial License 1.0.0](LICENSE)，仅限非商业用途。

Required Notice: Copyright iniwex5 (https://github.com/iniwex5/vohive-release)

修改和重命名不代表原作者对 voHub 项目进行背书。
