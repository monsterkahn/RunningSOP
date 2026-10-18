# 隐私说明

首次安装时不预设共享目录。未连接共享目录时，流程草稿和录制可在本机使用；启用共享目录功能后，目录读取与统计同步按用户此前明确启用的设置运行。本项目不包含供应商云端分析代码。

## 本机处理的数据

- 工作流程匹配在本机完成，主要依据当前标签页 URL；匹配逻辑不读取页面正文或表单值。
- 录制时会读取用户点击控件的可见文字或 `aria-label`、输入控件关联的标签文字、活动弹窗/标签标题、页面标题及脱敏后的 URL。不会读取字段值、密码或验证码内容。控件名称、标题、网址路径及用户手填的工作网址或备注仍可能包含业务信息。
- 查看匹配到的流程时，匿名设备标识和查看计数先保存在本机；用户提交的评价也会作为本机待同步记录保存。
- 本机设置、草稿、录制、备注和待同步记录保存在 Chrome 扩展本机存储中。流程分类是例外：它保存在所选共享目录的 `categories.json`，与流程正文分开。
- 截图预览与标注使用扩展来源的隔离画面，并按标签页、操作模式及有效期校验会话。原网页 DOM 不接收截图字节；临时截图会话在加载后移除图像数据，关闭后清理。不能注入的页面在扩展侧栏内查看。
- 截图只有用户主动触发时才通过浏览器 `getDisplayMedia` 选择界面。扩展仅抓取一帧后停止；画面可能包含个人信息、账号标识、消息或其他页面内容。截图和标记可能保存在本机草稿或用户选择的共享目录中。

卸载扩展可能清除 Chrome 扩展本机存储。清除或卸载前，请先将需要保留的 SOP 发布到自己控制的存储目录并核对内容。当前录制界面不提供备份导出入口。扩展不会自动删除已写入共享目录的历史记录。

## 可选共享目录与后台活动

共享目录由用户明确选择；首次安装时不会自动连接。选择共享目录并授予权限后，扩展根据设置执行以下活动：

- 启用目录自动检查后，浏览器运行期间每分钟读取所选目录中的已发布流程和目录元数据。
- 用户连接统计目录并启用匿名设备统计同步后，查看和评价记录会在浏览器运行期间自动同步到所选目录。每台设备使用独立随机标识；统计不包含工作网址、登录账号或网页输入内容。
- 用户明确触发发布等功能时，将对应流程资料写入所选目录。
- 分类数据写入独立的 `categories.json`，不改写流程正文。

新安装默认关闭目录自动检查和统计同步；选择文件夹只触发一次内容库检查，不自动启用这些后台功能。当前设置页已移除自动检查与统计配置入口，更新安装仍保留旧版已明确启用的设置。共享目录可能由用户或组织托管，其访问者、备份与保留策略由该组织控制；已共享的历史不会自动删除。

## 权限与网络

HTTP(S) 网站来源权限按需请求，用于当前页面上的录制或截图功能；未授权时，相应页面注入功能不可用。在 `file://` 页面运行功能或通过 `file://` 地址读取目录文件，需要在 Chrome 扩展详情中单独启用“允许访问文件网址”。共享文件夹由 Chrome 文件夹选择器授予 File System Access 权限；文件网址开关与文件夹读写授权相互独立。

URL 匹配及录制数据处理在本机进行。扩展不使用第三方云分析服务，也不把流程记录发往 Running SOP 开发者。用户选择的同步存储、Chrome 或共享文件系统服务可能有自己的网络和账户行为。

## 用户控制

用户可以不配置共享目录，只使用本机功能。可以在 Chrome 扩展管理界面撤销网站或文件访问权限，或停用扩展来停止后续扩展活动；这些操作不会删除共享目录已有数据。当前设置界面没有独立的统计同步开关，不能将其描述为仍可在设置中操作。

隐私问题请联系 [gwangphug@gmail.com](mailto:gwangphug@gmail.com)。

## Mobile QR reading

QR codes are generated locally from a user-configured HTTP(S) reader URL and a workflow ID. No QR generation service receives the URL. The dashboard may remember this reader URL in the current browser localStorage. Downloaded or printed QR labels reveal their destination URL and SOP identifier; share them according to your storage access policy. The mobile reader requests the selected catalog, body and images from the same website using its existing session. It does not send ratings, completion records or view statistics. Normal storage web-server access logs, if enabled, are controlled by that server.

## Folder-based library connections

When the user chooses an SOP folder, the extension saves its native directory handle in extension-owned IndexedDB and a random connection identifier with the folder display name in local extension settings. The initial picker requests read access, followed immediately by a read-permission request if needed. If no catalog exists, it requests write access before creating and reading back an empty catalog.json; an invalid existing catalog is not replaced. The same selected directory is used for reading and publishing; publication requests write access when it has not already been granted. Folder display names and icon choices are local metadata and do not rename the actual folder. Existing file URL connections are retained for migration and require Chrome file URL permission, but manual address and catalog-file pickers are no longer exposed in the settings UI. Folder handles are local browser permissions, not credentials transferable to other devices. Library selection does not enable statistics synchronization.
