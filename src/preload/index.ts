import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type {
  AppState,
  DshmApi,
  DshVersionInfo,
  Instance,
  LogLine,
  NodeVersionInfo,
  RuntimeState,
  Settings,
  SetupProgress,
  SystemDeployment,
  UpdateCheckResult
} from '../shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: DshmApi = {
  getState: () => ipcRenderer.invoke('app:getState') as Promise<AppState>,
  installNode: () =>
    ipcRenderer.invoke('setup:installNode') as Promise<{ ok: boolean; version?: string; error?: string }>,
  installDsh: () =>
    ipcRenderer.invoke('setup:installDsh') as Promise<{ ok: boolean; version?: string; error?: string }>,
  start: () => ipcRenderer.invoke('runtime:start') as Promise<{ ok: boolean; url?: string; error?: string }>,
  stop: () => ipcRenderer.invoke('runtime:stop') as Promise<{ ok: boolean }>,
  openBrowser: () => ipcRenderer.invoke('runtime:openBrowser') as Promise<{ ok: boolean }>,
  updateSettings: (patch: Partial<Settings>) =>
    ipcRenderer.invoke('settings:update', patch) as Promise<Settings>,
  exportLogs: () => ipcRenderer.invoke('logs:export') as Promise<{ ok: boolean; path?: string; error?: string }>,
  detectSystem: () => ipcRenderer.invoke('system:detect') as Promise<SystemDeployment>,
  adoptSystem: () => ipcRenderer.invoke('system:adopt') as Promise<{ ok: boolean; error?: string }>,
  listNodeVersions: () => ipcRenderer.invoke('versions:listNode') as Promise<NodeVersionInfo[]>,
  listDshVersions: () => ipcRenderer.invoke('versions:listDsh') as Promise<DshVersionInfo>,
  switchNode: (version: string) =>
    ipcRenderer.invoke('versions:switchNode', version) as Promise<{ ok: boolean; version?: string; error?: string }>,
  switchDsh: (version: string) =>
    ipcRenderer.invoke('versions:switchDsh', version) as Promise<{ ok: boolean; version?: string; error?: string }>,
  checkForUpdates: () => ipcRenderer.invoke('updates:check') as Promise<UpdateCheckResult>,
  installUpdate: () => ipcRenderer.invoke('updates:install') as Promise<{ ok: boolean; error?: string }>,
  instancesList: () => ipcRenderer.invoke('instances:list') as Promise<Instance[]>,
  instancesAdd: (name: string, host: string, port: number) =>
    ipcRenderer.invoke('instances:add', name, host, port) as Promise<{ ok: boolean; id?: string; error?: string }>,
  instancesUpdate: (id: string, patch: Partial<Instance>) =>
    ipcRenderer.invoke('instances:update', id, patch) as Promise<{ ok: boolean; error?: string }>,
  instancesRemove: (id: string) =>
    ipcRenderer.invoke('instances:remove', id) as Promise<{ ok: boolean; error?: string }>,
  instancesActivate: (id: string) =>
    ipcRenderer.invoke('instances:activate', id) as Promise<{ ok: boolean; error?: string }>,
  openPath: (target: 'dsh-home' | 'logs') =>
    ipcRenderer.invoke('shell:openPath', target) as Promise<{ ok: boolean; error?: string }>,
  logsSnapshot: () => ipcRenderer.invoke('logs:snapshot') as Promise<LogLine[]>,
  onProgress: (cb) => subscribe<SetupProgress>('setup:progress', cb),
  onRuntimeStatus: (cb) => subscribe<RuntimeState>('runtime:status', cb),
  onLogs: (cb) => subscribe<LogLine[]>('logs:append', cb)
}

contextBridge.exposeInMainWorld('dshm', api)