# Running SOP v1.1.0

## Changes / 更新

- Lightweight folder-selection guidance: three animation cycles, stops when connected, respects reduced motion and pauses on hidden pages. No animation library or additional permissions.
- Fixed folder-library identifiers on Chrome 116; the minimum browser requirement remains Chrome 116.
- Confirmed cleanup appears only when 10 local drafts fill the limit. Cancel keeps data intact, active recordings cannot be deleted, and published SOPs are not deleted.
- Updated privacy, permissions and installation documentation to reflect the simplified interface. Removed obsolete export claims. Existing SOP data formats and local storage keys remain compatible.

- 文件夹选择增加轻量光圈：仅三轮、已连接后停止、尊重减少动态效果，隐藏页面时暂停。
- 修复 Chrome 116 内容库读取；最低浏览器版本保持不变。
- 本机草稿满 10 份时提供确认清理入口，取消不改变内容、录制中禁止删除，不删除已发布 SOP。
- 重新审查权限与隐私说明，使文档符合当前界面；保留已有数据格式与存储键。

## Verification / 验证

108 core tests passed. The packaged runtime passed 10 browser scenarios on Chromium 151.0.7922.34 and 10 on Chrome for Testing 116.0.5845.96. Includes screenshot annotation persistence and isolation, recording, folder initialization, draft cleanup, dashboard languages and QR reading. See docs/RELEASE-REVIEW-1.1.0.md for scope and limitations.

108 项核心测试通过；从压缩包解出的运行时在新版及 Chrome 116 各通过 10 项浏览器流程。原生系统授权、真实旧硬件和双机共享仍需人工验收，不代表商店审核已完成。

## Downloads / 下载

- **running-sop-extension-v1.1.0.zip**: installation package. Extract it, open chrome://extensions, enable Developer mode, choose Load unpacked, and select the extension/ folder. 解压后在 Chrome 开发者模式中加载 extension/ 文件夹。
- **running-sop-github-v1.1.0.zip**: complete source and documentation / 源码与文档。
- **running-sop-webstore-v1.1.0.zip**: Chrome Web Store upload package for maintainers; not a one-click installer / 商店上传专用包。
- **SHA256SUMS.txt**: package checksums / 文件校验值。

Upgrade by replacing the files in the existing extension directory and reloading the extension. Do not uninstall first if you need to keep local drafts. 升级时替换原加载目录中的文件并重新加载；需要保留本机草稿时不要先卸载。

New installs do not connect to a library or enable statistics synchronization by default. Users choose their own folder and authorize it. SOP content is not automatically translated. UI supports simplified/traditional Chinese, English, Spanish, Russian, Korean and Japanese; the standalone dashboard supports six languages.

The 1.0.0 release is preserved. This GitHub update is separate from the user's pending 1.0.0 Chrome Web Store review; 1.1.0 has not been submitted to that store by this publication.
