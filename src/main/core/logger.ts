import * as fs from 'node:fs'
import * as path from 'node:path'
import type { LogLevel, LogLine } from '../../shared/types'

/**
 * 日志中心：内存环形缓冲 + 按天滚动写文件。
 * 渲染进程通过订阅拿到增量行；主进程内部直接调用 info/warn/error。
 */
export class LogHub {
  private lines: LogLine[] = []
  private listeners = new Set<(lines: LogLine[]) => void>()
  private stream: fs.WriteStream | null = null
  private day = ''
  private nextId = 1

  constructor(
    private logsDir: string,
    private maxLines = 5000
  ) {}

  private ensureStream(): void {
    const d = new Date()
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (!this.stream || day !== this.day) {
      this.stream?.end()
      this.stream = null
      fs.mkdirSync(this.logsDir, { recursive: true })
      this.stream = fs.createWriteStream(path.join(this.logsDir, `dsh-manager-${day}.log`), { flags: 'a' })
      this.day = day
    }
  }

  append(level: LogLevel, source: string, text: string): void {
    const ts = new Date().toISOString()
    const line: LogLine = { id: this.nextId++, ts, level, source, text }
    this.lines.push(line)
    if (this.lines.length > this.maxLines) this.lines.splice(0, this.lines.length - this.maxLines)
    try {
      this.ensureStream()
      this.stream?.write(`[${ts}] [${level}] [${source}] ${text}\n`)
    } catch {
      /* 写盘失败不阻塞业务 */
    }
    for (const cb of [...this.listeners]) {
      try {
        cb([line])
      } catch {
        /* 忽略订阅者异常 */
      }
    }
  }

  info(source: string, text: string): void {
    this.append('info', source, text)
  }

  warn(source: string, text: string): void {
    this.append('warn', source, text)
  }

  error(source: string, text: string): void {
    this.append('error', source, text)
  }

  debug(source: string, text: string): void {
    this.append('debug', source, text)
  }

  subscribe(cb: (lines: LogLine[]) => void): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  snapshot(): LogLine[] {
    return [...this.lines]
  }

  clear(): void {
    this.lines = []
  }

  /** 把子进程 stdout/stderr 接进日志中心（按行拆分，保留未换行残余） */
  attachStream(source: string, stream: NodeJS.ReadableStream | null, level: LogLevel = 'info'): void {
    if (!stream) return
    let buf = ''
    stream.on('data', (chunk: Buffer | string) => {
      buf += chunk.toString('utf8')
      let idx: number
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).replace(/\r$/, '')
        buf = buf.slice(idx + 1)
        if (line.trim()) this.append(level, source, line)
      }
    })
    stream.on('end', () => {
      if (buf.trim()) this.append(level, source, buf.trim())
    })
  }

  close(): void {
    this.stream?.end()
    this.stream = null
  }
}
