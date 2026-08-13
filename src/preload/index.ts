import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import type { AppState, DshmApi, LogLine, RuntimeState, Settings, SetupProgress, SystemDeployment } from '../shared/types'

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
  logsSnapshot: () => ipcRenderer.invoke('logs:snapshot') as Promise<LogLine[]>,
  onProgress: (cb) => subscribe<SetupProgress>('setup:progress', cb),
  onRuntimeStatus: (cb) => subscribe<RuntimeState>('runtime:status', cb),
  onLogs: (cb) => subscribe<LogLine[]>('logs:append', cb)
}

contextBridge.exposeInMainWorld('dshm', api)