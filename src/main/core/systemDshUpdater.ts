import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { spawn } from 'node:child_process'
import type { Dirs } from './paths'
import type { LogHub } from './logger'
import type { ProgressCb } from './nodeInstaller'
import type { SystemDeployment } from '../../shared/types'

/**
 * 接管模式下，用系统 npm 升级/降级系统安装的 DSH。
 * - 前缀可写：直接 spawn 系统 node + npm-cli
 * - 需要管理员：写临时 ps1 脚本，用 Start-Process -Verb RunAs 提权执行，输出重定向到日志文件
 * - 升级前备份当前版本，失败自动回滚
 */

export interface SystemDshEnv {
  dirs: Dirs
  log: LogHub
  system: SystemDeployment
}

/** 系统 npm 的 npm-cli.js 路径（随系统 node 一起安装） */
function systemNpmCli(system: SystemDeployment): string | null {
  if (!system.nodePath) return null
  return path.join(path.dirname(system.nodePath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
}

function dshInstallDir(system: SystemDeployment): string | null {
  if (!system.dshEntry) return null
  return path.dirname(path.dirname(path.dirname(system.dshEntry))) // .../node_modules/@deepseek-ai/dsh
}

function systemNpmCmd(system: SystemDeployment): string | null {
  if (!system.nodePath) return null
  return path.join(path.dirname(system.nodePath), 'npm.cmd')
}

export async function switchSystemDsh(
  env: SystemDshEnv,
  version: string,
  onProgress: ProgressCb
): Promise<void> {
  const { dirs, log, system } = env
  if (!system.dshEntry || !system.nodePath) throw new Error('未检测到系统 DSH')
  const installDir = dshInstallDir(system)!
  const npmCli = systemNpmCli(system)
  if (!npmCli || !fs.existsSync(npmCli)) throw new Error('未找到系统 npm（npm-cli.js）')

  const spec = version === 'latest' ? '@deepseek-ai/dsh' : `@deepseek-ai/dsh@${version}`

  // ① 备份当前版本
  const backupDir = path.join(dirs.backupDir, 'dsh', `pre-${Date.now()}`)
  if (fs.existsSync(installDir)) {
    onProgress('backup', 5, '备份当前 DSH 版本...')
    log.info('dsh-system', `备份 ${installDir} -> ${backupDir}`)
    await fsp.cp(installDir, backupDir, { recursive: true })
    log.info('dsh-system', '备份完成')
  }

  try {
    // ② 执行安装（普通 / UAC）
    onProgress('install', 10, system.requiresAdmin ? '需要管理员权限，将弹出 UAC 确认...' : '安装中...')
    if (system.requiresAdmin) {
      await runElevatedNpmInstall(env, spec)
    } else {
      await runPlainNpmInstall(env, npmCli, spec)
    }

    // ③ 验证
    onProgress('verify', 90, '验证版本...')
    const v = await readSystemDshVersion(system)
    if (!v) throw new Error('安装后无法读取 DSH 版本')
    if (version !== 'latest' && v !== version) {
      throw new Error(`版本不符：期望 ${version}，实际 ${v}`)
    }
    log.info('dsh-system', `系统 DSH 已切换至 v${v}`)
    onProgress('done', 100, `系统 DSH v${v} 就绪`)
    // 成功后清理备份
    await fsp.rm(backupDir, { recursive: true, force: true }).catch(() => {})
  } catch (err) {
    // ④ 失败回滚
    log.error('dsh-system', `切换失败，正在回滚: ${err instanceof Error ? err.message : String(err)}`)
    if (fs.existsSync(backupDir)) {
      onProgress('rollback', 95, '切换失败，正在回滚...')
      await fsp.rm(installDir, { recursive: true, force: true })
      await fsp.cp(backupDir, installDir, { recursive: true })
      const v = await readSystemDshVersion(system)
      log.info('dsh-system', `已回滚到 v${v ?? '?'}`)
    }
    throw err
  }
}

function runPlainNpmInstall(
  env: SystemDshEnv,
  npmCli: string,
  spec: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const node = env.system.nodePath!
    const child = spawn(
      node,
      [npmCli, 'install', '-g', spec, '--no-audit', '--no-fund', '--loglevel', 'info'],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    env.log.attachStream('dsh-system', child.stdout, 'info')
    env.log.attachStream('dsh-system', child.stderr, 'error')
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`npm install 失败（exit ${code}），详见日志`))
    })
  })
}

/** UAC 提权执行 npm install：写临时 ps1 + Start-Process -Verb RunAs，输出重定向到日志文件轮询 */
function runElevatedNpmInstall(
  env: SystemDshEnv,
  spec: string
): Promise<void> {
  const { dirs, log, system } = env
  const npmCmd = systemNpmCmd(system)!
  const logFile = path.join(dirs.tmpDir, `dsh-system-install-${Date.now()}.log`)
  const errFile = logFile + '.err'
  const scriptFile = path.join(dirs.tmpDir, `dsh-elevated-${Date.now()}.ps1`)
  const script = [
    '$ErrorActionPreference = "Continue"',
    `$p = Start-Process -FilePath "${npmCmd}" -ArgumentList 'install -g ${spec.replace(/'/g, "''")} --no-audit --no-fund --loglevel info' -Verb RunAs -Wait -PassThru -RedirectStandardOutput "${logFile}" -RedirectStandardError "${errFile}"`,
    'Write-Output ("ELEVATED_EXIT=" + $p.ExitCode)'
  ].join('\r\n')

  return new Promise((resolve, reject) => {
    fsp.writeFile(scriptFile, script, 'utf8').then(() => {
      const child = spawn(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptFile],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
      )
      let out = ''
      child.stdout?.on('data', (c: Buffer) => (out += c.toString()))
      child.stderr?.on('data', (c: Buffer) => (out += c.toString()))
      child.on('error', (err) => {
        void cleanup()
        reject(new Error(`UAC 提权启动失败: ${err.message}`))
      })
      child.on('close', async () => {
        const exitMatch = out.match(/ELEVATED_EXIT=(\d+)/)
        const elevatedExit = exitMatch ? Number(exitMatch[1]) : null
        // 流式读取日志文件
        const tail = await readFileSafe(logFile)
        const errTail = await readFileSafe(errFile)
        for (const line of (tail + '\n' + errTail).split(/\r?\n/).filter(Boolean)) {
          log.info('dsh-system', line)
        }
        void cleanup()
        if (elevatedExit === 0) resolve()
        else reject(new Error(`npm install 失败（exit ${elevatedExit ?? '?'}）。${errTail || tail || ''}`.slice(0, 300)))
      })

      const cleanup = async (): Promise<void> => {
        await fsp.rm(scriptFile, { force: true }).catch(() => {})
        await fsp.rm(logFile, { force: true }).catch(() => {})
        await fsp.rm(errFile, { force: true }).catch(() => {})
      }
    })
  })
}

async function readFileSafe(file: string): Promise<string> {
  try {
    return await fsp.readFile(file, 'utf8')
  } catch {
    return ''
  }
}

export async function readSystemDshVersion(system: SystemDeployment): Promise<string | null> {
  if (!system.dshEntry || !system.nodePath) return null
  return new Promise((resolve) => {
    const child = spawn(system.nodePath!, [system.dshEntry!, '--version'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })
    let out = ''
    child.stdout?.on('data', (c: Buffer) => (out += c.toString()))
    child.on('error', () => resolve(null))
    child.on('close', () => resolve(out.trim().split(/\s+/)[0] || null))
  })
}