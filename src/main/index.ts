import { app, BrowserWindow } from 'electron'
import { resolveDirs, ensureDirs } from './core/paths'
import { loadSettings, saveSettings } from './core/settings'
import { LogHub } from './core/logger'
import { RuntimeManager } from './core/runtimeManager'
import { registerIpc } from './ipc'
import { createWindow, getMainWindow } from './window'
import type { Settings } from '../shared/types'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    const dirs = resolveDirs(app.getPath('userData'))
    ensureDirs(dirs)

    let settings = loadSettings(dirs.settingsFile)
    const log = new LogHub(dirs.logsDir)
    log.info('app', `DSH Manager 启动 v${app.getVersion()}`)

    const runtime = new RuntimeManager({ dirs, log, nodeVersion: settings.nodeVersion }, (s) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('runtime:status', s)
      }
    })

    const save = async (s: Settings): Promise<void> => {
      settings = s
      await saveSettings(dirs.settingsFile, s)
    }

    registerIpc({
      dirs,
      log,
      runtime,
      getSettings: () => settings,
      saveSettings: save
    })

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    // Windows 关闭窗口即退出应用；DSH 子进程继续在后台运行
    app.quit()
  })

  app.on('before-quit', () => {
    // 不主动 kill DSH：允许其在后台继续提供服务（用户可在首页显式停止）
  })
}
