import * as fs from 'node:fs'
import * as http from 'node:http'
import * as path from 'node:path'
import { spawn, execFile } from 'node:child_process'
import type { Dirs } from './paths'
import { dshEntry, nodeExe } from './paths'
import { detectExternalOnPort } from './externalDetector'
import type { LogHub } from './logger'
import type { ExternalInstanceInfo, RuntimeState } from '../../shared/types'

export interface RuntimeEnv {
  dirs: Dirs
  log: LogHub
  /** 当前生效的 Node 版本（自管模式从 settings 读取，切换版本后无需重启应用） */
  getNodeVersion: () => string
}

const START_TIMEOUT_MS = 60_000

/** 启动 DSH 时使用的 node 与入口（managed 模式为自管路径，system 模式为系统路径） */
export interface LaunchSpec {
  nodePath: string
  entry: string
}

/**
 * DSH 运行时管理器：
 * - spawn 出 dsh web 子进程（不依赖 PATH，直接指向自管 node 与 dsh 入口）
 * - 通过 HTTP 健康探测确认就绪
 * - 停止时先优雅 kill，超时则 taskkill /T /F 清理进程树
 */
export class RuntimeManager {
  private child: ReturnType<typeof spawn> | null = null
  private state: RuntimeState = {
    status: 'stopped',
    pid: null,
    host: '127.0.0.1',
    port: 3080,
    url: null,
    lastError: null,
    external: false,
    externalInfo: null
  }
  private stopping = false

  constructor(
    private env: RuntimeEnv,
    private onChange: (s: RuntimeState) => void
  ) {}

  getState(): RuntimeState {
    return { ...this.state }
  }

  private set(patch: Partial<RuntimeState>): void {
    this.state = { ...this.state, ...patch }
    this.onChange(this.getState())
  }

