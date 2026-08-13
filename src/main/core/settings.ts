import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import type { Settings } from '../../shared/types'

export const DEFAULT_SETTINGS: Settings = {
  nodeVersion: '22.14.0',
  dshVersion: 'latest',
  host: '127.0.0.1',
  port: 3080,
  registry: 'https://registry.npmjs.org/',
  autoOpenBrowser: true
}

export function loadSettings(file: string): Settings {
  try {
    const raw = fs.readFileSync(file, 'utf8')
    const parsed = JSON.parse(raw) as Partial<Settings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(file: string, settings: Settings): Promise<void> {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  await fsp.writeFile(tmp, JSON.stringify(settings, null, 2), 'utf8')
  await fsp.rename(tmp, file)
}

/** 合并补丁并做基础校验，保证设置始终合法 */
export function patchSettings(current: Settings, patch: Partial<Settings>): Settings {
  const next: Settings = { ...current, ...patch }
  if (!Number.isInteger(next.port) || next.port < 1 || next.port > 65535) next.port = 3080
  if (!next.host || next.host.trim() === '' || next.host === '0.0.0.0') next.host = '127.0.0.1'
  if (!next.registry || !/^https?:\/\//.test(next.registry)) next.registry = DEFAULT_SETTINGS.registry
  if (!/^\d+\.\d+\.\d+$/.test(next.nodeVersion)) next.nodeVersion = DEFAULT_SETTINGS.nodeVersion
  if (!next.dshVersion) next.dshVersion = 'latest'
  return next
}
