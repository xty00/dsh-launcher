import { execFile } from 'node:child_process'
import * as fsp from 'node:fs/promises'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { SystemDeployment } from '../../shared/types'

let cache: { at: number; value: SystemDeployment } | null = null
const TTL_MS = 15_000

/**
 * 检测系统已有的 Node.js / DSH 部署（用于「接管已有部署」模式）。
 * 结果带 15s TTL 缓存，避免 5 秒轮询时反复 spawn 子进程。
 */
export async function detectSystemDeployment(force = false): Promise<SystemDeployment> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.value
  const value = await detect()
  cache = { at: Date.now(), value }
  return value
}

async function detect(): Promise<SystemDeployment> {
  const nodePath = await which('node')

  let nodeVersion: string | null = null
  if (nodePath) nodeVersion = await run(nodePath, ['-v'])

  // 常见系统 DSH 全局安装位置
  const candidates: string[] = []
  if (nodePath) {
    candidates.push(path.join(path.dirname(nodePath), 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
  }
  candidates.push(
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  )

  let dshEntry: string | null = null
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      dshEntry = c
      break
    }
  }

  let dshVersion: string | null = null
  if (dshEntry && nodePath) dshVersion = await run(nodePath, [dshEntry, '--version'])

  // 由 dshEntry 反推 npm 全局前缀：<prefix>/node_modules/@deepseek-ai/dsh/lib/bin.js
  const dshGlobalPrefix = dshEntry ? path.dirname(path.dirname(path.dirname(path.dirname(dshEntry)))) : null
  const requiresAdmin = dshGlobalPrefix ? !(await isWritable(dshGlobalPrefix)) : false

  return {
    detected: nodePath !== null && dshEntry !== null,
    nodePath,
    nodeVersion,
    dshEntry,
    dshVersion,
    dshGlobalPrefix,
    requiresAdmin
  }
}

/** 探测目录是否可写（用户级 npm 全局可写；Program Files 下不可写需管理员） */
async function isWritable(dir: string): Promise<boolean> {
  const probe = path.join(dir, '.dshlauncher-write-probe-' + Date.now())
  try {
    await fsp.writeFile(probe, 'ok', 'utf8')
    await fsp.rm(probe, { force: true })
    return true
  } catch {
    return false
  }
}

function which(name: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('where', [name], { windowsHide: true }, (err, stdout) => {
      if (err) {
        resolve(null)
        return
      }
      const lines = stdout
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      resolve(lines[0] ?? null)
    })
  })
}

function run(node: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(node, args, { windowsHide: true, timeout: 15_000 }, (err, stdout) => {
      if (err) {
        resolve(null)
        return
      }
      resolve(stdout.trim().split(/\s+/)[0].replace(/^v/, '') || null)
    })
  })
}