import { Button, Card, Steps, Typography, App as AntApp, Space } from 'antd'
import { RocketOutlined, CheckOutlined } from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import type { SetupProgress } from '../../../shared/types'

export default function SetupPage(): JSX.Element {
  const { state, logs, progress, refresh } = useStore()
  const { message } = AntApp.useApp()
  const [busy, setBusy] = useState(false)

  const nodeDone = state?.node.installed ?? false
  const dshDone = state?.dsh.installed ?? false
  const running = state?.runtime.status === 'running'

  const current = useMemo(() => {
    if (progress?.step === 'node') return 0
    if (progress?.step === 'dsh') return 1
    if (progress?.step === 'start') return 2
    return nodeDone ? (dshDone ? 2 : 1) : 0
  }, [progress, nodeDone, dshDone])

  const steps = [
    { title: '安装 Node.js', status: nodeDone ? ('finish' as const) : (progress?.step === 'node' ? ('process' as const) : ('wait' as const)) },
    { title: '安装 DSH', status: dshDone ? ('finish' as const) : nodeDone ? (progress?.step === 'dsh' ? ('process' as const) : ('wait' as const)) : ('wait' as const) },
    { title: '启动并打开界面', status: running ? ('finish' as const) : nodeDone && dshDone ? (progress?.step === 'start' ? ('process' as const) : ('wait' as const)) : ('wait' as const) }
  ]

  const deploy = async (): Promise<void> => {
    setBusy(true)
    try {
      const n = await window.dshm.installNode()
      if (!n.ok) throw new Error(n.error ?? 'Node.js 安装失败')
      const d = await window.dshm.installDsh()
      if (!d.ok) throw new Error(d.error ?? 'DSH 安装失败')
      const s = await window.dshm.start()
      if (!s.ok) throw new Error(s.error ?? '启动失败')
      if (state?.settings.autoOpenBrowser && s.url) await window.dshm.openBrowser()
      message.success('部署完成！')
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
      void refresh()
    }
  }

  const preview = logs.slice(-200)

  return (
    <div className="page">
      <Card
        title="一键部署"
        extra={
          <Button type="primary" size="large" icon={<RocketOutlined />} loading={busy} onClick={() => void deploy()}>
            {busy ? '部署中...' : nodeDone && dshDone ? '重新部署' : '一键部署'}
          </Button>
        }
      >
        <Steps current={current} items={steps} />
        {progress && (
          <div style={{ marginTop: 16 }}>
            <Typography.Text>{progress.message}</Typography.Text>
            {progress.percent !== null && (
              <div style={{ marginTop: 8 }}>
                <progress value={progress.percent} max={100} style={{ width: '100%' }} />
              </div>
            )}
          </div>
        )}
        <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
          首次部署需要联网下载 Node.js（约 30MB）并安装 DSH 及其依赖，通常需要几分钟。安装过程全程自动，无需管理员权限。
        </Typography.Paragraph>
      </Card>

      <Card title="安装日志预览" style={{ marginTop: 16 }}>
        <div className="setup-log-preview">
          {preview.length === 0 && <span style={{ color: '#808080' }}>暂无日志</span>}
          {preview.map((l) => (
            <div key={l.id}>
              <span style={{ color: '#6a9955' }}>{l.ts.slice(11, 23)}</span>{' '}
              <span style={{ color: '#569cd6' }}>[{l.source}]</span> {l.text}
            </div>
          ))}
        </div>
      </Card>

      {nodeDone && dshDone && (
        <Card style={{ marginTop: 16 }}>
          <Space>
            <CheckOutlined style={{ color: '#52c41a' }} />
            <Typography.Text>部署已完成。前往「首页」启动 DSH 或直接开始使用。</Typography.Text>
          </Space>
        </Card>
      )}
    </div>
  )
}