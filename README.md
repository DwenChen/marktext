<p align="center"><img src="packages/desktop/src/renderer/src/assets/images/logo.png" alt="MarkText" width="96" height="96"></p>

# MarkText

**所见即所得的开源文档编辑器。**

支持 Markdown 可视化编辑与源码编辑，提供文档主题、文件管理，以及 HTML、PDF 和 PNG 导出。本项目围绕所见即所得编辑体验、保存可靠性与排版一致性，持续完善文档编辑功能和性能。

当前版本 **1.0.0**，提供 **Windows x64 安装包和免安装 ZIP**。

[![Release](https://img.shields.io/github/v/release/DwenChen/marktext)](https://github.com/DwenChen/marktext/releases/latest)
[![License](https://img.shields.io/github/license/DwenChen/marktext)](LICENSE)
[![Windows build](https://github.com/DwenChen/marktext/actions/workflows/windows-preview.yml/badge.svg)](https://github.com/DwenChen/marktext/actions/workflows/windows-preview.yml)

[下载](#下载与使用) · [编辑功能与改进](#编辑功能与改进) · [性能记录](#性能记录) · [完整提交记录](#fork-提交记录) · [反馈问题](https://github.com/DwenChen/marktext/issues)

## 下载与使用

| Windows x64 文件                                                                                         | 使用方式                        |
| -------------------------------------------------------------------------------------------------------- | ------------------------------- |
| [安装包](https://github.com/DwenChen/marktext/releases/download/v1.0.0/marktext-win-x64-1.0.0-setup.exe) | 运行安装向导，可选择安装目录    |
| [免安装 ZIP](https://github.com/DwenChen/marktext/releases/download/v1.0.0/marktext-win-x64-1.0.0.zip)   | 解压后运行目录中的 marktext.exe |

[Release 页面](https://github.com/DwenChen/marktext/releases/tag/v1.0.0)同时提供 [SHA-256 校验文件](https://github.com/DwenChen/marktext/releases/download/v1.0.0/SHA256SUMS.txt)和 [构建来源记录](https://github.com/DwenChen/marktext/releases/download/v1.0.0/build-info.json)。

ZIP 使用者如需携带配置，可在可执行文件同级新建 **marktext-user-data** 文件夹，再启动应用。使用 PowerShell 的 Get-FileHash 命令计算下载文件的 SHA-256，与校验文件对照即可。

## 编辑功能与改进

以下按文档编辑、排版、保存与导出归纳本仓库 Fork 后的新增、修复和优化；逐条提交及回退状态见后文。

### 文档主题与导出

- 将**文档主题**与**界面外观**分别设置：GitHub、Academic、Liber 三种文档主题，配合浅色、深色或跟随系统的界面外观；支持导入自定义 CSS。
- 编辑与导出共用文档主题，统一正文、字体、链接和表格排版；表格整体居中，单元格保留 Markdown 中的对齐设置，并整理导出设置的布局与选择控件。
- 增加**整篇文档 PNG 长图导出**，可设置图片宽度；导出前同步当前源码，等待字体和图片加载，完成或失败后释放临时资源。
- 修复 PDF/打印样式与 PNG 的互相干扰，以及导出目录使用旧正文、重复标题和显式锚点定位不一致的问题。

| 输出       | 用途                             |
| ---------- | -------------------------------- |
| HTML       | 导出带有文档主题的 HTML 文件     |
| PDF / 打印 | 生成分页文档，配置页面及页眉页脚 |
| PNG        | 将整篇文档导出为长图             |

### GitHub Alerts

支持 **Note、Tip、Important、Warning、Caution** 五种提示，标题、图标、边线随文档主题和浅色/深色外观显示。编辑、复制、HTML/PDF 导出及打印保留提示语义和样式。

写法如下：

```markdown
> [!NOTE]
> 提示内容可以包含 Markdown 格式。

> [!WARNING]
> 需要读者注意的信息。
```

点击标题可编辑原始标记，移开光标后恢复预览。标记需要独占顶层引用的第一行。参见 [支持说明](docs/GITHUB_ALERTS.md)和 [五种提示演示](docs/github-alerts-showcase.md)。

### 文档切换、导航与统计

- 标签按**发起打开的顺序**追加；快速连续切换会合并中间目标，保留每篇文档的光标、滚动位置和撤销历史，减少切换时的空白闪烁与宽度跳动。
- 文件标题以正文区域居中，跟随窗口与侧栏变化；长路径按可用空间缩小或省略，悬停可查看完整路径，未保存标记保持固定占位。
- 底部状态栏显示全文与选区的**字数、段落数、字符数和总字符数**，点击可切换统计项。
- 大纲支持按 **H1–H6** 控制显示深度，并保留各文档的折叠状态；修复撤销后目录滞后、当前章节高亮偏移和源码模式中的标题跳转。
- 设置窗口按需加载，初始化时先应用所选语言和外观，避免首屏语言不一致及首批文档初始化消息丢失。

### 文件管理与侧栏

- 目录按展开层级**按需加载**，初始扫描只读取当前层的文件信息；目录树仅挂载视口附近的行，文件变更合并处理，降低大目录的扫描和界面更新开销。
- 定位深层文件时按需展开祖先目录；关闭或切换文件夹会释放旧目录监听器，迟到事件不会写入新项目。
- **关闭文件夹后保留已打开文档**及其文件变化监听，方便继续编辑单个文件。
- 侧栏拖动合并布局更新并单独保存宽度；文件区、搜索区空态布局统一，“打开文件夹”按钮高度调整为 **28px**。

更多实现与验证见 [文件夹优化记录](docs/PROJECT_FOLDER_OPTIMIZATION.md)。

### 保存可靠性与源码模式

- 保存请求绑定具体的内容与文件选项快照；写盘期间继续编辑时，旧保存回执不会把新内容误判为已保存。普通保存、另存为、自动保存和批量保存使用一致的状态判断。
- 保存全部、关闭标签或退出前先提交待处理输入；保存失败或取消时保留文档，恢复上次会话的设置也不会跳过未保存确认。
- 会话恢复文件采用串行异步原子写入，合并过期快照并设置最长等待时间，减少主进程同步写盘造成的阻塞。
- 源码与可视化模式共用保存基线；修复源码保存后切回仍显示未保存、隐藏编辑器覆盖源码修改，以及**预览文字与源码叠加**的问题。
- 调整解析选项前先提交当前输入；结构重解析保持可撤销边界。历史应用失败时恢复文档与选区，撤销、重做后的正文和大纲保持同一版本。
- 源码模式隐藏可视化编辑区，保留文档内容与编辑历史；源码光标移动只处理光标和选区，内容变化才提交全文与统计。

详细记录见 [保存、历史与恢复修复](docs/audit-20261011/FIXES.md)。

### 编辑交互与菜单

- 将**段落、格式、视图**入口集中在侧栏顶部，适配展开、窄侧栏和隐藏状态；标题选项采用紧凑排列，保留原生菜单的快捷键、勾选与禁用状态。
- 窗口菜单同步置顶、全屏和缩放百分比，缩放边界禁用对应动作；修正 macOS 窗口按钮与侧栏菜单的层级关系。
- 全选一次覆盖全文，输入框保留自身行为；“复制段落”复制完整块的 Markdown，列表、表格和反向选区保持结构与文档顺序。剪贴板菜单入口同时精简。
- 右键操作根据选择状态提供**在当前块后插入**或**转换选中文字**：表格、代码、引用、数学块及有序/无序列表均可撤销和重做；取消块格式时保留内容。
- 修复分隔线渲染，补充松紧列表和 front matter 的设置说明，移除不可用的设置入口，并保证 Markdown 解析选项切换前提交最新输入。

更多说明见 [菜单、块操作与剪贴板改进](docs/editor-menu-improvements.md)。

## 性能记录

累计优化覆盖文档重复加载、标签切换、侧栏/窗口缩放、源码编辑、目录监听和历史缓存：减少重复解析与全文快照，复用未变块的 Markdown 片段和内容签名，限制缓存容量，并释放废弃文档的监听器、观察器和媒体缓存。

下表为本仓库历史对照测试中的中位数，具体环境和原始数据随记录保存：

| 测量场景                          |   优化前 |  优化后 | 记录                                                        |
| --------------------------------- | -------: | ------: | ----------------------------------------------------------- |
| 3,001 块文档重复加载              | 3,280 ms |  839 ms | [加载与资源释放](docs/performance-optimization-20261010.md) |
| 10,001 块文档同步编辑，空选区探针 |  33.7 ms | 27.2 ms | [万块文档专项研究](docs/audit-20261011/PERFORMANCE.md)      |
| 同一同步编辑路径，已建立光标      |  13.0 ms |  7.7 ms | [万块文档专项研究](docs/audit-20261011/PERFORMANCE.md)      |

这些是固定机器和合成文档的历史采样，分别包含重复加载缓存与局部同步编辑成本，不能换算为应用冷启动时间、实际按键延迟或所有文档的统一提速比例。

## 构建、测试与发布

- Windows 云端构建串联类型检查、lint、相关单元测试、真实 Electron 回归和安装包生成；界面测试置于打包之前，减少失败后的等待时间，并避免重复编译原生模块。
- 回归覆盖打开首篇文档、保存/恢复、菜单与剪贴板、侧栏、主题和导出；测试退出时单独处理临时文档的未保存提示，实际应用的确认行为仍保持。
- 下载采用 **6 路并发、每段 8 MiB**，支持断点续传和失败重试；核对版本、构建提交与 SHA-256 后将安装文件写入 dist。
- Release 复用已通过测试的云端文件，先上传草稿，校验附件摘要后正式发布；版本标签指向文件实际构建的提交。

**1.0.0 的云端验证：83 项单元测试、5 项 Electron 回归全部通过。** [构建记录](https://github.com/DwenChen/marktext/actions/runs/38340906275) · [发布记录](https://github.com/DwenChen/marktext/actions/runs/38347658491)

开发规则和命令见 [AGENTS.md](AGENTS.md)。Windows 流程入口：[构建](https://github.com/DwenChen/marktext/actions/workflows/windows-preview.yml) · [发布](https://github.com/DwenChen/marktext/actions/workflows/windows-release.yml)。

## Fork 提交记录

梳理范围以 Fork 基线 [34ea9931](https://github.com/DwenChen/marktext/commit/34ea9931) 为起点，覆盖本次 README 重写之前的 **27 个本仓库新增提交**，截至 [53ff7981](https://github.com/DwenChen/marktext/commit/53ff7981)。提交链接可查看原始说明与代码差异。

早期四种正文预设已经演进为当前三种文档主题。7bb1d443 和 a0a263ee 的整批 GitHub Markdown/交互改动已在 09420531 回退；当前 Alert 支持来自 d77d6268 的独立实现，分段下载脚本也在该提交恢复。

<details>
<summary>展开全部 27 条 Fork 提交（按提交顺序）</summary>

| 日期       | 提交                                                                                             | 类型               | 修复、新增与优化                                                                                          | 当前状态                         |
| ---------- | ------------------------------------------------------------------------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 2026-10-10 | [e4688d79](https://github.com/DwenChen/marktext/commit/e4688d798e9299c23040c9af6f095839ab3b612e) | 新增 / 优化        | 加入正文风格、底部全文/选区统计与侧栏拖动优化，建立 Windows 云端构建入口                                  | 主题方案已演进，其他保留         |
| 2026-10-10 | [2bceb502](https://github.com/DwenChen/marktext/commit/2bceb5023ef99763a5ce3d6246020ac86ee25a19) | 性能               | 减少重复解析与全文快照，缓存文档状态，释放废弃文档的监听器和媒体资源                                      | 保留                             |
| 2026-10-11 | [545f0b36](https://github.com/DwenChen/marktext/commit/545f0b369fe746a8497c34692bda0a5aa5571ebf) | 新增 / 优化        | 增加 PNG 长图导出和大纲级数控制；优化标签顺序、标题居中及设置窗口初始化                                   | 保留                             |
| 2026-10-11 | [513494c0](https://github.com/DwenChen/marktext/commit/513494c0baaeb019b5d75c1dc9c9649587f33f74) | 修复               | 区分 PNG 与分页导出样式，保留默认打印规则；调整已有运行时复用入口                                         | 保留                             |
| 2026-10-11 | [ccb5d8e9](https://github.com/DwenChen/marktext/commit/ccb5d8e9e6c95a5fc5df22403ee6f97a3ce188ee) | 测试               | 验证从空白启动页创建首篇文档、文档标题更新与编辑器初始化                                                  | 保留                             |
| 2026-10-11 | [895985d3](https://github.com/DwenChen/marktext/commit/895985d371741e6dadbe058b2b9c7273b5373135) | 性能 / 新增        | 目录按需加载、浅层监听、批量更新与视口行渲染；增加关闭文件夹并保留已打开文件                              | 保留                             |
| 2026-10-11 | [46decaa9](https://github.com/DwenChen/marktext/commit/46decaa9eef4da4f1db903838092ceffe68a119c) | 性能               | 合并原生窗口缩放事件，减少连续缩放期间的整篇文档重排                                                      | 保留                             |
| 2026-10-11 | [ee1193ee](https://github.com/DwenChen/marktext/commit/ee1193eee30e4468c02d620127f50901e6438ecd) | 修复 / 优化        | 修复保存快照、关闭提交、恢复写盘、源码保存状态、历史与目录同步；重整外观与导出，优化万块文档路径          | 保留                             |
| 2026-10-11 | [2e098bd2](https://github.com/DwenChen/marktext/commit/2e098bd219bc4e600232227ff04be252d0dd8c60) | 测试               | 使桌面回归匹配新的文档主题、界面外观和导出控件                                                            | 保留                             |
| 2026-10-12 | [e822e96c](https://github.com/DwenChen/marktext/commit/e822e96cde2c52934ea8aa1216fcb4f042ce8a60) | 修复 / 新增        | 集中侧栏菜单入口；调整全选、完整段落复制、右键块插入/转换和关闭确认                                       | 保留                             |
| 2026-10-12 | [ad448226](https://github.com/DwenChen/marktext/commit/ad4482268f30a9ba816e8666d2f8ca7fa7d27c13) | 测试               | 仅在 Electron 测试清理时处理临时文档的未保存提示，保留真实关闭确认行为                                    | 保留                             |
| 2026-10-12 | [cf568e4d](https://github.com/DwenChen/marktext/commit/cf568e4dde14599a170f2b2124c06e633b257e01) | 界面优化           | 压缩侧栏标题区和应用菜单布局，适配展开与收起状态                                                          | 保留                             |
| 2026-10-12 | [45c6f017](https://github.com/DwenChen/marktext/commit/45c6f017927ce73e538451faede657fcb51fd3b4) | 修复               | 调整 macOS 窗口控制按钮与侧栏菜单的层级，保持按钮可操作                                                   | 保留                             |
| 2026-10-12 | [baf0fa49](https://github.com/DwenChen/marktext/commit/baf0fa49f1f59564f649f4c11b6c766e776dd53b) | 测试               | 在 Windows 剪贴板回归中先确认段落光标，减少复制断言的时序误差                                             | 保留                             |
| 2026-10-12 | [b33a56d0](https://github.com/DwenChen/marktext/commit/b33a56d04a74a293993323077360744925414220) | 修复 / 优化        | 修复分隔线渲染，补充 Markdown 设置说明，移除不可用的标题风格控件                                          | 保留                             |
| 2026-10-12 | [e9ecae6d](https://github.com/DwenChen/marktext/commit/e9ecae6dd2bf83ab9394981391d704bfa1b78b7c) | 测试               | 先关闭 Electron，再销毁测试执行环境，修正清理顺序                                                         | 保留                             |
| 2026-10-12 | [be939423](https://github.com/DwenChen/marktext/commit/be939423f80cda14afb87be2579a500a90a1f8c7) | 修复 / 工程        | Markdown 选项切换前提交当前输入，补充段落复制回归并精简云端检查                                           | 保留                             |
| 2026-10-12 | [8d4eee4a](https://github.com/DwenChen/marktext/commit/8d4eee4a03a98f7bcbba958213e46790bc7a6bb5) | 界面优化           | 紧凑展示段落/标题选项，统一文件区与搜索区的文件夹空态布局                                                 | 保留                             |
| 2026-10-12 | [7bb1d443](https://github.com/DwenChen/marktext/commit/7bb1d443997b69970bcd466bc162623eecaab7f6) | 功能尝试           | 增加整批 GitHub Markdown 编辑与导出扩展                                                                   | 已由 09420531 回退               |
| 2026-10-12 | [a0a263ee](https://github.com/DwenChen/marktext/commit/a0a263eee25860bf30da8a9146dc0a6c98959cdd) | 交互尝试           | 调整该批 GitHub Markdown 预览中的几何交互                                                                 | 已由 09420531 回退               |
| 2026-10-12 | [935b8e97](https://github.com/DwenChen/marktext/commit/935b8e97524dab22151f1f7a10764460bc5abd6a) | 下载优化           | 并发分段下载 Windows 构建归档并验证完整性                                                                 | 回退后在 d77d6268 恢复           |
| 2026-10-13 | [09420531](https://github.com/DwenChen/marktext/commit/094205318d04f04f83fd848fbf283e01b41eed9c) | 回退               | 将上述 GitHub Markdown 尝试恢复到 8d4eee4a 的状态                                                         | 历史回退，当前以此为基础继续改进 |
| 2026-10-13 | [d77d6268](https://github.com/DwenChen/marktext/commit/d77d62680500ea3e8998f1d7e16c8d7a30cd3dbe) | 新增 / 修复 / 版本 | 提升版本至 1.0.0；独立实现五种 Alerts 及导出样式，修复源码叠加，将打开文件夹按钮缩小为 28px，恢复分段下载 | 保留                             |
| 2026-10-13 | [21dcdd56](https://github.com/DwenChen/marktext/commit/21dcdd5629a60be1ec771030126a2c0e6e0f8a65) | 测试 / 流程        | 测试先打开侧栏；将 Electron 回归置于打包之前，减少失败等待与归档压缩开销                                  | 保留                             |
| 2026-10-13 | [f720e09a](https://github.com/DwenChen/marktext/commit/f720e09a2638dfeb019fe564ab554b33c2bcc7ba) | 测试               | 测试先关闭已有项目，再验证打开文件夹空态按钮，统一开发与云端的初始状态                                    | 保留；1.0.0 构建提交             |
| 2026-10-13 | [3e163808](https://github.com/DwenChen/marktext/commit/3e16380815fb38c4635ec6ab623a3c6c32bb13ea) | 文档 / 发布        | 重写初版仓库说明，增加校验既有 Windows 构建并发布 Release 的工作流                                        | README 已演进，发布流程保留      |
| 2026-10-13 | [53ff7981](https://github.com/DwenChen/marktext/commit/53ff798161cb33276e6c7d9b4fd0dc4f6bdba478) | 修复 / 发布        | 按 Release ID 校验草稿附件，修复按未发布标签查询草稿导致的 404                                            | 保留                             |

</details>

## 反馈与项目来源

问题和建议提交到 [本仓库 Issues](https://github.com/DwenChen/marktext/issues)，请附版本、复现步骤及必要截图。贡献以 develop 为目标分支，按实际改动选择检查范围。

本项目基于 [MarkText](https://github.com/marktext/marktext) 与 [Muya](https://github.com/marktext/muya) 的既有工作继续开发，保留原作者署名与 [MIT 许可](LICENSE)。本页的新增、修复和优化记录限定为 DwenChen 仓库的 Fork 提交。GitHub Alert 图标采用 [Primer Octicons 的 MIT 许可](packages/desktop/static/licenses/github-alert-icons.LICENSE.txt)。
