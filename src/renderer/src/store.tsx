import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { AppState, LogLine, SetupProgress } from '../../shared/types'

interface Store {
  state: AppState | null
  logs: LogLine[]
  progress: SetupProgress | null
  refresh: () => Promise<void>
  navigate: (page: string) => void
}

const Ctx = createContext<Store>({
  state: null,
  logs: [],
  progress: null,
  refresh: async () => {},
  navigate: () => {}
})

export function useStore(): Store {
  return useContext(Ctx)
}

function mergeLines(prev: LogLine[], lines: LogLine[]): LogLine[] {
  const map = new Map<number, LogLine>()
  for (const l of prev) map.set(l.id, l)
  for (const l of lines) map.set(l.id, l)
  const arr = [...map.values()].sort((a, b) => a.id - b.id)
  return arr.length > 3000 ? arr.slice(arr.length - 3000) : arr
}

export function StoreProvider({
  children,
  navigate
}: {
  children: React.ReactNode
  navigate: (page: string) => void
}): JSX.Element {
  const [state, setState] = useState<AppState | null>(null)
  const [logs, setLogs] = useState<LogLine[]>([])
  const [progress, setProgress] = useState<SetupProgress | null>(null)

  const refresh = useCallback(async () => {
    try {
      const s = await window.dshm.getState()
      setState(s)
    } catch (err) {
      console.error('getState failed', err)
    }
  }, [])

  useEffect(() => {
    void refresh()
    window.dshm.logsSnapshot().then((lines) => setLogs((prev) => mergeLines(prev, lines)))
    const offLogs = window.dshm.onLogs((lines) => setLogs((prev) => mergeLines(prev, lines)))
    const offRuntime = window.dshm.onRuntimeStatus(() => void refresh())
    const offProgress = window.dshm.onProgress(setProgress)
    const iv = setInterval(() => void refresh(), 5000)
    return () => {
      offLogs()
      offRuntime()
      offProgress()
      clearInterval(iv)
    }
  }, [refresh])

  return (
    <Ctx.Provider value={{ state, logs, progress, refresh, navigate }}>{children}</Ctx.Provider>
  )
}
