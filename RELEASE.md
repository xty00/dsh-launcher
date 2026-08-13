# 发布手册（Release）

本文说明如何把 DSH Launcher 发布到 GitHub Releases，让已安装用户通过「设置 → 检查更新」自动升级。

## 发布前置条件

1. 已登录 GitHub，仓库为 `zhanweipan/dsh-launcher`（发布配置已在 `electron-builder.yml` 中写好）
2. 生成一个 **GitHub Personal Access Token**（用于上传 Release 资源）：
   - GitHub → Settings → Developer settings → Personal access tokens → **Fine-grained tokens**
   - 仓库权限勾选 **Contents: Read and write**
   - 或者用 **classic token**，勾选 `repo` 权限
3. 把 token 配置为环境变量 `GH_TOKEN`（发布命令会读取它）

> Windows 下临时设置：`set GH_TOKEN=ghp_xxx`
> PowerShell 下临时设置：`$env:GH_TOKEN='ghp_xxx'`
> 永久设置请用系统环境变量，不要写进代码或提交到仓库。

## 发布步骤

### 1. 确认版本号

`package.json` 的 `version` 是发布版本号。升级版本号示例（0.2.0 → 0.2.1）：

```bash
npm version patch   # 0.2.0 -> 0.2.1（自动改 package.json 并打 tag）
```

> 不想自动打 tag 的话，也可以手动改 `package.json` 的 version，然后在下面手动打 tag。

### 2. 打 tag 并推送

```bash
git push origin main
git push origin v0.2.1        # 推送刚才的 tag
```

### 3. 执行发布

```bash
npm run release
```

该命令会：构建 → 打包 NSIS 安装包 → 上传到 GitHub Releases（自动创建/更新对应 tag 的 release，附带 `latest.yml` 和 `.blockmap`）。

> 首次发布如果本机没有权限问题，会直接成功；上传量大时耐心等待。

### 4. 验证发布

- GitHub 仓库 Releases 页面能看到 `v0.2.1` 及附件（exe + blockmap + latest.yml）
- 在一台装了旧版的机器上打开 DSH Launcher → 设置 → **检查更新** → 应提示发现新版本并自动升级

## 自动更新的工作原理

- 安装包内的 electron-updater 启动时/点击检查时，请求 `https://api.github.com/repos/zhanweipan/dsh-launcher/releases/latest`
- 通过 `latest.yml` 中的 sha512 校验并差分下载更新
- 下载完成后自动重启安装（NSIS 静默更新）

## 代码签名评估

| 方案 | 效果 | 成本 |
|---|---|---|
| **无签名（当前）** | 首次安装弹 SmartScreen「未知发布者」；自动更新本身**可用**（electron-updater 校验 sha512，不强制签名） | 免费 |
| 商业代码签名证书（OV/EV） | 消除 SmartScreen 警告 | 数百~数千元/年 |
| Azure Trusted Signing | 微软云签名，可消除警告 | 有免费额度，适合开源项目 |
| SignPath（开源项目免费计划） | 云签名 | 开源免费 |

**短期建议**：无签名发布即可（自动更新链路不受影响），文档里引导用户「更多信息 → 仍要运行」；正式对外分发前再接入 Azure Trusted Signing 或 SignPath。

## 回滚

用户端出问题时：
1. 在 GitHub Releases 把问题版本 **delete release**（保留旧版 release 不动）
2. 因为 electron-updater 总是取 latest，删掉问题 release 后用户检查更新会回到旧版或提示已是最新
3. 或者发布一个修复版覆盖它

## 常见问题

- **上传时报 401/403**：`GH_TOKEN` 未设置或权限不足（需要 Contents: read/write）
- **检查更新提示「开发模式不支持」**：说明跑的是 `npm run dev` 或未打包版本，请用安装包版本
- **检查更新提示网络错误**：本机无法访问 api.github.com（代理/证书问题），参考项目根目录 `.npmrc` 中关于系统证书的说明
- **安装包文件名**：electron-builder 会自动把 `DSH Launcher` 中的空格替换为 `-`（`DSH-Launcher-Setup-x.y.z.exe`），这是正常的
