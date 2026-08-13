import { Card, Descriptions, Typography, Space } from 'antd'
import { GithubOutlined } from '@ant-design/icons'
import { useStore } from '../store'

export default function AboutPage(): JSX.Element {
  const { state } = useStore()
  return (
    <div className="page">
      <Card title="关于 DSH Manager">
        <Descriptions column={1} bordered size="small" style={{ maxWidth: 560 }}>
          <Descriptions.Item label="应用版本">{state?.appVersion ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="Node.js">{state?.node.version ?? '未安装'}</Descriptions.Item>
          <Descriptions.Item label="DSH">{state?.dsh.version ?? '未安装'}</Descriptions.Item>
          <Descriptions.Item label="监听地址">
            {state ? `${state.settings.host}:${state.settings.port}` : '-'}
          </Descriptions.Item>
        </Descriptions>

        <Space direction="vertical" style={{ marginTop: 24, maxWidth: 560 }}>
          <Typography.Title level={5}>说明</Typography.Title>
          <Typography.Paragraph>
            DSH Launcher 是一个免费开源的 Windows 桌面工具，用于一键部署与管理{' '}
            <Typography.Link href="https://github.com/deepseek-ai/deepseek-harness" target="_blank">
              DeepSeek Harness
            </Typography.Link>
            （DSH）。它负责 Node.js 运行时与 DSH 的安装、升级、启动、停止、日志与端口配置；DSH 自身的完整能力请通过其 Web
            界面使用。
          </Typography.Paragraph>
          <Typography.Paragraph>
            <Space>
              <GithubOutlined />
              <Typography.Link href="https://github.com/deepseek-ai/deepseek-harness" target="_blank">
                DeepSeek Harness 官方仓库
              </Typography.Link>
            </Space>
          </Typography.Paragraph>
          <Typography.Text type="secondary">MIT License · 项目仓库地址待补充（欢迎贡献）</Typography.Text>
        </Space>
      </Card>
    </div>
  )
}