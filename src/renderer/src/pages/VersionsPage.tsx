import { Alert, Button, Card, Descriptions, Select, Space, Tag, Typography, App as AntApp } from 'antd'
import { SwapOutlined, ReloadOutlined, SyncOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'
import { useStore } from '../store'
import type { DshVersionInfo, NodeVersionInfo } from '../../../shared/types'

export default function VersionsPage(): JSX.Element {
  const { state, progress, refresh } = useStore()
  const { message, modal } = AntApp.useApp()

  const [nodeVersions, setNodeVersions] = useState<NodeVersionInfo[]>([])
  const [nodeTarget, setNodeTarget] = useState<string | undefined>(undefined)
  const [dshInfo, setDshInfo] = useState<DshVersionInfo | null>(null)
  const [dshTarget, setDshTarget] = useState<string | undefined>(undefined)
  const [busy, setBusy] = useState<'node' | 'dsh' | null>(null)

  const isSystemMode = state?.settings.mode === 'system'
  const currentNode = state?.node.version ?? null
  const currentDsh = state?.dsh.version ?? null

  const load = async (): Promise<void> => {
    try {
      const nv = await window.dshm.listNodeVersions()
      setNodeVersions(nv)
      setNodeTarget((t) => t ?? nv[0]?.version)
    } catch (err) {
      message.warning(err instanceof Error ? err.message : '获取 Node.js 版本列表失败')
    }
    try {
      const dv = await window.dshm.listDshVersions()
      setDshInfo(dv)
      setDshTarget((t) => t ?? dv.latest)
    } catch (err) {
      message.warning(err instanceof Error ? err.message : '获取 DSH 版本列表失败')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchNode = async (): Promise<void> => {
    if (!nodeTarget) return
    setBusy('node')
    try {
      const res = await window.dshm.switchNode(nodeTarget)
      if (res.ok) {
        message.success(`Node.js 已切换至 v${res.version}`)
      } else {
        message.error(res.error ?? '切换失败')
      }
    } finally {
      setBusy(null)
      void refresh()
      void load()
    }
  }

  const switchDsh = async (): Promise<void> => {
    if (!dshTarget) return
    if (isSystemMode) {
      modal.confirm({
        title: `将系统 DSH 切换至 v${dshTarget}？`,
        content:
          '将使用系统 npm 升级/降级系统安装的 DSH。升级前自动备份，失败自动回滚；如需管理员权限会弹出 UAC。若 DSH 正在运行会先停止。',
        okText: '切换',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: () => doSwitchDsh()
      })
      return
    }
    void doSwitchDsh()
  }

  const doSwitchDsh = async (): Promise<void> => {
    const target = dshTarget
    if (!target) return
    setBusy('dsh')
    try {
      const res = await window.dshm.switchDsh(target)
      if (res.ok) {
        message.success(`DSH 已切换至 v${res.version}`)
      } else {
        message.error(res.error ?? '切换失败')
      }
    } finally {
      setBusy(null)
      void refresh()
      void load()
    }
  }

  if (!state) return <Card loading />

  return (
    <div className="page">
      {isSystemMode && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="接管模式说明"
          description="Node.js 由系统自身管理（不可在此切换）；DSH 可用本页面升级/降级，升级前会自动备份，失败自动回滚。"
        />
      )}

      <Card
        title="Node.js"
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => void load()}>
            刷新列表
          </Button>
        }
      >
        <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="当前版本">
            {currentNode ? (
              <Tag color="blue">v{currentNode}</Tag>
            ) : (
              <Tag>未安装</Tag>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="切换时自动停止 DSH">是</Descriptions.Item>
        </Descriptions>
        <Space wrap>
          <Select
            style={{ width: 200 }}
            value={nodeTarget}
            onChange={setNodeTarget}
            disabled={isSystemMode}
            placeholder="选择目标版本"
            options={nodeVersions.map((v) => ({
              value: v.version,
              label: `v${v.version}（${v.date}）`
            }))}
          />
          <Button
            type="primary"
            icon={<SwapOutlined />}
            disabled={isSystemMode || !nodeTarget || nodeTarget === currentNode || busy !== null}
            loading={busy === 'node'}
            onClick={() => void switchNode()}
          >
            {busy === 'node' ? '切换中...' : '切换版本'}
          </Button>
        </Space>
        {busy === 'node' && progress && (
          <div style={{ marginTop: 12 }}>
            <Typography.Text>{progress.message}</Typography.Text>
            {progress.percent !== null && (
              <div style={{ marginTop: 8 }}>
                <progress value={progress.percent} max={100} style={{ width: '100%' }} />
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title="DSH" style={{ marginTop: 16 }}>
        <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="当前版本">
            {currentDsh ? <Tag color="green">v{currentDsh}</Tag> : <Tag>未安装</Tag>}
          </Descriptions.Item>
          <Descriptions.Item label="最新版本">
            {dshInfo ? <Tag color="gold">v{dshInfo.latest}</Tag> : '-'}
          </Descriptions.Item>
          {isSystemMode && state.system.dshGlobalPrefix && (
            <Descriptions.Item label="安装位置">
              <Typography.Text style={{ fontSize: 12 }}>{state.system.dshGlobalPrefix}</Typography.Text>
            </Descriptions.Item>
          )}
          {isSystemMode && (
            <Descriptions.Item label="权限">
              {state.system.requiresAdmin ? (
                <Tag color="orange">需管理员（将弹 UAC）</Tag>
              ) : (
                <Tag color="green">普通权限</Tag>
              )}
            </Descriptions.Item>
          )}
        </Descriptions>
        <Space wrap>
          <Select
            style={{ width: 200 }}
            value={dshTarget}
            onChange={setDshTarget}
            placeholder="选择目标版本"
            options={(dshInfo?.versions ?? []).map((v) => ({ value: v, label: `v${v}${v === dshInfo?.latest ? '（最新）' : ''}` }))}
          />
          <Button
            type="primary"
            icon={<SyncOutlined />}
            disabled={!dshTarget || dshTarget === currentDsh || busy !== null}
            loading={busy === 'dsh'}
            onClick={() => void switchDsh()}
          >
            {busy === 'dsh' ? '切换中...' : '切换版本'}
          </Button>
        </Space>
        {busy === 'dsh' && progress && (
          <div style={{ marginTop: 12 }}>
            <Typography.Text>{progress.message}</Typography.Text>
          </div>
        )}
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Typography.Text type="secondary">
          提示：切换版本需要联网下载。切换前会先自动停止正在运行的 DSH；接管模式下切换的是系统安装的 DSH（自动备份，失败回滚）。
        </Typography.Text>
      </Card>
    </div>
  )
}