import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import type { Instance, Settings } from '../../shared/types'

export const DEFAULT_SETTINGS: Settings = {
  nodeVersion: '22.20.0',
  dshVersion: 'latest',
  host: '127.0.0.1',
  port: 3080,
  registry: 'https://registry.npmjs.org/',
  autoOpenBrowser: true,
  autoLaunch: false,
  addDshToPath: false,
  mode: 'managed',
  instances: [],
  activeInstanceId: ''
}

export function loadSettings(file: string): Settings {
  let parsed: Partial<Settings> = {}
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<Settings>
  } catch {
    /* 无配置或损坏，用默认值 */
  }
  const merged: Settings = { ...DEFAULT_SETTINGS, ...parsed }
  // 旧版本数据迁移：DSH 0.1.1-rc.2 起使用 node:zlib 的 zstd API（需 Node ≥22.19.0），
  // 0.3.0/0.3.1 默认安装的 22.14.0 会在启动 DSH web 时直接崩溃（createZstdDecompress 不存在），
  // 此处把低于 22.19.0 的存量 nodeVersion 统一升到 22.20.0（仅启动时生效，不覆盖用户显式选择）
  if (lt(merged.nodeVersion, '22.19.0')) {
    merged.nodeVersion = '22.20.0'
  }
  // 旧版本数据迁移：没有实例时，用顶层 host/port 生成默认实例
  if (!Array.isArray(merged.instances) || merged.instances.length === 0) {
    merged.instances = [{ id: 'default', name: '默认实例', host: merged.host, port: merged.port }]
    merged.activeInstanceId = 'default'
  }
  if (!merged.instances.some((i) => i.id === merged.activeInstanceId)) {
    merged.activeInstanceId = merged.instances[0].id
  }
  // 顶层 host/port 与活动实例保持同步（兼容旧 UI 读取）
  const active = getActiveInstance(merged)
  merged.host = active.host
  merged.port = active.port
  return merged
}

/** 严格 semver 数值比较：a < b（a/b 形如 x.y.z；非法版本返回 false，交由既有校验处理） */
function lt(a: string, b: string): boolean {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i]
  }
  return false
}

/** 取活动实例；找不到时回退第一个并修正 activeInstanceId */
export function getActiveInstance(s: Settings): Instance {
  const found = s.instances.find((i) => i.id === s.activeInstanceId)
  if (found) return found
  const first = s.instances[0]
  if (first) {
    s.activeInstanceId = first.id
    return first
  }
  const fallback: Instance = { id: 'default', name: '默认实例', host: s.host, port: s.port }
  s.instances = [fallback]
  s.activeInstanceId = fallback.id
  return fallback
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
  if (next.mode !== 'managed' && next.mode !== 'system') next.mode = 'managed'
  next.autoLaunch = Boolean(next.autoLaunch)
  next.addDshToPath = Boolean(next.addDshToPath)
  // 顶层 port/host 修改时同步到活动实例
  if (patch.port !== undefined || patch.host !== undefined) {
    const active = getActiveInstance(next)
    active.port = next.port
    active.host = next.host
  }
  return next
}