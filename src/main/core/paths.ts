import * as fs from 'node:fs'
import * as path from 'node:path'

export interface Dirs {
  /** 程序数据根目录（默认 electron userData） */
  root: string
  tmpDir: string
  /** Node.js 各版本解压目录（node-vX 子目录） */
  runtimeDir: string
  /** DSH / pnpm 的 npm 全局安装前缀 */
  prefixDir: string
  logsDir: string
  /** 升级系统 DSH 前的备份目录 */
  backupDir: string
  settingsFile: string
}

export function resolveDirs(root: string): Dirs {
  return {
    root,
    tmpDir: path.join(root, 'tmp'),
    runtimeDir: path.join(root, 'runtime'),
    prefixDir: path.join(root, 'prefix'),
    logsDir: path.join(root, 'logs'),
    backupDir: path.join(root, 'backup'),
    settingsFile: path.join(root, 'settings.json')
  }
}

export function ensureDirs(dirs: Dirs): void {
  for (const d of [dirs.root, dirs.tmpDir, dirs.runtimeDir, dirs.prefixDir, dirs.logsDir, dirs.backupDir]) {
    fs.mkdirSync(d, { recursive: true })
  }
}

export function nodeDistDir(dirs: Dirs, version: string): string {
  return path.join(dirs.runtimeDir, `node-v${version}`)
}

export function nodeExe(dirs: Dirs, version: string): string {
  return path.join(nodeDistDir(dirs, version), 'node.exe')
}

export function npmCliJs(dirs: Dirs, version: string): string {
  return path.join(nodeDistDir(dirs, version), 'node_modules', 'npm', 'bin', 'npm-cli.js')
}

export function dshEntry(dirs: Dirs): string {
  return path.join(dirs.prefixDir, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
}