  async start(
    host: string,
    port: number,
    launch?: LaunchSpec
  ): Promise<{ ok: boolean; url?: string; error?: string }> {
    if (this.state.status === 'running' || this.state.status === 'starting') {
      return { ok: true, url: this.state.url ?? undefined }
    }
    if (port < 1 || port > 65535) return { ok: false, error: '端口无效（1-65535）' }

    // 启动前检测端口：外部 DSH 或其它程序占用时给出明确提示
    const det = await detectExternalOnPort(host, port)
    if (det.state === 'external-dsh') {
      const err = `端口 ${port} 已有外部启动的 DSH 实例在运行（PID ${det.info.pid}）。请先停止它，或更换端口。`
      this.set({ status: 'error', lastError: err, external: true, externalInfo: det.info })
      return { ok: false, error: err }
    }
    if (det.state === 'other-occupied') {
      const err = `端口 ${port} 被其他程序占用（PID ${det.pid}，非 DSH）。请先释放端口，或在「设置」中更换端口。`
      this.set({ status: 'error', lastError: err, external: false, externalInfo: null })
      return { ok: false, error: err }
    }

    const spec = launch ?? {
      nodePath: nodeExe(this.env.dirs, this.env.getNodeVersion()),
      entry: dshEntry(this.env.dirs)
    }
    if (!fs.existsSync(spec.entry) || !fs.existsSync(spec.nodePath)) {
      const err = '未检测到 DSH 或 Node.js，请先完成部署'
      this.set({ status: 'error', lastError: err })
      return { ok: false, error: err }
    }

    this.stopping = false
    this.set({ status: 'starting', host, port, url: `http://${host}:${port}`, lastError: null })
    this.env.log.info(
      'runtime',
      `启动 dsh web（${spec.nodePath}）--host ${host} --port ${port}`
    )

    const child = spawn(spec.nodePath, [spec.entry, 'web', '--host', host, '--port', String(port)], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: `${path.dirname(spec.nodePath)};${this.env.dirs.prefixDir};${process.env.PATH ?? ''}`
      }
    })
    this.child = child
    this.set({ pid: child.pid ?? null })
    this.env.log.attachStream('dsh', child.stdout, 'info')
    this.env.log.attachStream('dsh', child.stderr, 'error')

    child.on('error', (err) => {
      this.env.log.error('runtime', `子进程错误: ${err.message}`)
    })
    child.on('exit', (code, signal) => {
      this.env.log.info('runtime', `dsh 进程退出 code=${code} signal=${signal}`)
      if (this.child === child) {
        this.child = null
        if (!this.stopping) {
          this.set({
            status: 'exited',
            pid: null,
            lastError: `dsh 进程退出（code=${code ?? signal ?? '?'}）`,
            external: false,
            externalInfo: null
          })
        }
      }
    })

    const url = `http://${host}:${port}`
    const ready = await this.probe(url, START_TIMEOUT_MS)
    if (!ready) {
      if (this.child === child && !this.stopping) {
        this.set({ status: 'error', lastError: '启动超时：Web 服务未就绪' })
        return { ok: false, error: '启动超时：Web 服务未在预期时间内就绪，请查看日志' }
      }
      return { ok: false, error: '服务未就绪' }
    }
    this.set({ status: 'running', url, external: false, externalInfo: null })
    this.env.log.info('runtime', `DSH Web 已就绪：${url}`)
    return { ok: true, url }
  }

  private probe(url: string, timeoutMs: number): Promise<boolean> {
    const deadline = Date.now() + timeoutMs
    return new Promise((resolve) => {
      const tryOnce = (): void => {
        if (this.stopping || this.child === null) {
          resolve(false)
          return
        }
        const req = http.get(url, (res) => {
          res.resume()
          if (res.statusCode && res.statusCode < 500) {
            resolve(true)
            return
          }
          schedule()
        })
        req.setTimeout(1500, () => {
          req.destroy()
          schedule()
        })
        req.on('error', () => schedule())
      }
      const schedule = (): void => {
        if (Date.now() > deadline) {
          resolve(false)
          return
        }
        setTimeout(tryOnce, 800)
      }
      tryOnce()
    })
  }

  async stop(): Promise<{ ok: boolean }> {
    const child = this.child
    if (!child) {
      this.set({ status: 'stopped', pid: null, url: null, lastError: null, external: false, externalInfo: null })
      return { ok: true }
    }
    this.stopping = true
    this.set({ status: 'stopping' })
    this.env.log.info('runtime', '正在停止 DSH...')

    const pid = child.pid
    const exited = await new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), 5000)
      child.once('exit', () => {
        clearTimeout(t)
        resolve(true)
      })
      child.kill()
    })
    if (!exited && pid) {
      this.env.log.warn('runtime', `优雅停止超时，强制结束进程树 PID ${pid}`)
      await this.killTree(pid)
      await new Promise((r) => setTimeout(r, 500))
    }
    this.child = null
    this.stopping = false
    this.set({ status: 'stopped', pid: null, url: null, lastError: null, external: false, externalInfo: null })
    this.env.log.info('runtime', 'DSH 已停止')
    return { ok: true }
  }

  /** 由 getState 轮询调用：把外部实例状态合并进运行时状态 */
  reconcileExternal(det: { state: 'none' } | { state: 'external-dsh'; info: ExternalInstanceInfo } | { state: 'other-occupied'; pid: number; commandLine: string | null }): void {
    if (this.child) return // 自己管理的实例在跑，忽略外部检测
    if (det.state === 'external-dsh') {
      if (!this.state.external || this.state.externalInfo?.pid !== det.info.pid) {
        this.env.log.info('runtime', `检测到外部 DSH 实例（PID ${det.info.pid}）`)
      }
      this.set({ status: 'running', external: true, externalInfo: det.info, url: `http://${this.state.host}:${this.state.port}`, lastError: null })
    } else if (det.state === 'other-occupied') {
      this.set({ status: 'error', external: false, externalInfo: null, lastError: `端口被其他程序占用（PID ${det.pid}，非 DSH）` })
    } else if (this.state.external) {
      this.set({ status: 'stopped', external: false, externalInfo: null, lastError: null })
    }
  }

  /** 停止外部启动的 DSH 实例（调用方需先经用户确认） */
  async stopExternal(): Promise<{ ok: boolean; error?: string }> {
    const info = this.state.externalInfo
    if (!info) return { ok: false, error: '没有检测到外部 DSH 实例' }
    this.env.log.warn('runtime', `强制停止外部 DSH 实例（PID ${info.pid}）`)
    await this.killTree(info.pid)
    await new Promise((r) => setTimeout(r, 500))
    this.set({ status: 'stopped', pid: null, url: null, lastError: null, external: false, externalInfo: null })
    this.env.log.info('runtime', '外部 DSH 实例已停止')
    return { ok: true }
  }

  private killTree(pid: number): Promise<void> {
    return new Promise((resolve) => {
      execFile('taskkill', ['/PID', String(pid), '/T', '/F'], { windowsHide: true }, () => resolve())
    })
  }
}