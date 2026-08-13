import { useState } from 'react'
import { Layout, Menu } from 'antd'
import {
  HomeOutlined,
  RocketOutlined,
  FileTextOutlined,
  SettingOutlined,
  InfoCircleOutlined
} from '@ant-design/icons'
import type { ReactNode } from 'react'
import { StoreProvider } from './store'
import HomePage from './pages/HomePage'
import SetupPage from './pages/SetupPage'
import LogsPage from './pages/LogsPage'
import SettingsPage from './pages/SettingsPage'
import AboutPage from './pages/AboutPage'

type PageKey = 'home' | 'setup' | 'logs' | 'settings' | 'about'

const PAGES: { key: PageKey; label: string; icon: ReactNode; el: ReactNode }[] = [
  { key: 'home', label: '首页', icon: <HomeOutlined />, el: <HomePage /> },
  { key: 'setup', label: '部署', icon: <RocketOutlined />, el: <SetupPage /> },
  { key: 'logs', label: '日志', icon: <FileTextOutlined />, el: <LogsPage /> },
  { key: 'settings', label: '设置', icon: <SettingOutlined />, el: <SettingsPage /> },
  { key: 'about', label: '关于', icon: <InfoCircleOutlined />, el: <AboutPage /> }
]

export default function App(): JSX.Element {
  const [page, setPage] = useState<PageKey>('home')

  return (
    <StoreProvider navigate={(p) => setPage(p as PageKey)}>
      <Layout style={{ minHeight: '100vh' }}>
        <Layout.Sider theme="dark" width={200}>
          <div className="brand">DSH Launcher</div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[page]}
            onClick={({ key }) => setPage(key as PageKey)}
            items={PAGES.map((p) => ({ key: p.key, icon: p.icon, label: p.label }))}
          />
        </Layout.Sider>
        <Layout>
          <Layout.Content style={{ padding: 24, overflow: 'auto', height: '100vh' }}>
            {PAGES.find((p) => p.key === page)!.el}
          </Layout.Content>
        </Layout>
      </Layout>
    </StoreProvider>
  )
}