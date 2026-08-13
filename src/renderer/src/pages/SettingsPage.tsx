import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Radio,
  Select,
  Space,
  Switch,
  Typography,
  App as AntApp
} from 'antd'
import { PlusOutlined, SaveOutlined, SyncOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useStore } from '../store'
import type { Instance, Settings } from '../../../shared/types'

const REGISTRY_OPTIONS = [
  { value: 'https://registry.npmjs.org/', label: '官方源（默认）' },
  { value: 'https://registry.npmmirror.com/', label: '淘宝镜像 npmmirror' }
]

export default function SettingsPage(): JSX.Element {
  const { state, refresh } = useStore()
  const { message } = AntApp.useApp()
  const [form] = Form.useForm<Settings>()
  const [updateBusy, setUpdateBusy] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Instance | null>(null)
  const [instForm] = Form.useForm<{ name: string; host: string; port: number }>()

  const openAdd = (): void => {
    setEditing(null)
    instForm.resetFields()
    instForm.setFieldsValue({ name: '', host: '127.0.0.1', port: 3080 })
    setModalOpen(true)
  }

  const openEdit = (inst: Instance): void => {
    setEditing(inst)
    instForm.setFieldsValue({ name: inst.name, host: inst.host, port: inst.port })
    setModalOpen(true)
  }

  const submitInstance = async (): Promise<void> => {
    const values = await instForm.validateFields()
    const res = editing
      ? await window.dshm.instancesUpdate(editing.id, values)
      : await window.dshm.instancesAdd(values.name, values.host, values.port)
    if (res.ok) {
      message.success(editing ? '实例已更新' : '实例已添加')
      setModalOpen(false)
      void refresh()
    } else {
      message.error(res.error ?? '操作失败')
    }
  }

  const removeInstance = async (inst: Instance): Promise<void> => {
    const res = await window.dshm.instancesRemove(inst.id)
    if (res.ok) {
      message.success('实例已删除')
      void refresh()
    } else {
      message.error(res.error ?? '删除失败')
    }
  }

  const activateInstance = async (inst: Instance): Promise<void> => {
    const res = await window.dshm.instancesActivate(inst.id)
    if (res.ok) {
      message.success(`已切换到「${inst.name}」`)
      void refresh()
    } else {
      message.error(res.error ?? '切换失败')
    }
  }

  const checkUpdate = async (): Promise<void> => {
    setUpdateBusy(true)
    try {
      const res = await window.dshm.checkForUpdates()
      if (res.ok && res.available && res.version) {
        message.info(`发现新版本 v${res.version}，正在后台下载...`)
        const dl = await window.dshm.installUpdate()
        if (!dl.ok && dl.error) message.error(dl.error)
      } else if (res.error) {
        message.warning(res.error)
      } else {
        message.success('当前已是最新版本')
      }
    } finally {
      setUpdateBusy(false)
    }
  }

  if (!state) return <Card loading />

  const onFinish = async (values: Settings): Promise<void> => {
    if (values.mode === 'system' && !state.system.detected) {
      message.warning('未检测到系统 DSH，接管模式暂时无法使用；已回退为自管部署')
      values.mode = 'managed'
    }
    try {
      const next = await window.dshm.updateSettings(values)
      form.setFieldsValue(next)
      await refresh()
      message.success('设置已保存（修改端口后需重启 DSH 生效）')
    } catch (err) {
      message.error(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="page">
      <Card title="设置">
        <Form
          form={form}
          layout="vertical"
          initialValues={state.settings}
          onFinish={(v) => void onFinish(v)}
          style={{ maxWidth: 560 }}
        >
          <Form.Item
            label="部署方式"
            name="mode"
            extra={
              state.system.detected ? (
                <>
                  已检测到系统 Node.js v{state.system.nodeVersion} 与 DSH v{state.system.dshVersion}。
                  自管：程序独立安装管理，卸载干净；接管：直接管理系统中已安装的 DSH。
                </>
              ) : (
                '自管：程序独立安装管理 Node.js 与 DSH；接管：直接使用系统已有的部署（当前未检测到系统 DSH）。'
              )
            }
          >
            <Radio.Group>
              <Radio value="managed">自管部署（推荐）</Radio>
              <Radio value="system">接管系统已有部署</Radio>
            </Radio.Group>
          </Form.Item>
          {state.settings.mode === 'system' && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="接管模式下，「升级 / 降级」功能不可用，且需保证系统 DSH 未被卸载。"
            />
          )}
          <Form.Item label="监听端口" name="port" rules={[{ required: true }]}>
            <InputNumber min={1} max={65535} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="监听主机"
            name="host"
            extra="DSH 出于安全原因不支持 0.0.0.0（避免把远程执行能力暴露到网络），本机访问请保持 127.0.0.1。"
          >
            <Select
              options={[{ value: '127.0.0.1', label: '127.0.0.1（仅本机，推荐）' }]}
              disabled
            />
          </Form.Item>
          <Form.Item label="Node.js 版本" name="nodeVersion" extra="部署时使用的版本（需形如 22.14.0），修改后重新部署生效。">
            <Input placeholder="22.14.0" />
          </Form.Item>
          <Form.Item label="DSH 版本" name="dshVersion" extra="latest 表示最新版，也可填精确版本号。">
            <Input placeholder="latest" />
          </Form.Item>
          <Form.Item label="npm 镜像" name="registry" extra="国内网络建议使用淘宝镜像加速安装，也可直接输入自定义地址。">
            <AutoComplete options={REGISTRY_OPTIONS} placeholder="https://registry.npmjs.org/" filterOption />
          </Form.Item>
          <Form.Item label="启动成功后自动打开浏览器" name="autoOpenBrowser" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="开机自启" name="autoLaunch" valuePropName="checked" extra="开启后随系统启动（可配合设置：启动后自动打开 DSH）。">
            <Switch />
          </Form.Item>
          <Form.Item
            label="在终端使用 dsh 命令"
            name="addDshToPath"
            valuePropName="checked"
            extra="开启后把自管 dsh 加入用户 PATH，可在任意新终端直接输入 dsh（不影响当前已打开的终端）。"
          >
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
        <Typography.Text type="secondary">数据目录：程序会自动把所有运行时数据放在用户目录下，卸载后不留残留。</Typography.Text>
        <div style={{ marginTop: 24 }}>
          <Typography.Title level={5}>应用更新</Typography.Title>
          <Button icon={<SyncOutlined />} loading={updateBusy} onClick={() => void checkUpdate()}>
            检查更新
          </Button>
          <Typography.Text type="secondary" style={{ marginLeft: 12 }}>
            通过 GitHub Releases 发布新版本后，可在此一键升级应用本身。
          </Typography.Text>
        </div>
      </Card>

      <Card title="实例管理" style={{ marginTop: 16 }}>
        <Typography.Paragraph type="secondary">
          可配置多个 DSH 实例（不同的名称/端口）。同一时刻只运行一个实例，切换前需先停止当前实例。
        </Typography.Paragraph>
        <List
          size="small"
          dataSource={state.settings.instances}
          renderItem={(inst) => {
            const isActive = inst.id === state.settings.activeInstanceId
            return (
              <List.Item
                actions={[
                  <Button
                    key="activate"
                    type={isActive ? 'primary' : 'default'}
                    size="small"
                    disabled={isActive || (state.runtime.status === 'running' || state.runtime.status === 'starting')}
                    onClick={() => void activateInstance(inst)}
                  >
                    {isActive ? '当前实例' : '设为当前'}
                  </Button>,
                  <Button key="edit" size="small" onClick={() => openEdit(inst)}>
                    编辑
                  </Button>,
                  <Button
                    key="del"
                    size="small"
                    danger
                    disabled={state.settings.instances.length <= 1}
                    onClick={() => void removeInstance(inst)}
                  >
                    删除
                  </Button>
                ]}
              >
                <Space>
                  <Typography.Text strong>{inst.name}</Typography.Text>
                  <Typography.Text type="secondary">
                    {inst.host}:{inst.port}
                  </Typography.Text>
                  {isActive && <Typography.Text type="success">● 运行目标</Typography.Text>}
                </Space>
              </List.Item>
            )
          }}
        />
        <Button style={{ marginTop: 12 }} icon={<PlusOutlined />} onClick={openAdd}>
          添加实例
        </Button>
        <Modal
          title={editing ? '编辑实例' : '添加实例'}
          open={modalOpen}
          onOk={() => void submitInstance()}
          onCancel={() => setModalOpen(false)}
          destroyOnClose
        >
          <Form form={instForm} layout="vertical">
            <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入实例名称' }]}>
              <Input placeholder="例如：项目A / 测试环境" />
            </Form.Item>
            <Form.Item label="主机" name="host" extra="DSH 出于安全原因仅支持本机监听 127.0.0.1。">
              <Input placeholder="127.0.0.1" disabled />
            </Form.Item>
            <Form.Item label="端口" name="port" rules={[{ required: true, message: '请输入端口' }]}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
          </Form>
        </Modal>
      </Card>

      <Card title="模型与 API Key" style={{ marginTop: 16 }}>
        <Typography.Paragraph type="secondary">
          模型、API Key 等 DSH 自身的配置在 DSH 的 Web 界面或配置目录中完成，本工具只负责运行管理：
        </Typography.Paragraph>
        <Space wrap>
          <Button
            disabled={state.runtime.status !== 'running'}
            onClick={() => void window.dshm.openBrowser()}
          >
            打开 DSH Web 界面（配置模型）
          </Button>
          <Button onClick={() => void window.dshm.openPath('dsh-home').then((r) => (r.ok ? message.success('已打开配置目录') : message.error(r.error ?? '打开失败')))}>
            打开 DSH 配置目录（DSH_HOME）
          </Button>
          <Button onClick={() => void window.dshm.openPath('logs').then((r) => (r.ok ? message.success('已打开日志目录') : message.error(r.error ?? '打开失败')))}>
            打开本工具日志目录
          </Button>
        </Space>
      </Card>
    </div>
  )
}