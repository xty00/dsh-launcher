import {
  Alert,
  AutoComplete,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Switch,
  Typography,
  App as AntApp
} from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useStore } from '../store'
import type { Settings } from '../../../shared/types'

const REGISTRY_OPTIONS = [
  { value: 'https://registry.npmjs.org/', label: '官方源（默认）' },
  { value: 'https://registry.npmmirror.com/', label: '淘宝镜像 npmmirror' }
]

export default function SettingsPage(): JSX.Element {
  const { state, refresh } = useStore()
  const { message } = AntApp.useApp()
  const [form] = Form.useForm<Settings>()

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
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
        <Typography.Text type="secondary">数据目录：程序会自动把所有运行时数据放在用户目录下，卸载后不留残留。</Typography.Text>
      </Card>
    </div>
  )
}