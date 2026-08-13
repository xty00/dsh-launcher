import { fetchText } from './net'
import type { DshVersionInfo, NodeVersionInfo } from '../../shared/types'

const NODE_INDEX = 'https://nodejs.org/dist/index.json'

/** 获取 Node.js 官方发布的版本列表（取最近的 LTS 版本） */
export async function listNodeVersions(): Promise<NodeVersionInfo[]> {
  let text: string
  try {
    text = await fetchText(NODE_INDEX)
  } catch {
    throw new Error('无法连接 nodejs.org 获取版本列表，请检查网络或稍后重试')
  }
  const raw = JSON.parse(text) as { version: string; lts: string | false; date: string }[]
  const lts = raw
    .filter((r) => r.lts !== false)
    .map((r) => ({ version: r.version.replace(/^v/, ''), lts: true, date: r.date.slice(0, 10) }))
  return lts.slice(0, 30)
}

/** 从 npm registry 读取 DSH 的可用版本（最近 20 个稳定版 + latest） */
export async function listDshVersions(registry: string): Promise<DshVersionInfo> {
  const url = new URL('@deepseek-ai/dsh', registry.endsWith('/') ? registry : registry + '/').href
  let text: string
  try {
    text = await fetchText(url)
  } catch {
    throw new Error(`无法从 npm registry 获取 DSH 版本信息：${registry}`)
  }
  const packument = JSON.parse(text) as {
    'dist-tags': { latest: string }
    versions: Record<string, unknown>
  }
  // registry 的 versions 按发布顺序排列，取最近 20 个即可（DSH 目前全为 rc 预发布版，不能按稳定版过滤）
  const recent = Object.keys(packument.versions)
    .filter((v) => !v.includes('+'))
    .slice(-20)
    .reverse()
  return { latest: packument['dist-tags'].latest, versions: recent }
}