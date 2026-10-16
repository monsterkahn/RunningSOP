# Running SOP

**Running SOP** 是一个面向 Chrome 的本地优先工作助手：按当前网页地址推荐工作流程，在侧栏查看步骤、编辑草稿并维护本机记录，并可选择使用本机文件夹共享经过人工确认的流程资料。公开版基于 Chrome Manifest V3。首次安装不预设共享目录；连接目录并启用相应功能后，可按设置自动读取目录或同步统计。本项目不包含供应商云端分析代码。

中文是主要说明语言。公开版版本号：**1.0.0**。

## English overview

Running SOP is a local-first Chrome extension that recommends a workflow from the active page URL and helps users review steps, edit drafts, and maintain local records. Shared-folder access is optional and user-selected. After users enable catalog checks or statistics sync, those tasks run automatically while the browser is active. There is no default shared-folder endpoint or vendor analytics service. See [Privacy](PRIVACY.md), [Installation](docs/INSTALL.md), and [Storage](docs/STORAGE.md).

## 功能概览

- 根据本机当前标签页 URL 匹配工作流程；匹配在本机完成，不读取页面正文或表单值。
- 在侧栏查看流程步骤、编辑本机草稿和记录，并保存用户输入的备注。
- 可主动录制可信用户操作；录制器不采集输入值。用户主动截图或手工填写的内容仍可能包含敏感信息，保存或分享前请检查。
- 支持本机备份与恢复。可选的分类元数据与流程正文分开保存。
- 可选连接用户自己选择的共享文件夹；启用目录自动检查后每分钟读取目录，连接并启用统计同步后自动同步查看与评价记录。发布等操作仍由用户明确触发。
- 提供离线示例、离线核心测试，以及从用户指定共享目录生成总表的工具。

这些功能用于辅助记录和复核，不会自动确认业务结果、替用户审批，也不会代替组织的正式验收流程。

## 获取与安装

本项目不提供 Chrome 网上应用店的一键安装。请从 GitHub **Releases** 下载发布压缩包，解压后在 Chrome 扩展管理页使用“加载已解压的扩展程序”，选择其中的 `extension/` 目录。最低要求 Chrome 116。详见[安装说明](docs/INSTALL.md)。

首次安装时没有预设共享目录。本机录制、草稿/记录和备份可以单独使用；连接共享目录并启用目录自动检查或统计同步后，扩展会按设置后台读取或同步。Chrome 对本地文件访问与文件夹写入分别控制授权，启用方式见[安装说明](docs/INSTALL.md)。

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

打开 `http://localhost:8080/demo-work-page.html`。在扩展设置中将目录地址设置为本仓库 `examples/storage/catalog.json` 的完整 `file:///` 地址，并按安装说明允许文件访问，即可验证自动匹配。`dist/dashboard.html` 是可单独打开的演示总表。示例只在本机运行。

浏览器检查使用 `npx playwright install chromium` 安装测试浏览器，再执行 `npm run test:browser`。打包后的源码与扩展 ZIP 及校验值位于 `dist/`；源码包不包含依赖目录、真实业务资料或本机配置。上传 GitHub 时使用源码目录内容，扩展 ZIP 可作为 Release 附件。

## 界面语言

提供中文、英语、西班牙语、俄语、韩语和日语，可选择跟随浏览器或手动指定。首次安装默认跟随浏览器，不支持的语言回退英语；已有手动选择继续保留。设置和主要录制界面使用离线语言包，未翻译的历史更新说明回退英语。SOP 正文、输入内容和截图不自动翻译。

## 2.5.13 发布检查

本轮检查覆盖录制隐私、截图隔离、原步骤标记保存、并发目录缓存、发布写回核验、统计重试、六种语言及窄侧栏布局。详见 [发布检查清单](docs/RELEASE-CHECKLIST.md)。

`dist/` 包含开发者安装包、GitHub 源码包、商店上传专用包及 SHA256SUMS.txt；商店包的 manifest.json 位于 ZIP 根目录。原生截图选择器、文件夹授权及真实共享盘的双设备体验仍需按清单人工验收。本项目尚未提交或通过 Chrome 网上应用店审核。

## 每份 SOP 的手机二维码

总表内容库中点击“二维码标签”，配置手机可访问的阅读页地址；打开某份 SOP 后点击“手机扫码”可查看或下载它的二维码。二维码固定使用 SOP 编号，更新发布内容后不用重贴；手机阅读页每次打开或点击重新读取时请求当前目录，不会在阅读过程中自动替换步骤。

```sh
npm run build
npm run qr -- examples/storage/catalog.json dist/qr-labels https://storage.example/sop.html
npm run test:qr-browser
```

示例网址只用于演示，请替换为实际部署地址。部署与访问限制见 [手机扫码部署](docs/MOBILE-QR.md)。运行时无新增依赖；编码器 MIT 许可与来源保留于 extension/qr-code.js。

## 选择 SOP 文件夹

设置 → SOP存储地址 → **选择 SOP 文件夹**。选择含 catalog.json 的文件夹，或其已知上级目录；设置会校验内容库并显示名称及数量，读取和发布使用同一位置。本机和已挂载的局域网共享文件夹使用相同操作，不需要输入路径。

“其他选择方式”中可以选择 catalog.json 文件，但需再选择它所在的文件夹，才能读取相邻正文和图片；旧 file:// 地址仍可在收起的高级选项使用。详见 [数据与存储](docs/STORAGE.md)。文件夹原生授权仍可能在重启后需要恢复，未进行真实双机和原生系统选择器验收。

## 2.5.16 连接布局

设置中的 SOP 存储地址采用居中的左右连接卡片：左侧为内容库，右侧为当前电脑。连线依实际检查结果显示状态，检查时短暂播放动画。上次检查时间与读取状态一并展示；这不表示获得写入许可或持续实时在线。

存储器／局域网／本机选择只是当前内容库的位置标记，不会自动挂载服务器或转换手机地址。浏览器不可靠地提供原生文件夹的绝对路径，因此不会虚构 NAS IP。文件夹选择和发布权限逻辑保持不变。

## 2.5.17 总表语言

独立 index 总表右上方可切换中文、英语、西班牙语、俄语、韩语和日语。首次访问跟随浏览器语言，未支持语言使用英语；选择保存在该浏览器。SOP 步骤、分类名称与反馈原文不自动翻译。

## 1.0.0 公开分发基线

此前 2.x 是内部开发编号。本次按公开分发重新编号为 1.0.0，保留完整功能、SOP 格式和存储键。发布包不包含真实业务 SOP、内部存储地址、浏览器数据或密钥。Chrome 商店审核和真实双机验收尚未完成，GitHub 发布不代表已通过商店审核。

## GitHub 下载与自动检查

在仓库 Releases 下载当前版本。提交到 main 后，自动检查核心测试、浏览器流程及打包文件；全部通过后自动创建尚不存在的版本下载页。同一版本已经发布时保留原内容，不覆盖已有附件。升级发布请先修改 package.json 与 manifest.json 版本。
