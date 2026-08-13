import { execFile } from 'node:child_process'

/**
 * 用户 PATH 管理（通过注册表 HKCU\Environment）。
 * 新开的终端会从注册表读取 PATH，写入后立即对新终端生效，无需广播。
 */

const REG_KEY = 'HKCU\\Environment'

interface PathEntry {
  value: string
  /** 原始类型（REG_SZ / REG_EXPAND_SZ），写回时保留，避免改变用户环境语义 */
  type: string
}

function regQuery(): Promise<PathEntry | null> {
  return new Promise((resolve) => {
    execFile('reg', ['query', REG_KEY, '/v', 'Path'], { windowsHide: true }, (err, stdout) => {
      if (err) {
        resolve(null)
        return
      }
      const m = stdout.match(/REG_(EXPAND_)?SZ\s+\s*(.*)\s*$/m)
      resolve(m ? { value: m[2].trim(), type: m[1] ? 'REG_EXPAND_SZ' : 'REG_SZ' } : null)
    })
  })
}

function regSet(value: string, type: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      'reg',
      ['add', REG_KEY, '/v', 'Path', '/t', type, '/d', value, '/f'],
      { windowsHide: true },
      (err) => resolve(!err)
    )
  })
}

function splitPath(p: string): string[] {
  return p
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 判断目录是否已在用户 PATH 中（忽略大小写与结尾反斜杠） */
export async function isDirInUserPath(dir: string): Promise<boolean> {
  const raw = await regQuery()
  if (!raw) return false
  const norm = (d: string) => d.replace(/\\+$/, '').toLowerCase()
  return splitPath(raw.value).some((p) => norm(p) === norm(dir))
}

/** 把目录列表插入用户 PATH 开头；返回是否实际发生修改 */
export async function addDirsToUserPath(dirs: string[]): Promise<{ ok: boolean; changed: boolean; error?: string }> {
  try {
    const raw = await regQuery()
    const current = raw ? splitPath(raw.value) : []
    const norm = (d: string) => d.replace(/\\+$/, '').toLowerCase()
    const added = dirs.filter((d) => !current.some((p) => norm(p) === norm(d)))
    if (added.length === 0) return { ok: true, changed: false }
    const next = [...added, ...current]
    const ok = await regSet(next.join(';'), raw?.type ?? 'REG_SZ')
    return ok ? { ok: true, changed: true } : { ok: false, changed: false, error: '写入注册表失败（可能权限不足）' }
  } catch (err) {
    return { ok: false, changed: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 从用户 PATH 中移除目录列表 */
export async function removeDirsFromUserPath(dirs: string[]): Promise<{ ok: boolean; changed: boolean; error?: string }> {
  try {
    const raw = await regQuery()
    if (!raw) return { ok: true, changed: false }
    const norm = (d: string) => d.replace(/\\+$/, '').toLowerCase()
    const targets = new Set(dirs.map(norm))
    const remaining = splitPath(raw.value).filter((p) => !targets.has(norm(p)))
    if (remaining.length === splitPath(raw.value).length) return { ok: true, changed: false }
    const ok = await regSet(remaining.join(';'), raw.type)
    return ok ? { ok: true, changed: true } : { ok: false, changed: false, error: '写入注册表失败（可能权限不足）' }
  } catch (err) {
    return { ok: false, changed: false, error: err instanceof Error ? err.message : String(err) }
  }
}