/**
 * 自动更新占位模块。
 *
 * M1 不启用自动更新（产品定位尚未最终确定）。
 * 后续接入 electron-updater 时：
 *   1. npm i electron-updater
 *   2. 在此实现 checkForUpdates()，用 GitHub Releases 的 latest.yml 做差分更新
 *   3. 在设置页暴露「检查更新」入口与更新进度
 */

export function initUpdater(_onStatus: (msg: string) => void): void {
  // TODO(M2): electron-updater + GitHub Releases
  void _onStatus
}
