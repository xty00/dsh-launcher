import { Alert, Button, Card, Col, Row, Space, Statistic, Tag, Typography, App as AntApp } from 'antd'
import {
  CaretRightOutlined,
  StopOutlined,
  GlobalOutlined,
  ReloadOutlined,
  RocketOutlined,
  CheckCircleFilled,
  ExclamationCircleFilled,
  ImportOutlined
} from '@ant-design/icons'
import { useState } from 'react'
import { useStore } from '../store'

const STATUS_META: Record<string, { color: string; text: string }> = {
  stopped: { color: 'default', text: '已停止' },
  starting: { color: 'processing', text: '启动中' },
  running: { color: 'success', text: '运行中' },
  stopping: { color: 'processing', text: '停止中' },
  exited: { color: 'warning', text: '已退出' },
  error: { color: 'error', text: '异常' }
}

export default function HomePage(): JSX.Element {
  const { state, refresh, navigate } = useStore()
  const { message } = AntApp.useApp()
  const [busy, setBusy] = useState(false)

  if (!state) return <Card loading />

  const { runtime, node, dsh, settings, setupDone, system } = state
  const meta = STATUS_META[runtime.status] ?? STATUS_META.stopped
  const isSystemMode = settings.mode === 'system'
  const activeInstance = settings.instances.find((i) => i.id === settings.activeInstanceId) ?? settings.instances[0]

  const handleStart = async (): Promise<void> => {
    setBusy(true)
    try {
      const res = await window.dshm.start()
      if (res.ok) {
        message.success(res.url ? `已启动：${res.url}` : '已启动')
        if (settings.autoOpenBrowser && res.url) await window.dshm.openBrowser()
      } else {
        message.error(res.error ?? '启动失败，请查看日志')
      }
    } finally {
      setBusy(false)
      void refresh()
    }
  }

  const handleStop = async (): Promise<void> => {
    setBusy(true)
    try {
      await window.dshm.stop()
      message.success('已停止')
    } finally {
      setBusy(false)
      void refresh()
    }
  }

  const handleAdopt = async (): Promise<void> => {
    const res = await window.dshm.adoptSystem()
    if (res.ok) {
      message.success('已切换为接管系统部署')
    } else {
      message.error(res.error ?? '接管失败')
    }
    void refresh()
  }

  let banner: React.ReactNode = null
  if (isSystemMode) {
    banner = (
      <Alert
        type="info"
        showIcon
        message="当前为接管模式"
        description={system.detected ? `正在使用系统已安装的 Node.js v${system.nodeVersion} 与 DSH v${system.dshVersion} 进行管理。` : '未检测到系统 DSH，请先在系统中安装 DSH 或切换到自管部署。'}
        action={
          <Button size="small" onClick={() => navigate('settings')}>
            切换部署方式
          </Button>
        }
      />
    )
  } else if (system.detected && !setupDone) {
    banner = (
      <Alert
        type="info"
        showIcon
        message="检测到系统已有部署"
        description={`系统已安装 Node.js v${system.nodeVersion} 与 DSH v${system.dshVersion}，无需重新安装，可以直接接管。`}
        action={
          <Button type="primary" icon={<ImportOutlined />} onClick={() => void handleAdopt()}>
            接管系统部署
          </Button>
        }
      />
    )
  } else if (!setupDone) {
    banner = (
      <Alert
        type="warning"
        showIcon
        message="尚未完成部署"
        description="DeepSeek Harness 需要先安装 Node.js 与 DSH 才能运行。"
        action={
          <Button type="primary" icon={<RocketOutlined />} onClick={() => navigate('setup')}>
            去部署
          </Button>
        }
      />
    )
  }

  return (
    <div className="page">
      {banner}

      <Row gutter={[16, 16]} style={{ marginTop: banner ? 16 : 0 }}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic title="Node.js" value={node.version ?? '未安装'} valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic title="DSH" value={dsh.version ?? '未安装'} valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="运行状态"
              value={meta.text}
              valueStyle={{ fontSize: 20 }}
              prefix={
                runtime.status === 'running' ? (
                  <CheckCircleFilled style={{ color: '#52c41a' }} />
                ) : (
                  <ExclamationCircleFilled style={{ color: '#faad14' }} />
                )
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="监听地址"
              value={runtime.url ?? `${settings.host}:${settings.port}`}
              valueStyle={{ fontSize: 16 }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="操作">
        <Space wrap>
          <Button
            type="primary"
            size="large"
            icon={<CaretRightOutlined />}
            disabled={!setupDone || runtime.status === 'running' || runtime.status === 'starting' || busy}
            loading={runtime.status === 'starting' || (busy && runtime.status !== 'running')}
            onClick={() => void handleStart()}
          >
            启动 DSH
          </Button>
          <Button
            size="large"
            danger
            icon={<StopOutlined />}
            disabled={runtime.status === 'stopped' || runtime.status === 'stopping' || busy}
            loading={runtime.status === 'stopping'}
            onClick={() => void handleStop()}
          >
            停止 DSH
          </Button>
          <Button
            size="large"
            icon={<GlobalOutlined />}
            disabled={runtime.status !== 'running'}
            onClick={() => void window.dshm.openBrowser()}
          >
            打开 Web 界面
          </Button>
          <Button size="large" icon={<ReloadOutlined />} onClick={() => void refresh()}>
            刷新状态
          </Button>
        </Space>
        <div style={{ marginTop: 16 }}>
          <Typography.Text type="secondary">
            {isSystemMode ? (
              <>提示：当前管理的是系统安装的 DSH。关闭本应用不会停止 DSH 服务，它会继续在后台运行。</>
            ) : (
              <>提示：关闭本应用不会停止 DSH 服务，它会在后台继续运行；需要停止时点击「停止 DSH」。</>
            )}
          </Typography.Text>
        </div>
        {runtime.lastError && (
          <div style={{ marginTop: 8 }}>
            <Tag color="red">{runtime.lastError}</Tag>
          </div>
        )}
        {activeInstance && (
          <div style={{ marginTop: 8 }}>
            <Tag color="geekblue">当前实例：{activeInstance.name}（{activeInstance.host}:{activeInstance.port}）</Tag>
          </div>
        )}
      </Card>
    </div>
  )
}