import { Button, Card, Select, Space, Switch, Typography, App as AntApp } from 'antd'
import { ClearOutlined, DownloadOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import type { LogLevel } from '../../../shared/types'

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: '#9cdcfe',
  warn: '#dcdcaa',
  error: '#f48771',
  debug: '#808080'
}

export default function LogsPage(): JSX.Element {
  const { logs, state } = useStore()
  const { message } = AntApp.useApp()
  const isExternal = state?.runtime.external === true && state?.runtime.status === 'running'
  const [filter, setFilter] = useState<LogLevel | 'all'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [logs, autoScroll])

  const shown = filter === 'all' ? logs : logs.filter((l) => l.level === filter)

  const exportLogs = async (): Promise<void> => {
    const res = await window.dshm.exportLogs()
    if (res.ok) {
      message.success(res.path ? `已导出：${res.path}` : '已导出')
    } else {
      message.error(res.error ?? '导出失败')
    }
  }

  return (
    <div className="page">
      <Card
        title="运行日志"
        extra={
          <Space>
            <Select
              value={filter}
              style={{ width: 120 }}
              onChange={setFilter}
              options={[
                { value: 'all', label: '全部' },
                { value: 'info', label: 'Info' },
                { value: 'warn', label: 'Warn' },
                { value: 'error', label: 'Error' },
                { value: 'debug', label: 'Debug' }
              ]}
            />
            <span>自动滚动</span>
            <Switch checked={autoScroll} onChange={setAutoScroll} />
            <Button icon={<ClearOutlined />} onClick={() => message.info('日志已在本页清空（磁盘日志保留）')}>
              清空
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => void exportLogs()}>
              导出
            </Button>
          </Space>
        }
      >
        {isExternal ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              background: 'rgba(255, 159, 10, 0.08)',
              border: '1px dashed rgba(255, 159, 10, 0.4)',
              borderRadius: 12
            }}
          >
            <Typography.Text strong>外部实例，无实时日志</Typography.Text>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
              当前 DSH 实例不是由 DSH Launcher 启动的，无法获取其实时输出。仅展示进程信息：
              <br />
              <Typography.Text code style={{ fontSize: 12 }}>
                PID {state?.runtime.externalInfo?.pid}
              </Typography.Text>
              {state?.runtime.externalInfo?.startedAt && (
                <span style={{ marginLeft: 8 }}>
                  启动于 {new Date(state.runtime.externalInfo.startedAt).toLocaleString()}
                </span>
              )}
              <br />
              <Typography.Text style={{ fontSize: 12, wordBreak: 'break-all' }}>
                {state?.runtime.externalInfo?.commandLine}
              </Typography.Text>
            </Typography.Paragraph>
          </div>
        ) : (
          <div className="log-panel" ref={ref}>
            {shown.length === 0 && <span style={{ color: '#808080' }}>暂无日志</span>}
            {shown.map((l) => (
              <div key={l.id} className={`log-line log-${l.level}`}>
                <span className="ts">{l.ts.slice(11, 23)}</span>
                <span className="lvl" style={{ color: LEVEL_COLOR[l.level] }}>
                  [{l.level.toUpperCase()}]
                </span>
                <span className="src">[{l.source}]</span>
                {l.text}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
