import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { App as AntApp, ConfigProvider, theme as antdTheme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './styles.css'

/** Apple 风格字体栈 */
const APPLE_FONT =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Segoe UI Variable Display', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"

function Root(): React.JSX.Element {
  const [dark, setDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const fn = (e: MediaQueryListEvent): void => setDark(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#0071e3',
          colorInfo: '#0071e3',
          colorLink: '#0071e3',
          colorSuccess: '#34c759',
          colorWarning: '#ff9f0a',
          colorError: '#ff3b30',
          borderRadius: 10,
          fontFamily: APPLE_FONT,
          colorBgLayout: 'transparent',
          colorBgContainer: dark ? 'rgba(44, 44, 46, 0.66)' : 'rgba(255, 255, 255, 0.66)',
          colorBgElevated: dark ? '#2c2c2e' : '#ffffff',
          colorBorderSecondary: dark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          boxShadowTertiary: '0 8px 24px rgba(0, 0, 0, 0.08)',
          boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.10)'
        },
        components: {
          Layout: { siderBg: 'transparent', headerBg: 'transparent', bodyBg: 'transparent' },
          Card: { borderRadiusLG: 16 },
          Button: {
            borderRadius: 10,
            fontWeight: 500,
            primaryShadow: '0 2px 8px rgba(0, 113, 227, 0.35)'
          },
          Menu: {
            itemBorderRadius: 8,
            itemHeight: 40,
            iconSize: 16,
            itemSelectedBg: dark ? 'rgba(0, 113, 227, 0.25)' : 'rgba(0, 113, 227, 0.12)',
            itemSelectedColor: '#0071e3'
          },
          Statistic: { titleFontSize: 13 },
          Steps: { iconSize: 28 }
        }
      }}
    >
      <AntApp>
        <App />
      </AntApp>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
