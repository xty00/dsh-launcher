# Backlog / 待办需求

> 记录尚未实施的改进点，随「定期维护」一起处理。

## 🔧 下轮维护（下周）

### 1. 更新下载进度条（用户反馈）
- **问题**：设置页「检查更新」在后台下载时只提示"正在后台下载..."，无进度，用户易焦虑
- **现状**：electron-updater 已发出 `download-progress` 事件（updater.ts 里已监听并广播 `updates:status`，含 `kind: 'downloading'` 和 `percent`）——数据已经有了，只是界面没渲染
- **实现思路**：设置页（或全局）订阅 `updates:status`，遇 downloading 时显示 antd `Progress` 组件（进度 %），完成后提示可安装/自动重启；顺带加"取消更新"入口
- **工作量**：小（plumbing 已就绪）

### 2. Electron 大版本升级（安全相关，最高优先）
- Electron 33 → 43（落后 10 个大版本，Chromium 安全补丁缺失）
- 需联动升级 electron-vite、vite；升级后完整跑 typecheck/build/冒烟

### 3. 核心逻辑自动化测试
- settings 迁移、RuntimeManager（启停/外部实例）、systemDshUpdater（备份/回滚）补单测
- 降低后续改动回归风险

### 4. Node.js 部署下载重试
- 首次部署下载 30MB 中断时只能重来；参考 updater 的重试逻辑加指数退避

## ☁️ 中期

- **代码签名（SignPath 免费版，审批中）**：审批通过后搭 GitHub Actions（构建→签名→发布），对接 SignPath；解决"本地发布要 token""SmartScreen 警告"
- **自定义图标**：替换 Electron 默认图标（生成 256x256 图标）
- **端口预检测文案优化**：区分"其他 Web 服务占用"与"DSH 外部实例"，提示更精准
- **日志敏感信息脱敏**：DSH 日志可能含 API Key，导出/存储时做脱敏

## 🚀 远期

- 并发多实例（同时跑多个 DSH，当前为切换制）
- 模型 / API Key 图形化配置
