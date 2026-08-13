import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateCheckResult } from '../../shared/types'

/**
 * 应用自动更新（electron-updater + GitHub Releases）。
 *
 * 发布流程：在 GitHub 仓库创建 Release 并上传 electron-builder 产出的
 * latest.yml + 安装包（或直接 npm run dist -- --publish always）。
 * 开发模式（未打包）下检查更新会返回不可用。
 */
let ready = false

export function initUpdater(): void {
  if (ready) return
  ready = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (err) => {
    broadcast('updates:status', { kind: 'error', message: err.message })
  })
  autoUpdater.on('checking-for-update', () => {
    broadcast('updates:status', { kind: 'checking', message: '正在检查更新...' })
  })
  autoUpdater.on('update-available', (info) => {
    broadcast('updates:status', { kind: 'available', version: info.version, message: `发现新版本 v${info.version}` })
  })
  autoUpdater.on('update-not-available', () => {
    broadcast('updates:status', { kind: 'not-available', message: '当前已是最新版本' })
  })
  autoUpdater.on('download-progress', (p) => {
    broadcast('updates:status', {
      kind: 'downloading',
      message: `下载更新 ${Math.round(p.percent)}%`
    })
  })
  autoUpdater.on('update-downloaded', (info) => {
    broadcast('updates:status', { kind: 'downloaded', version: info.version, message: `新版本 v${info.version} 已就绪` })
  })
}

function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(channel, payload)
  }
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!app.isPackaged) {
    return { ok: false, available: false, error: '开发模式不支持自动更新，请使用打包后的版本' }
  }
  try {
    initUpdater()
    const result = await autoUpdater.checkForUpdates()
    const version = result?.updateInfo?.version
    return { ok: true, available: Boolean(version && version !== app.getVersion()), version }
  } catch (err) {
    return { ok: false, available: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function downloadAndInstallUpdate(): Promise<{ ok: boolean; error?: string }> {
  try {
    initUpdater()
    await autoUpdater.downloadUpdate()
    autoUpdater.quitAndInstall()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
