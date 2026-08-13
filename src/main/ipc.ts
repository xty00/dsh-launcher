import { ipcMain, shell, dialog, BrowserWindow, app } from 'electron'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { ensureNode, runNodeVersion } from './core/nodeInstaller'
import { ensureDsh, dshVersion } from './core/dshInstaller'
import { dshEntry } from './core/paths'
import type { Dirs } from './core/paths'
import type { LogHub } from './core/logger'
import type { LaunchSpec, RuntimeManager } from './core/runtimeManager'
import { detectSystemDeployment } from './core/systemDetector'
import { patchSettings } from './core/settings'
import { listNodeVersions, listDshVersions } from './core/versionManager'
import { checkForUpdates, downloadAndInstallUpdate } from './core/updater'
import type {
  AppState,
  LogLine,
  NodeVersionInfo,
  Settings,
  SetupProgress,
  SystemDeployment,
  UpdateCheckResult
} from '../shared/types'

export interface IpcDeps {
  dirs: Dirs
  log: LogHub
  runtime: RuntimeManager
  getSettings: () => Settings
  saveSettings: (s: Settings) => Promise<void>
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export function registerIpc(deps: IpcDeps): void {
  const { dirs, log, runtime, getSettings, saveSettings } = deps

  const envOf = (s: Settings) => ({ dirs, log, registry: s.registry, nodeVersion: s.nodeVersion })

  ipcMain.handle('app:getState', async (): Promise<AppState> => {
    const s = getSettings()
    const system = await detectSystemDeployment()

    // 按当前 mode 解析「本应用使用的」Node / DSH 版本
    let nodeVersion: string | null
    let dshVersionInstalled: string | null
    if (s.mode === 'system') {
      nodeVersion = system.nodeVersion
      dshVersionInstalled = system.dshVersion
    } else {
      nodeVersion = await runNodeVersion(envOf(s), s.nodeVersion)
      dshVersionInstalled = fs.existsSync(dshEntry(dirs)) ? await dshVersion(envOf(s)) : null
    }
    const runtimeState = runtime.getState()
    return {
      appVersion: app.getVersion(),
      settings: s,
      node: { installed: nodeVersion !== null, version: nodeVersion },
      dsh: { installed: dshVersionInstalled !== null, version: dshVersionInstalled },
      runtime: runtimeState,
      setupDone: nodeVersion !== null && dshVersionInstalled !== null,
      system
    }
  })

  ipcMain.handle('system:detect', async (): Promise<SystemDeployment> => detectSystemDeployment(true))

  ipcMain.handle('system:adopt', async (): Promise<{ ok: boolean; error?: string }> => {
    const system = await detectSystemDeployment(true)
    if (!system.detected) return { ok: false, error: '未检测到系统已有的 DSH 部署' }
    const s = getSettings()
    await saveSettings({ ...s, mode: 'system' })
    log.info('system', `已切换为接管系统部署（Node v${system.nodeVersion ?? '?'} / DSH v${system.dshVersion ?? '?'}）`)
    return { ok: true }
  })

  ipcMain.handle('setup:installNode', async (): Promise<{ ok: boolean; version?: string; error?: string }> => {
    const s = getSettings()
    try {
      await ensureNode(envOf(s), s.nodeVersion, (phase, percent, message) =>
        broadcast('setup:progress', { step: 'node', phase, percent, message } satisfies SetupProgress)
      )
      await saveSettings({ ...s, installedNodeVersion: s.nodeVersion })
      return { ok: true, version: s.nodeVersion }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('node', `安装失败: ${msg}`)
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle('setup:installDsh', async (): Promise<{ ok: boolean; version?: string; error?: string }> => {
    const s = getSettings()
    try {
      await ensureDsh(envOf(s), s.dshVersion, (phase, percent, message) =>
        broadcast('setup:progress', { step: 'dsh', phase, percent, message } satisfies SetupProgress)
      )
      const v = await dshVersion(envOf(s))
      await saveSettings({ ...s, installedDshVersion: v ?? s.dshVersion })
      return { ok: true, version: v ?? s.dshVersion }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('dsh', `安装失败: ${msg}`)
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle('runtime:start', async () => {
    const s = getSettings()
    let launch: LaunchSpec | undefined
    if (s.mode === 'system') {
      const system = await detectSystemDeployment()
      if (!system.dshEntry || !system.nodePath) {
        return { ok: false, error: '未检测到系统 DSH 部署，请先在系统中安装 DSH' }
      }
      launch = { nodePath: system.nodePath, entry: system.dshEntry }
    }
    return runtime.start(s.host, s.port, launch)
  })

  ipcMain.handle('runtime:stop', async () => runtime.stop())

  ipcMain.handle('runtime:openBrowser', async () => {
    const s = getSettings()
    shell.openExternal(`http://${s.host}:${s.port}`)
    return { ok: true }
  })

  ipcMain.handle('settings:update', async (_e, patch: Partial<Settings>): Promise<Settings> => {
    const next = patchSettings(getSettings(), patch)
    await saveSettings(next)
    if ('autoLaunch' in patch) {
      app.setLoginItemSettings({ openAtLogin: next.autoLaunch, args: ['--hidden'] })
      log.info('settings', `开机自启已${next.autoLaunch ? '开启' : '关闭'}`)
    }
    log.info('settings', `设置已更新: ${JSON.stringify(patch)}`)
    return next
  })

  // ---------- 版本管理 ----------

  ipcMain.handle('versions:listNode', async (): Promise<NodeVersionInfo[]> => listNodeVersions())

  ipcMain.handle('versions:listDsh', async () => {
    const s = getSettings()
    return listDshVersions(s.registry)
  })

  ipcMain.handle('versions:switchNode', async (_e, version: string): Promise<{ ok: boolean; version?: string; error?: string }> => {
    const s = getSettings()
    if (s.mode !== 'managed') return { ok: false, error: '接管模式下请通过系统自身管理 Node.js 版本' }
    if (!/^\d+\.\d+\.\d+$/.test(version)) return { ok: false, error: '版本号格式无效' }
    try {
      if (runtime.getState().status === 'running' || runtime.getState().status === 'starting') {
        log.info('versions', '切换版本前先停止 DSH')
        await runtime.stop()
      }
      await ensureNode(envOf(s), version, (phase, percent, message) =>
        broadcast('setup:progress', { step: 'node', phase, percent, message } satisfies SetupProgress)
      )
      await saveSettings({ ...s, nodeVersion: version, installedNodeVersion: version })
      log.info('versions', `Node.js 已切换至 v${version}`)
      return { ok: true, version }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('versions', `Node.js 切换失败: ${msg}`)
      return { ok: false, error: msg }
    }
  })

  ipcMain.handle('versions:switchDsh', async (_e, version: string): Promise<{ ok: boolean; version?: string; error?: string }> => {
    const s = getSettings()
    if (s.mode !== 'managed') return { ok: false, error: '接管模式下请通过系统自身管理 DSH 版本' }
    try {
      if (runtime.getState().status === 'running' || runtime.getState().status === 'starting') {
        log.info('versions', '切换版本前先停止 DSH')
        await runtime.stop()
      }
      await ensureDsh(envOf(s), version, (phase, percent, message) =>
        broadcast('setup:progress', { step: 'dsh', phase, percent, message } satisfies SetupProgress)
      )
      const v = await dshVersion(envOf(s))
      await saveSettings({ ...s, dshVersion: version, installedDshVersion: v ?? version })
      log.info('versions', `DSH 已切换至 v${v ?? version}`)
      return { ok: true, version: v ?? version }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('versions', `DSH 切换失败: ${msg}`)
      return { ok: false, error: msg }
    }
  })

  // ---------- 应用自动更新 ----------

  ipcMain.handle('updates:check', async (): Promise<UpdateCheckResult> => checkForUpdates())

  ipcMain.handle('updates:install', async () => downloadAndInstallUpdate())

  ipcMain.handle('logs:snapshot', async (): Promise<LogLine[]> => log.snapshot())

  ipcMain.handle('logs:export', async (): Promise<{ ok: boolean; path?: string; error?: string }> => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出日志',
      defaultPath: path.join(dirs.logsDir, `dsh-manager-${Date.now()}.log`),
      filters: [{ name: '日志文件', extensions: ['log', 'txt'] }]
    })
    if (canceled || !filePath) return { ok: false, error: '已取消' }
    try {
      const content = log
        .snapshot()
        .map((l) => `[${l.ts}] [${l.level}] [${l.source}] ${l.text}`)
        .join('\n')
      fs.writeFileSync(filePath, content, 'utf8')
      log.info('logs', `已导出日志到 ${filePath}`)
      return { ok: true, path: filePath }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
}