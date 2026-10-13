<p align="center"><img src="docs/assets/logo-small.png" alt="MarkText" width="96" height="96"></p>

# MarkText

一款开源的所见即所得 Markdown 编辑器，支持源码编辑、文档主题、数学公式、图表，以及 HTML/PDF 导出。

本仓库是 [MarkText](https://github.com/marktext/marktext) 的维护分支，保留原项目的 MIT 许可与作者署名，围绕桌面编辑体验和文档排版继续改进。当前版本为 **1.0.0**，本仓库提供 **Windows x64 安装包和免安装 ZIP**。

[![Release](https://img.shields.io/github/v/release/DwenChen/marktext)](https://github.com/DwenChen/marktext/releases/latest)
[![License](https://img.shields.io/github/license/DwenChen/marktext)](LICENSE)
[![Windows build](https://github.com/DwenChen/marktext/actions/workflows/windows-preview.yml/badge.svg)](https://github.com/DwenChen/marktext/actions/workflows/windows-preview.yml)

[下载最新版本](https://github.com/DwenChen/marktext/releases/latest) · [功能说明](#主要功能) · [开发说明](#开发) · [反馈问题](https://github.com/DwenChen/marktext/issues)

## 下载与使用

在本仓库的 [Releases](https://github.com/DwenChen/marktext/releases) 中下载。1.0.0 的 Windows x64 文件如下：

| 文件                               | 用途                                | 下载                                                                                                         |
| ---------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `marktext-win-x64-1.0.0-setup.exe` | 安装向导，可选择安装目录            | [下载安装包](https://github.com/DwenChen/marktext/releases/download/v1.0.0/marktext-win-x64-1.0.0-setup.exe) |
| `marktext-win-x64-1.0.0.zip`       | 解压后运行 `marktext.exe`，无需安装 | [下载免安装 ZIP](https://github.com/DwenChen/marktext/releases/download/v1.0.0/marktext-win-x64-1.0.0.zip)   |
| `SHA256SUMS.txt`                   | 安装包和 ZIP 的 SHA-256 校验值      | [下载校验文件](https://github.com/DwenChen/marktext/releases/download/v1.0.0/SHA256SUMS.txt)                 |
| `build-info.json`                  | 版本、源代码提交及云端构建记录      | [查看构建来源](https://github.com/DwenChen/marktext/releases/download/v1.0.0/build-info.json)                |

使用 ZIP 时，如需让配置随应用目录一起保存，请在 `marktext.exe` 同级新建 `marktext-user-data` 文件夹，再启动应用。

下载后可在 PowerShell 中计算文件摘要，与 `SHA256SUMS.txt` 对照：

```powershell
Get-FileHash .\marktext-win-x64-1.0.0-setup.exe -Algorithm SHA256
Get-FileHash .\marktext-win-x64-1.0.0.zip -Algorithm SHA256
```

## 主要功能

- **所见即所得编辑**：支持常用 CommonMark 和 GitHub Flavored Markdown 语法，包括标题、列表、引用、表格和代码块。
- **多种编辑模式**：所见即所得、源码、专注和打字机模式，可按写作习惯切换。
- **文档主题**：内置 GitHub、Academic、Liber 三种主题，支持导入自定义 CSS；文档排版与界面的浅色/深色外观分别设置。
- **GitHub Alerts**：支持 `NOTE`、`TIP`、`IMPORTANT`、`WARNING`、`CAUTION` 五种提示，在编辑、复制和导出中保留 Markdown 语义。
- **公式与图表**：支持 KaTeX 数学公式、Mermaid、PlantUML 等内容，以及 front matter、emoji 和图片粘贴。
- **文件与目录管理**：提供多标签编辑、目录树、搜索和文档大纲。
- **HTML/PDF 导出**：导出沿用选中的文档主题，支持 Alert 的标题、图标、边线和正文排版。

### GitHub Alert 示例

在引用的第一行独立写入 `[!TYPE]`：

```markdown
> [!NOTE]
> 这是一条提示，可以包含 **加粗**、链接和其他 Markdown 内容。

> [!WARNING]
> 请在操作前确认相关信息。
```

> [!NOTE]
> 在 MarkText 中点击 Alert 标题可编辑原始标记，移开光标后恢复标题和图标预览。

标记必须位于顶层引用的第一行；未知类型、转义标记和嵌套引用按普通 Markdown 显示。详细行为见 [Alert 支持说明](docs/GITHUB_ALERTS.md)，也可打开 [演示文档](docs/github-alerts-showcase.md)比较五种样式。

### 1.0.0 更新

- 为内置和自定义文档主题增加 GitHub Alert 渲染，并支持 HTML/PDF 导出及打印。
- 对齐编辑器与导出页面中的 Alert 排版和主题链接样式。
- 将侧栏“打开文件夹”按钮高度调整为 28px。
- 修复源码模式中预览内容与源码文字叠加的问题，切换模式时保留文档内容和编辑历史。

## 开发

项目采用 pnpm workspace：

```text
packages/
  desktop/    Electron 桌面应用：主进程、preload、Vue 界面和测试
  muya/       Markdown 编辑引擎：解析、编辑、渲染和导出
  website/    Next.js 网站与文档
scripts/      工作区工具及发布校验
docs/         项目说明和示例
dist/         云端下载或打包得到的安装文件（不提交到 Git）
```

桌面应用使用 TypeScript、Electron、Vue 3、Pinia、Element Plus 和 electron-vite。测试采用 Vitest 与 Playwright。

开发环境需要 Node.js ≥ 20.19.0，并使用 `package.json` 指定的 **pnpm 10.33.4**。在仓库根目录执行：

```bash
pnpm install
pnpm run dev
```

首次安装会准备 Electron、原生模块和语言资源。已有与当前 Electron 版本匹配的原生模块时，可直接启动开发模式；更换 Electron 版本后需重新运行 `pnpm run rebuild-native`。

常用检查命令：

```bash
pnpm run lint
pnpm run typecheck
pnpm run test:unit
pnpm -C packages/muya test
```

Electron 端到端测试需要先准备应用运行入口。开发测试可复用现有 Electron 和原生模块；Windows 云端流程会在应用编译后运行相关测试，再生成安装包。

更多说明见 [开发规则](AGENTS.md)、[架构文档](packages/website/content/docs/dev/ARCHITECTURE.md)和 [Muya 开发说明](packages/muya/AGENTS.md)。

## Windows 云端构建与发布

1. 将应用改动推送到 `develop`，在提交信息中加入 `[windows-build]`，或手动运行 [Windows Preview Build](https://github.com/DwenChen/marktext/actions/workflows/windows-preview.yml)。
2. 构建完成后，可使用 `node scripts/download-windows-build.mjs download <完整提交号>`，将安装包和 ZIP 分段下载至 `dist`。脚本会校验文件摘要、版本和构建提交。
3. 准备 `docs/releases/vX.Y.Z.md` 发布说明，手动运行 [Publish Windows Release](https://github.com/DwenChen/marktext/actions/workflows/windows-release.yml)，填写成功构建的运行 ID 和版本标签。

发布流程复用该次云端构建的文件，核对来源和 SHA-256 后发布 Release。版本标签指向产物实际构建的提交；`build-info.json` 保留构建记录，便于核对下载文件与源代码。

## 反馈与贡献

请在 [本仓库 Issues](https://github.com/DwenChen/marktext/issues) 中反馈问题，附上版本、复现步骤及必要的截图。Pull Request 以 `develop` 为目标分支；提交前运行与改动相关的检查，代码约定见 [AGENTS.md](AGENTS.md)。

感谢 [MarkText 原作者和贡献者](https://github.com/marktext/marktext/graphs/contributors)以及 [Muya](https://github.com/marktext/muya) 项目。历史上游文档仍可作为参考，下载和本分支问题反馈以本仓库为准。

## 许可

[MIT](LICENSE)。GitHub Alert 图标来自 [Primer Octicons](https://github.com/primer/octicons)，其 [MIT 许可](packages/desktop/static/licenses/github-alert-icons.LICENSE.txt)随应用分发。
