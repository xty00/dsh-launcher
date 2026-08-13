import * as fs from 'node:fs'
import { spawn } from 'node:child_process'
import type { Dirs } from './paths'
import { dshEntry, nodeDistDir, nodeExe, npmCliJs } from './paths'
import type { LogHub } from './logger'
import type { InstallEnv, ProgressCb } from './nodeInstaller'

/**
 * 把 DSH（以及其插件管理依赖 pnpm）安装到程序自管的前缀目录：
 *   node <npm-cli.js> install -g pnpm @deepseek-ai/dsh --prefix <prefixDir>
 * 不写入系统 npm 全局目录，卸载程序时整目录删除即干净。
 */
export async function ensureDsh(env: InstallEnv, version: string, onProgress: ProgressCb): Promise<void> {
  const { dirs, log, registry } = env
  const entry = dshEntry(dirs)

  const current = await dshVersion(env)
  if (current) {
    if (version === 'latest' || current === version) {
      log.info('dsh', `DSH v${current} 已安装`)
      onProgress('done', 100, `DSH v${current} 已就绪`)
      return
    }
    log.warn('dsh', `已安装 v${current}，按需重装为 ${version}`)
  }

  const spec = version === 'latest' ? '@deepseek-ai/dsh' : `@deepseek-ai/dsh@${version}`
  onProgress('install', null, '安装 pnpm 与 DSH（首次较慢，请耐心等待）...')
  await runNpm(env, ['install', '-g', 'pnpm', spec, '--prefix', dirs.prefixDir, '--registry', registry, '--no-audit', '--no-fund', '--loglevel', 'info'], 'dsh', onProgress)

  if (!fs.existsSync(entry)) throw new Error('安装后未找到 dsh 入口文件（node_modules/@deepseek-ai/dsh）')
  const v = await dshVersion(env)
  if (!v) throw new Error('无法读取 DSH 版本')
  log.info('dsh', `DSH v${v} 安装完成`)
  onProgress('done', 100, `DSH v${v} 就绪`)
}

function runNpm(env: InstallEnv, args: string[], source: string, onProgress: ProgressCb): Promise<void> {
  return new Promise((resolve, reject) => {
    const node = nodeExe(env.dirs, env.nodeVersion)
    const npmCli = npmCliJs(env.dirs, env.nodeVersion)
    const child = spawn(node, [npmCli, ...args], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: `${nodeDistDir(env.dirs, env.nodeVersion)};${env.dirs.prefixDir};${process.env.PATH ?? ''}`
      }
    })
    env.log.attachStream(source, child.stdout, 'info')
    env.log.attachStream(source, child.stderr, 'error')
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`npm install 失败（exit code ${code}），详见日志`))
      }
    })
  })
}

/** 读取已安装 DSH 的版本；未安装返回 null */
export function dshVersion(env: InstallEnv): Promise<string | null> {
  const entry = dshEntry(env.dirs)
  if (!fs.existsSync(entry)) return Promise.resolve(null)
  const node = nodeExe(env.dirs, env.nodeVersion)
  return new Promise((resolve) => {
    const child = spawn(node, [entry, '--version'], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `${nodeDistDir(env.dirs, env.nodeVersion)};${env.dirs.prefixDir};${process.env.PATH ?? ''}` }
    })
    let out = ''
    child.stdout?.on('data', (c: Buffer) => {
      out += c.toString()
    })
    child.on('error', () => resolve(null))
    child.on('close', () => resolve(out.trim().split(/\s+/)[0] || null))
  })
}
