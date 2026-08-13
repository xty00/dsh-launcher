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
  /** 已安装的 Node.js 版本（部署成功后写入） */
  installedNodeVersion?: string
  /** 已安装的 DSH 版本（部署成功后写入） */
  installedDshVersion?: string
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

export interface AppState {
  appVersion: string
  settings: Settings
  node: { installed: boolean; version: string | null }
  dsh: { installed: boolean; version: string | null }
  runtime: RuntimeState
  /** Node 与 DSH 是否都已部署完成 */
  setupDone: boolean
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
  logsSnapshot: () => Promise<LogLine[]>
  onProgress: (cb: (p: SetupProgress) => void) => () => void
  onRuntimeStatus: (cb: (s: RuntimeState) => void) => () => void
  onLogs: (cb: (lines: LogLine[]) => void) => () => void
}
