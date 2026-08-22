import { execFile } from 'node:child_process'
import type { ExternalInstanceInfo } from '../../shared/types'

export type ExternalDetection =
  | { state: 'none' }
  | { state: 'external-dsh'; info: ExternalInstanceInfo }
  | { state: 'other-occupied'; pid: number; commandLine: string | null }

/**
 * 检测活动实例端口上是否有外部启动的 DSH（或其它程序占用）。
 * 仅在 DSH Launcher 自己没有拉起子进程时才有意义。
 */
export async function detectExternalOnPort(host: string, port: number): Promise<ExternalDetection> {
  const pid = await findListeningPid(host, port)
  if (pid === null) return { state: 'none' }

  const info = await getProcessInfo(pid)
  const cmd = info?.commandLine ?? ''
  const isDsh =
    cmd.includes('@deepseek-ai') ||
    cmd.includes('dsh') && (cmd.includes('web') || cmd.includes('bin.js') || cmd.includes('--profile'))

  if (isDsh) {
    return {
      state: 'external-dsh',
      info: { pid, commandLine: cmd || '(无法读取命令行)', startedAt: info?.startedAt ?? null }
    }
  }
  return { state: 'other-occupied', pid, commandLine: cmd }
}

function findListeningPid(host: string, port: number): Promise<number | null> {
  return new Promise((resolve) => {
    execFile('netstat', ['-ano'], { windowsHide: true, timeout: 10_000 }, (err, stdout) => {
      if (err) {
        resolve(null)
        return
      }
      const target = host + ':' + port
      for (const line of stdout.split(/\r?\n/)) {
        // TCP    127.0.0.1:3080    0.0.0.0:0    LISTENING    28396
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 5 && parts[0] === 'TCP' && parts[1] === target && parts[3] === 'LISTENING') {
          const pid = Number(parts[4])
          if (Number.isInteger(pid) && pid > 0) {
            resolve(pid)
            return
          }
        }
      }
      resolve(null)
    })
  })
}

interface ProcInfo {
  commandLine: string
  startedAt: string | null
}

function getProcessInfo(pid: number): Promise<ProcInfo | null> {
  return new Promise((resolve) => {
    const script =
      'Get-CimInstance Win32_Process -Filter "ProcessId=' +
      pid +
      '" | ForEach-Object { $_.CommandLine + "|" + $_.CreationDate.ToString("o") }'
    execFile(
      'powershell',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 10_000 },
      (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve(null)
          return
        }
        const [commandLine, startedAt] = stdout.trim().split('|')
        resolve({ commandLine: commandLine ?? '', startedAt: startedAt || null })
      }
    )
  })
}
