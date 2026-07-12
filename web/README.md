# voHub Web 管理界面

`vohive-dist/` 是发布时实际使用的 VoHive 1:1 Vue 界面，构建脚本会将其复制到 `dist/`。`src/` 保留此前的 React + TypeScript 实现，用于开发参考和 API 契约检查，不会进入默认发布包。

## 保留界面的本地开发

要求 Node.js 22.12 或更高版本。后端默认监听 `:8000`，开发服务器通过 Vite 将 `/api` 代理到后端：

```bash
npm ci
VOHUB_API_TARGET=http://127.0.0.1:8000 npm run dev
```

默认访问 `http://127.0.0.1:5173/`。需要从局域网访问时可运行：

```bash
npm run dev -- --host 0.0.0.0
```

## 质量检查与构建

```bash
npm run typecheck
npm run lint
npm run test:contract
npm run build
```

`npm run build` 会先检查保留源码和实际克隆界面的 API 调用是否都有对应后端路由，再把 `vohive-dist/` 复制到 `web/dist`。项目根目录的 `make frontend-dist` 会继续复制到 `internal/web/dist`，随后嵌入 Go 可执行文件。

后端与完整构建说明见 [项目 README](../README.md)。
