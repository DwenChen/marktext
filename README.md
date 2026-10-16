<p align="center"><img src="packages/desktop/src/renderer/src/assets/images/logo.png" alt="MarkText" width="96" height="96"></p>

# MarkText

**所见即所得的开源 Markdown 文档编辑器。**

直接编辑排版后的文档，也可随时切换 Markdown 源码。支持文件夹与多标签管理、文档主题，以及 HTML、PDF 和 PNG 导出。本仓库是 [marktext/marktext](https://github.com/marktext/marktext) 的维护分支，持续改进中文使用体验、编辑可靠性和性能。

[![Release](https://img.shields.io/github/v/release/DwenChen/marktext)](https://github.com/DwenChen/marktext/releases/latest)
[![Windows build](https://github.com/DwenChen/marktext/actions/workflows/windows-preview.yml/badge.svg)](https://github.com/DwenChen/marktext/actions/workflows/windows-preview.yml)
[![License](https://img.shields.io/github/license/DwenChen/marktext)](LICENSE)

当前版本 **1.2.0** · **Windows x64** · [更新说明](docs/releases/v1.2.0.md) · [问题反馈](https://github.com/DwenChen/marktext/issues)

## 下载与启动

| 文件                                                                                                             | 使用方式                  |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------- |
| [Windows 安装包](https://github.com/DwenChen/marktext/releases/download/v1.2.0/marktext-win-x64-1.2.0-setup.exe) | 运行向导，选择安装目录    |
| [免安装 ZIP](https://github.com/DwenChen/marktext/releases/download/v1.2.0/marktext-win-x64-1.2.0.zip)           | 解压后运行 `marktext.exe` |

[Release 页面](https://github.com/DwenChen/marktext/releases/tag/v1.2.0)同时提供 `SHA256SUMS.txt` 与 `build-info.json`，用于核对下载摘要和构建来源。安装包和 ZIP 均由 GitHub Actions 在 Windows 环境编译、测试后生成。

免安装版如需随目录携带配置，在可执行文件同级新建 **marktext-user-data** 文件夹，再启动应用。

```powershell
Get-FileHash .\marktext-win-x64-1.2.0-setup.exe -Algorithm SHA256
Get-FileHash .\marktext-win-x64-1.2.0.zip -Algorithm SHA256
```

## 新增：在层级之间继续键入

右键菜单提供 **在上一层级键入** 和 **在下一层级键入**，仅在存在相应层级时显示。

- 在二级列表条目中选择“上一层级”，直接创建新的一级条目，保留当前内容及子列表；继续按 Enter 仍在一级列表内输入。
- 当前条目或引用已有子块时，可选择“下一层级”继续键入。进入子列表新增条目，进入引用新增段落，已有空输入位置会复用。
- 支持有序列表、无序列表、任务列表和引用的混合层级，以及已有表格、代码和数学块；新增输入可撤销／重做。有文字选区时隐藏两个入口。

规则与示例见 [层级键入与嵌套说明](docs/BLOCK_NESTING.md)。

## 在此层级嵌套块格式

在列表条目或引用内右键，选择 **在此层级嵌套块格式**，即可在当前段落后插入新块，保留当前层级和已有文字。例如在父条目中选择“无序列表”，输入子条目后得到：

```markdown
- 父条目
  - 子条目
- 另一个条目
```

- 支持有序列表、无序列表、任务列表条目和引用作为容器，可继续向更深层嵌套。
- 格式与原有右键块菜单一致：**表格、代码围栏、引用块、数学块、有序列表、无序列表**。
- 相同类型也会创建新嵌套块；支持一次撤销、重做，光标自动进入新块。
- “取消块格式”只解除离光标最近的匹配层级，保留父级、兄弟条目和更深层结构。
- 顶层段落、表格单元格、代码及数学内容内部和文字选区禁用此操作；数学解析关闭时隐藏数学入口。

原有“在下方插入块／取消块格式”和“将选中文字转换为”继续保留。容器规则、数学扩展限制和实现说明见 [嵌套块格式](docs/BLOCK_NESTING.md)。

## 编辑与导出

| 功能             | 说明                                                         |
| ---------------- | ------------------------------------------------------------ |
| 可视化与源码编辑 | CommonMark、GFM 表格和任务列表，数学、代码及图表扩展         |
| 文档与界面外观   | GitHub、Academic、Liber 文档主题，浅色／深色界面与自定义 CSS |
| 文档管理         | 文件夹按需加载、多标签切换、文件监听、大纲折叠与字数统计     |
| GitHub Alerts    | Note、Tip、Important、Warning、Caution 五种提示              |
| HTML、PDF、PNG   | 共用文档主题，支持整篇长图和正文目录显示开关                 |
| 保存与历史       | 保存快照、未保存确认、会话恢复、撤销重做与源码同步           |
| 右键与剪贴板     | 整块插入、选区转换、当前层级嵌套、复制完整段落和一次全选全文 |

更多说明：[GitHub Alerts](docs/GITHUB_ALERTS.md) · [正文目录导出](docs/BODY_TOC_EXPORT.md) · [菜单与剪贴板](docs/editor-menu-improvements.md) · [文件夹优化](docs/PROJECT_FOLDER_OPTIMIZATION.md) · [保存与恢复](docs/audit-20261011/FIXES.md)。

历史功能、性能测量与 Fork 提交记录见 [改进与历史记录](docs/FORK_HISTORY.md)。

## 项目结构

项目使用 pnpm 工作区，桌面端采用 Electron、Vue 3 和 TypeScript。

| 目录                | 职责                                                             |
| ------------------- | ---------------------------------------------------------------- |
| `packages/desktop`  | 桌面应用：主进程、沙箱预加载桥接、Vue 界面、原生菜单和安装包配置 |
| `packages/muya`     | Markdown 编辑引擎：解析、块树、选区、历史、渲染与序列化          |
| `packages/website`  | 独立的 Next.js 文档网站                                          |
| `scripts`           | 依赖准备、本地化、许可和发布校验                                 |
| `.github/workflows` | 自动检查、Windows 构建和 Release 发布                            |

## 本地开发

需要 Node.js **20.19+**、项目指定的 **pnpm 10.33.4**，以及对应平台的原生模块构建环境。Windows 原生依赖首次构建需要 Python 和 Visual Studio C++ 工具链。

```powershell
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

首次安装会准备 Electron、原生模块、本地化和 Muya 类型声明。同一 Electron 版本、平台和架构下，可用 `--ignore-scripts` 安装依赖并复用已验证的原生模块构建；本次本地测试采用该方式，没有重新编译原生模块。

```powershell
# 编译应用，不打安装包
corepack pnpm build:unpack

# 仅验证本次层级键入功能
corepack pnpm -C packages/muya exec vitest run src/__tests__/typingLevels.spec.ts --silent
corepack pnpm -C packages/desktop exec vitest run test/unit/specs/context-block-menu.spec.ts test/unit/specs/context-menu-locales.spec.ts
corepack pnpm -C packages/desktop exec playwright test test/e2e/context-typing-levels.spec.ts --workers=1

# 代码和类型检查
corepack pnpm lint
corepack pnpm typecheck
```

## 云端构建与发布

`Windows Preview Build` 在 `develop` 提交消息包含 `[windows-build]` 时启动，也支持手动运行。当前验证范围仅包含层级键入、右键菜单、本地化与相应 Electron 实测；通过后构建 Windows x64 EXE 和 ZIP，并记录提交、构建地址和 SHA-256。

`Publish Windows Release` 使用成功的构建运行 ID 与匹配版本的标签，校验来源与摘要，上传四个附件，再发布 Release。配置见 [构建流程](.github/workflows/windows-preview.yml)和 [发布流程](.github/workflows/windows-release.yml)。

## 许可证与致谢

[MIT](LICENSE)。感谢 MarkText、Muya 原作者、维护者与所有贡献者。本分支的 Windows 下载由本仓库发布；其他平台可参考源码中的构建配置自行编译。
