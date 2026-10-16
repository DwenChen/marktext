# Fork 改进与历史记录

以下记录保留自 1.0.1 的项目说明，后续功能见仓库 README 和各版本发布说明。

## 性能记录

累计优化覆盖文档重复加载、标签切换、侧栏/窗口缩放、源码编辑、目录监听和历史缓存：减少重复解析与全文快照，复用未变块的 Markdown 片段和内容签名，限制缓存容量，并释放废弃文档的监听器、观察器和媒体缓存。

下表为本仓库历史对照测试中的中位数，具体环境和原始数据随记录保存：

| 测量场景                          |   优化前 |  优化后 | 记录                                                   |
| --------------------------------- | -------: | ------: | ------------------------------------------------------ |
| 3,001 块文档重复加载              | 3,280 ms |  839 ms | [加载与资源释放](performance-optimization-20261010.md) |
| 10,001 块文档同步编辑，空选区探针 |  33.7 ms | 27.2 ms | [万块文档专项研究](audit-20261011/PERFORMANCE.md)      |
| 同一同步编辑路径，已建立光标      |  13.0 ms |  7.7 ms | [万块文档专项研究](audit-20261011/PERFORMANCE.md)      |

这些是固定机器和合成文档的历史采样，分别包含重复加载缓存与局部同步编辑成本，不能换算为应用冷启动时间、实际按键延迟或所有文档的统一提速比例。

## 构建、测试与发布

- Windows 云端构建串联类型检查、lint、相关单元测试、真实 Electron 回归和安装包生成；界面测试置于打包之前，减少失败后的等待时间，并避免重复编译原生模块。
- 回归覆盖打开首篇文档、保存/恢复、菜单与剪贴板、侧栏、主题和导出；测试退出时单独处理临时文档的未保存提示，实际应用的确认行为仍保持。
- 下载采用 **6 路并发、每段 8 MiB**，支持断点续传和失败重试；核对版本、构建提交与 SHA-256 后将安装文件写入 dist。
- Release 复用已通过测试的云端文件，先上传草稿，校验附件摘要后正式发布；版本标签指向文件实际构建的提交。

**1.0.1 的云端验证：83 项相关单元测试、7 项 Electron 回归全部通过。** 覆盖正文目录识别与显隐、嵌套列表排版、五种 Alerts、启动和源码模式。[构建记录](https://github.com/DwenChen/marktext/actions/runs/38355796058) · [Release](https://github.com/DwenChen/marktext/releases/tag/v1.0.1)。历史 1.0.0 的 [构建记录](https://github.com/DwenChen/marktext/actions/runs/38340906275)与 [发布记录](https://github.com/DwenChen/marktext/actions/runs/38347658491)仍可查看。

开发规则和命令见 [AGENTS.md](../AGENTS.md)。Windows 流程入口：[构建](https://github.com/DwenChen/marktext/actions/workflows/windows-preview.yml) · [发布](https://github.com/DwenChen/marktext/actions/workflows/windows-release.yml)。

## Fork 提交记录

梳理范围以 Fork 基线 [34ea9931](https://github.com/DwenChen/marktext/commit/34ea9931) 为起点，覆盖截至 1.0.1 功能更新 [5e127bb3](https://github.com/DwenChen/marktext/commit/5e127bb35aa66dbd5eb941a2cf92e5aa7d9c3e03) 的 **30 个本仓库新增提交**。提交链接可查看原始说明与代码差异；后续 README 和发布记录更新见 [完整 Fork 差异](https://github.com/DwenChen/marktext/compare/34ea9931...develop)。

早期四种正文预设已经演进为当前三种文档主题。7bb1d443 和 a0a263ee 的整批 GitHub Markdown/交互改动已在 09420531 回退；当前 Alert 支持来自 d77d6268 的独立实现，分段下载脚本也在该提交恢复。

<details>
<summary>展开 30 条 Fork 提交（按提交顺序）</summary>

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
| 2026-10-13 | [1f043c54](https://github.com/DwenChen/marktext/commit/1f043c54)                                 | 文档               | 按 Fork 基线重写 README，归纳本仓库修复、新增、性能改进及回退状态                                         | 保留                             |
| 2026-10-13 | [169407b6](https://github.com/DwenChen/marktext/commit/169407b6b72017cf3ab19352cb7bc8b0d0abc4d4) | 文档 / 定位        | 明确所见即所得开源文档编辑器的定位，README 使用当前应用的新图标                                           | 保留                             |
| 2026-10-13 | [5e127bb3](https://github.com/DwenChen/marktext/commit/5e127bb35aa66dbd5eb941a2cf92e5aa7d9c3e03) | 修复 / 新增 / 版本 | 提升至 1.0.1；修复三种格式中的嵌套目录排版，增加正文目录导出开关及识别边界，补充针对性云端回归            | 保留；1.0.1 构建提交             |

</details>

## 反馈与项目来源

问题和建议提交到 [本仓库 Issues](https://github.com/DwenChen/marktext/issues)，请附版本、复现步骤及必要截图。贡献以 develop 为目标分支，按实际改动选择检查范围。

本项目基于 [MarkText](https://github.com/marktext/marktext) 与 [Muya](https://github.com/marktext/muya) 的既有工作继续开发，保留原作者署名与 [MIT 许可](../LICENSE)。本页的新增、修复和优化记录限定为 DwenChen 仓库的 Fork 提交。GitHub Alert 图标采用 [Primer Octicons 的 MIT 许可](../packages/desktop/static/licenses/github-alert-icons.LICENSE.txt)。
