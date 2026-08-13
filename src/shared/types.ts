export type DeploymentMode = 'managed' | 'system'

/** 一个 DSH 实例（不同端口/主机/名称），同一时刻只运行一个（切换制） */
export interface Instance {
  id: string
  name: string
  host: string
  port: number
}

export interface Settings {
  /** 要部署的 Node.js 版本（如 22.14.0） */
  nodeVersion: string
  /** 要部署的 DSH 版本（latest 或精确版本号） */
  dshVersion: string
  /** 监听主机（DSH 出于安全原因不支持 0.0.0.0） */
  host: string
  /** 监听端口 */
  port: number
  /** npm registry 镜像地址 */
  registry: string
  /** 启动成功后自动打开浏览器 */
  autoOpenBrowser: boolean
  /** 开机自启 */
  autoLaunch: boolean
  /** 把自管 dsh 命令暴露到用户 PATH（终端里可直接敲 dsh） */
  addDshToPath: boolean
  /** 实例列表 */
  instances: Instance[]
  /** 当前活动实例 id */
  activeInstanceId: string
  /** 已安装的 Node.js 版本（部署成功后写入） */
  installedNodeVersion?: string
  /** 已安装的 DSH 版本（部署成功后写入） */
  installedDshVersion?: string
  /**
   * 部署方式：
   * - managed：程序自管 Node.js + DSH（默认，可独立卸载）
   * - system：接管系统中已安装的 Node.js + DSH
   */
  mode: DeploymentMode
}

export type RuntimeStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'exited' | 'error'

export interface RuntimeState {
  status: RuntimeStatus
  pid: number | null
  host: string
  port: number
  url: string | null
  lastError: string | null
}

export interface SetupProgress {
  /** 当前步骤 */
  step: 'node' | 'dsh' | 'start'
  /** 阶段：download / verify / extract / install / done / error */
  phase: string
  /** 0-100 的进度；无法量化时为 null */
  percent: number | null
  message: string
}

export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LogLine {
  id: number
  ts: string
  level: LogLevel
  source: string
  text: string
}

export interface NodeVersionInfo {
  version: string
  lts: boolean
  date: string
}

export interface DshVersionInfo {
  latest: string
  versions: string[]
}

export interface UpdateCheckResult {
  ok: boolean
  available: boolean
  version?: string
  error?: string
}

export interface SystemDeployment {
  /** 系统是否同时存在 Node.js 与 DSH */
  detected: boolean
  nodePath: string | null
  nodeVersion: string | null
  /** 系统 DSH 入口（lib/bin.js 路径） */
  dshEntry: string | null
  dshVersion: string | null
}

export interface AppState {
  appVersion: string
  settings: Settings
  node: { installed: boolean; version: string | null }
  dsh: { installed: boolean; version: string | null }
  runtime: RuntimeState
  /** Node 与 DSH 是否都已部署完成（按当前 mode 判断） */
  setupDone: boolean
  /** 系统已有部署检测结果 */
  system: SystemDeployment
}

export interface Result<T = undefined> {
  ok: boolean
  error?: string
  data?: T
}

/** preload 暴露给渲染进程的 API（window.dshm） */
export interface DshmApi {
  getState: () => Promise<AppState>
  installNode: () => Promise<{ ok: boolean; version?: string; error?: string }>
  installDsh: () => Promise<{ ok: boolean; version?: string; error?: string }>
  start: () => Promise<{ ok: boolean; url?: string; error?: string }>
  stop: () => Promise<{ ok: boolean }>
  openBrowser: () => Promise<{ ok: boolean }>
  updateSettings: (patch: Partial<Settings>) => Promise<Settings>
  exportLogs: () => Promise<{ ok: boolean; path?: string; error?: string }>
  detectSystem: () => Promise<SystemDeployment>
  adoptSystem: () => Promise<{ ok: boolean; error?: string }>
  listNodeVersions: () => Promise<NodeVersionInfo[]>
  listDshVersions: () => Promise<DshVersionInfo>
  switchNode: (version: string) => Promise<{ ok: boolean; version?: string; error?: string }>
  switchDsh: (version: string) => Promise<{ ok: boolean; version?: string; error?: string }>
  checkForUpdates: () => Promise<UpdateCheckResult>
  installUpdate: () => Promise<{ ok: boolean; error?: string }>
  instancesList: () => Promise<Instance[]>
  instancesAdd: (name: string, host: string, port: number) => Promise<{ ok: boolean; id?: string; error?: string }>
  instancesUpdate: (id: string, patch: Partial<Instance>) => Promise<{ ok: boolean; error?: string }>
  instancesRemove: (id: string) => Promise<{ ok: boolean; error?: string }>
  instancesActivate: (id: string) => Promise<{ ok: boolean; error?: string }>
  openPath: (target: 'dsh-home' | 'logs') => Promise<{ ok: boolean; error?: string }>
  logsSnapshot: () => Promise<LogLine[]>
  onProgress: (cb: (p: SetupProgress) => void) => () => void
  onRuntimeStatus: (cb: (s: RuntimeState) => void) => () => void
  onLogs: (cb: (lines: LogLine[]) => void) => () => void
}