# DSH Manager

一键部署与管理 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的 Windows 桌面工具。

面向非技术用户设计：安装后首次启动，跟着向导点几下，就能在本机把 Node.js + DSH 装好、启动并打开 Web 界面。之后可以随时一键启停、查看日志、调整端口。

## 特性（M1）

- 一键部署：自动下载安装 Node.js（官方 zip，无管理员权限、不污染系统）、通过 npm 安装 DSH
- 一键启动 / 停止 DSH（Web 服务，默认 127.0.0.1:3080）
- 监听端口设置、启动后自动打开浏览器
- 实时日志查看（按级别过滤、导出）
- 安装包交付（NSIS 向导，桌面/开始菜单快捷方式，卸载干净）

## 技术栈

- Electron + electron-vite + TypeScript
- React 18 + Ant Design 5
- electron-builder（NSIS，per-user 安装，免 UAC）

## 开发

要求 Node.js >= 18。

```bash
npm install        # 安装依赖
npm run dev        # 开发模式（热更新）
npm run typecheck  # 类型检查
npm run build      # 构建产物到 out/
npm run dist       # 构建 + 打包 NSIS 安装包（dist/）
```

## 架构

```
Electron GUI（React + antd）
        │ IPC（contextBridge）
主进程（核心管理逻辑，纯 Node、可单测）
  ├─ NodeInstaller  下载/校验/解压 Node.js（官方 win-x64 zip + SHA256）
  ├─ DshInstaller   npm install -g @deepseek-ai/dsh --prefix <自管目录>
  ├─ RuntimeManager spawn dsh web + 健康探测 + 停止/进程树清理
  └─ LogHub         内存环形缓冲 + 按天滚动写日志文件
        │
数据目录（app.getPath('userData'），卸载即删，零残留）
  ├─ runtime/node-vX/        Node.js 各版本
  ├─ prefix/node_modules/    DSH / pnpm 安装区
  ├─ logs/
  └─ settings.json
```

关键设计决策：

- **Node.js 不自带、不装系统**：用官方 zip 解压到数据目录，天然支持多版本、免管理员权限、可卸载
- **DSH 装进自管 prefix**：不写系统 npm 全局目录，卸载即删
- **启动不依赖 PATH**：直接 spawn 自管 node 运行 `dsh web --host 127.0.0.1 --port <port>`
- **监听仅本机**：DSH 出于安全拒绝 `--host 0.0.0.0`，不做局域网暴露

## 路线图

- [x] M1：一键部署链路 + 启停 / 端口 / 日志
- [ ] M2：版本管理（Node / DSH 升级降级）、开机自启、镜像切换完善
- [ ] M3：应用自身自动更新（electron-updater）、可选 PATH 暴露 `dsh` 命令

## License

[MIT](./LICENSE)
