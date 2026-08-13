import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import * as http from 'node:http'
import * as https from 'node:https'

export interface ProgressInfo {
  received: number
  total: number | null
  percent: number | null
}

export function get(url: string, redirects = 0): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? https : http
    const req = mod.get(url, (res) => {
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        if (redirects >= 5) {
          reject(new Error(`too many redirects: ${url}`))
          return
        }
        get(res.headers.location, redirects + 1).then(resolve, reject)
        return
      }
      if (status !== 200) {
        res.resume()
        reject(new Error(`HTTP ${status} for ${url}`))
        return
      }
      resolve(res)
    })
    req.on('error', reject)
    req.setTimeout(30_000, () => {
      req.destroy(new Error(`timeout: ${url}`))
    })
  })
}

export async function fetchText(url: string): Promise<string> {
  const res = await get(url)
  let data = ''
  for await (const chunk of res) data += chunk.toString('utf8')
  return data
}

/** 带进度回调的下载（先写 .part 临时文件，成功后 rename） */
export async function downloadFile(
  url: string,
  dest: string,
  onProgress?: (p: ProgressInfo) => void
): Promise<void> {
  const res = await get(url)
  const total = res.headers['content-length'] ? Number(res.headers['content-length']) : null
  let received = 0
  await fsp.mkdir(path.dirname(dest), { recursive: true })
  const tmp = dest + '.part'
  const ws = fs.createWriteStream(tmp)
  try {
    for await (const chunk of res) {
      received += chunk.length
      ws.write(chunk)
      if (onProgress) {
        onProgress({
          received,
          total,
          percent: total ? Math.min(100, Math.round((received / total) * 100)) : null
        })
      }
    }
    ws.end()
    await new Promise<void>((resolve, reject) => {
      ws.on('finish', () => resolve())
      ws.on('error', reject)
    })
    await fsp.rename(tmp, dest)
  } catch (err) {
    ws.destroy()
    await fsp.rm(tmp, { force: true }).catch(() => {})
    throw err
  }
}

export function sha256File(file: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const rs = fs.createReadStream(file)
    rs.on('data', (c) => hash.update(c))
    rs.on('end', () => resolve(hash.digest('hex')))
    rs.on('error', reject)
  })
}
