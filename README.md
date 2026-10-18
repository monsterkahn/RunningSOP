# Running SOP

**Running SOP** 是一个面向 Chrome 的本地优先工作助手：按当前网页地址推荐工作流程，在侧栏查看步骤、编辑草稿并维护本机记录，并可选择使用本机文件夹共享经过人工确认的流程资料。公开版基于 Chrome Manifest V3。首次安装不预设共享目录；连接目录并启用相应功能后，可按设置自动读取目录或同步统计。本项目不包含供应商云端分析代码。

当前正式发布版本：**v1.1.0** · [下载正式版](https://github.com/monsterkahn/RunningSOP/releases/latest)

中文是主要说明语言。GitHub 说明仅展示正式发布编号。

## English overview

Running SOP is a local-first Chrome extension that recommends a workflow from the active page URL and helps users review steps, edit drafts, and maintain local records. Shared-folder access is optional and user-selected. After users enable catalog checks or statistics sync, those tasks run automatically while the browser is active. There is no default shared-folder endpoint or vendor analytics service. See [Privacy](PRIVACY.md), [Installation](docs/INSTALL.md), and [Storage](docs/STORAGE.md).

## 功能概览

- 根据本机当前标签页 URL 匹配工作流程；匹配在本机完成，不读取页面正文或表单值。
- 在侧栏查看流程步骤、编辑本机草稿和记录，并保存用户输入的备注。
- 可主动录制可信用户操作；录制器不采集输入值。用户主动截图或手工填写的内容仍可能包含敏感信息，保存或分享前请检查。
- 本机草稿自动保存。当前界面不提供备份导出入口；草稿满 10 份时显示整理入口，需确认后才删除指定本机草稿，不改动存储器 SOP。分类元数据与流程正文分开保存。
- 选择自己有权访问的文件夹后执行一次读取检查；空文件夹经写入授权后初始化内容库。选择时不默认启用后台同步；更新保留旧版曾明确启用的后台设置。发布仍由用户明确触发。
- 提供离线示例、离线核心测试，以及从用户指定共享目录生成总表的工具。

这些功能用于辅助记录和复核，不会自动确认业务结果、替用户审批，也不会代替组织的正式验收流程。

## 获取与安装

本项目不提供 Chrome 网上应用店的一键安装。请从 GitHub **Releases** 下载发布压缩包，解压后在 Chrome 扩展管理页使用“加载已解压的扩展程序”，选择其中的 `extension/` 目录。最低要求 Chrome 116。详见[安装说明](docs/INSTALL.md)。

首次安装时没有预设共享目录。本机录制和草稿可以单独使用；当前设置不再提供统计和自动检查开关，升级保留此前明确启用的设置。Chrome 对本地文件访问与文件夹写入分别控制授权，启用方式见[安装说明](docs/INSTALL.md)。

## 仓库结构

```text
extension/              Chrome Manifest V3 扩展源码
examples/storage/       纯演示流程、空分类文件和合成示意图片
tools/build-dashboard.cjs 从用户指定的共享目录生成总表
tests/                  可移植的离线核心与隔离浏览器测试
package.json            测试与打包命令
dist/                   本地生成的发布产物，不提交
docs/                   安装与存储说明
```

`examples/storage/` 只用于演示，不含真实业务流程、真实截图或用户数据。使用 `tools/build-dashboard.cjs` 时，应由操作者选择共享目录；工具不应假设固定 NAS 地址。详情见[存储说明](docs/STORAGE.md)。

## 开发与贡献

请阅读[贡献指南](CONTRIBUTING.md)及仓库内的 `AGENTS.md`。在本机运行 `npm test` 执行适用测试；`npm run build` 生成本地打包产物。打包内容和测试结果应在发布前复核，`dist/` 默认不进入版本控制。

## Chrome 规范声明

Running SOP 按 [Chrome Manifest V3 扩展规范](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)开发，并依据 [Chrome Web Store 的 Manifest V3 代码要求](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)进行开发者自查：

- 使用 Manifest V3 与事件驱动的后台服务。
- 执行代码随扩展包提供，不下载执行远程脚本；SOP 内容仅作为数据读取和展示。
- 权限与功能对应，HTTP(S) 工作网站权限按需请求，文件夹由用户选择并授权。
- 录制不读取输入框的值；截图由用户主动触发，数据保存在本机或用户选择的存储中。
- 不包含开发者云端分析服务；权限理由、隐私说明和本地验证结果均可在仓库查阅。

This project is developed for Chrome Manifest V3 and has been self-reviewed against the applicable code, permission and user-data requirements described above. This developer statement is not Google certification or confirmation of Chrome Web Store approval.

以上为开发者的规范遵循说明，不代表 Google 认证或 Chrome 网上应用店已审核通过。

## 隐私与安全

- [隐私说明](PRIVACY.md)：记录什么、存在哪里，以及自动同步与用户主动写入的边界。
- [安全说明](SECURITY.md)：权限边界和漏洞报告方式。

作者：**don Kimxote** · [gwangphug@gmail.com](mailto:gwangphug@gmail.com)

本项目按 MIT License 发布，版权年份 2026；完整条款见仓库根目录 `LICENSE`。

## 快速验证演示

需要 Node.js 20 或更新版本。开发测试安装依赖后运行：

```sh
npm ci
npm test
npm run build
npm run demo:server
```

打开 `http://localhost:8080/demo-work-page.html`。在扩展设置中点击文件夹卡片，选择本仓库的 `examples/storage/` 文件夹，即可验证自动匹配。`dist/dashboard.html` 是可单独打开的演示总表。示例只在本机运行。

浏览器检查使用 `npx playwright install chromium` 安装测试浏览器，再执行 `npm run test:browser`。打包后的源码与扩展 ZIP 及校验值位于 `dist/`；源码包不包含依赖目录、真实业务资料或本机配置。上传 GitHub 时使用源码目录内容，扩展 ZIP 可作为 Release 附件。

## 界面语言

提供简体中文、繁体中文、英语、西班牙语、俄语、韩语和日语，可选择跟随浏览器或手动指定。首次安装默认跟随浏览器，不支持的语言回退英语；已有手动选择继续保留。设置和主要录制界面使用离线语言包，未翻译的历史更新说明回退英语。SOP 正文、输入内容和截图不自动翻译。

## 1.1.0 审查

本次结果见 [1.1.0 审查报告](docs/RELEASE-REVIEW-1.1.0.md)，商店权限与数据说明集中在 [CHROMEWEBSTORE.md](CHROMEWEBSTORE.md)。最低浏览器保持 Chrome 116；轻量动画播放三轮后停止，并尊重减少动态效果。

## 每份 SOP 的手机二维码

总表内容库中点击“二维码标签”，配置手机可访问的阅读页地址；打开某份 SOP 后点击“手机扫码”可查看或下载它的二维码。二维码固定使用 SOP 编号，更新发布内容后不用重贴；手机阅读页每次打开或点击重新读取时请求当前目录，不会在阅读过程中自动替换步骤。

```sh
npm run build
npm run qr -- examples/storage/catalog.json dist/qr-labels https://storage.example/sop.html
npm run test:qr-browser
```

示例网址只用于演示，请替换为实际部署地址。部署与访问限制见 [手机扫码部署](docs/MOBILE-QR.md)。运行时无新增依赖；编码器 MIT 许可与来源保留于 extension/qr-code.js。

## 选择 SOP 文件夹

设置 → SOP存储地址 → **点击淡蓝色文件夹区域**。选择 SOP 文件夹后校验内容库并显示名称及数量，读取和发布使用同一位置；没有 catalog.json 时，经写入授权后创建空内容库。本机和已挂载的局域网共享文件夹使用相同操作，不需要输入路径。

当前设置不再提供独立文件选择或手动地址入口；已有连接保留兼容。文件夹原生授权可能在重启后需要恢复，真实双机共享及原生系统授权仍需在目标环境验收。详见 [数据与存储](docs/STORAGE.md)。

## 连接布局

设置使用单个淡蓝色文件夹卡片，引导选择保存位置。未连接或需要重新授权时显示轻量光圈，最多三轮；连接成功后停止，并尊重系统的减少动态效果设置。连接后可修改显示名称，选择文件夹、网络硬盘或本地电脑图标，不会重命名真实文件夹。

连接状态表示最近一次读取检查结果，不代表已获写入授权或持续在线。局域网共享文件夹需先由系统挂载；插件不会自动登录或挂载服务器。

## 总表语言

独立 index 总表右上方可切换中文、英语、西班牙语、俄语、韩语和日语。首次访问跟随浏览器语言，未支持语言使用英语；选择保存在该浏览器。SOP 步骤、分类名称与反馈原文不自动翻译。

## GitHub 下载与自动检查

在仓库 Releases 下载当前版本。提交到 main 后，自动检查核心测试、浏览器流程及打包文件；全部通过后自动创建尚不存在的版本下载页。同一版本已经发布时保留原内容，不覆盖已有附件。升级发布请先修改 package.json 与 manifest.json 版本。
