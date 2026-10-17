<p align="center"><img src="packages/desktop/src/renderer/src/assets/images/logo.png" alt="MarkText" width="96" height="96"></p>

# MarkText

**面向日常写作的开源 Markdown 桌面编辑器。**

直接编辑排版后的文档，随时切换源码；用列表、图片、表格、公式和图表组织内容，再导出为 HTML、PDF 或 PNG。本仓库是 [marktext/marktext](https://github.com/marktext/marktext) 的维护分支，着重改善中文体验、嵌套编辑和内容可靠性。

[![Release](https://img.shields.io/github/v/release/DwenChen/marktext)](https://github.com/DwenChen/marktext/releases/latest)
[![Windows build](https://github.com/DwenChen/marktext/actions/workflows/windows-preview.yml/badge.svg)](https://github.com/DwenChen/marktext/actions/workflows/windows-preview.yml)
[![License](https://img.shields.io/github/license/DwenChen/marktext)](LICENSE)

当前版本 **1.3.0** · **Windows x64** · [完整更新说明](docs/releases/v1.3.0.md) · [问题反馈](https://github.com/DwenChen/marktext/issues)

## 下载与运行

| 发行文件                                                                                                           | 使用方式                            |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| [Windows 安装程序](https://github.com/DwenChen/marktext/releases/download/v1.3.0/marktext-win-x64-1.3.0-setup.exe) | 运行安装向导，可选择安装目录        |
| [免安装 ZIP](https://github.com/DwenChen/marktext/releases/download/v1.3.0/marktext-win-x64-1.3.0.zip)             | 解压到独立目录后运行 `marktext.exe` |

[Release 页面](https://github.com/DwenChen/marktext/releases/tag/v1.3.0)同时提供 `SHA256SUMS.txt` 与 `build-info.json`，记录下载摘要、源代码提交和云端构建地址。安装程序和 ZIP 均由 GitHub Actions 在 Windows 环境构建。

免安装版如需随目录携带配置，可在可执行文件同级新建 **marktext-user-data** 文件夹，再启动软件。

```powershell
Get-FileHash .\marktext-win-x64-1.3.0-setup.exe -Algorithm SHA256
Get-FileHash .\marktext-win-x64-1.3.0.zip -Algorithm SHA256
```

## 1.3.0：拖动时看清落点

选中文字或图片后，可以拖到目标段落内部，也可以在边界创建独立段落或列表项。落点提示随鼠标更新：

| 提示／操作             | 结果                             |
| ---------------------- | -------------------------------- |
| 文字中的竖线           | 插入目标光标位置；整行文字也适用 |
| 段落或条目边界的横线   | 创建独立段落或列表条目           |
| 列表左侧的不同缩进位置 | 选择对应列表层级                 |
| Ctrl／Alt 拖动         | 复制选中文字或图片               |
| Esc                    | 取消拖动，保留原内容             |
| 按住段落前方标记再拖动 | 移动完整块及其嵌套内容           |

移动支持撤销和重做，修复了复制后拖动嵌套条目引起的渲染错误、文字丢失和空序号残留。移走文字时保留已有子列表；移动单张图片时保留其原位置的子列表。文字拖动后不再自动弹出格式快捷栏，图片工具和缩放手柄也会随拖动收起。

文字拖动适用于同一内容块中的选区。移动完整嵌套结构请使用段落标记；跨多个内容块的文字选区会取消文字拖动。列表中的图片后可按 Enter 继续相同层级的条目。

## 内置离线帮助

“帮助”菜单只提供两个入口：

- **使用帮助**：按 F1 打开，介绍文件管理、编辑、嵌套列表、文字／段落／图片拖动、主题、导入导出等操作；支持搜索和目录跳转，列出当前菜单与自定义快捷键。
- **Markdown 参考**：按实际编辑器实现编写，覆盖 19 个语法主题，提供可复制的原始示例，注明默认开关、扩展条件及图表渲染要求。

手册内置于应用，断网后仍可阅读，打开和关闭不会修改当前文档。远程图片、远程图表数据和默认 PlantUML 服务器仍需要对应资源；Pandoc 转换需要安装并配置 Pandoc。

## 写作与文档管理

| 功能          | 说明                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------ |
| Markdown 编辑 | 即时预览与源码模式，CommonMark、GFM 表格、任务列表和 GitHub Alerts                         |
| 公式与图表    | KaTeX／化学公式、Mermaid、Flowchart、Sequence、Vega-Lite 与 PlantUML；可选扩展在设置中启用 |
| 嵌套结构      | 列表与引用中插入块、在已有父级／子级继续键入、按当前层级取消块格式                         |
| 文件管理      | 文件夹浏览、多标签页、文件监听、搜索替换、大纲和字数统计                                   |
| 外观与专注    | 浅色／深色界面，GitHub、Academic、Liber 文档主题，自定义 CSS、专注与打字机模式             |
| 导出与打印    | HTML、PDF、整篇 PNG 长图，支持文档主题及正文目录显示选项                                   |
| 保存与历史    | 撤销重做、保存快照、未保存确认、会话恢复与源码同步                                         |

在列表或引用中右键，可使用 **在此层级嵌套块格式** 插入表格、代码、引用、数学块或子列表，保留当前正文；**在上一层级键入／在下一层级键入** 用于在已有结构中继续写作。详见 [层级与嵌套操作](docs/BLOCK_NESTING.md)。

更多资料：[GitHub Alerts](docs/GITHUB_ALERTS.md) · [正文目录导出](docs/BODY_TOC_EXPORT.md) · [菜单与剪贴板](docs/editor-menu-improvements.md) · [文件夹管理](docs/PROJECT_FOLDER_OPTIMIZATION.md) · [保存与恢复](docs/audit-20261011/FIXES.md) · [改进历史](docs/FORK_HISTORY.md)。

## 项目结构

项目采用 pnpm 工作区，桌面端使用 Electron、Vue 3 和 TypeScript。

| 目录                | 职责                                             |
| ------------------- | ------------------------------------------------ |
| `packages/desktop`  | 主进程、沙箱预加载桥接、Vue 界面、菜单与桌面打包 |
| `packages/muya`     | Markdown 解析、块树、选区、拖动、历史与渲染      |
| `packages/website`  | 独立的 Next.js 文档网站                          |
| `scripts`           | 依赖准备、本地化、许可与发布校验                 |
| `.github/workflows` | 静态检查、测试、Windows 构建和发布               |

## 本地开发与定向测试

需要 Node.js **20.19+** 和项目指定的 **pnpm 10.33.4**。Windows 原生依赖首次构建需要 Python 和 Visual Studio C++ 工具链。

```powershell
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

安装脚本会准备 Electron、原生模块、本地化和 Muya 类型声明。同一 Electron 版本、平台与架构下，可复用已验证的原生模块；本次本地验证没有重新编译原生模块。

```powershell
# 编译应用，不打安装包
corepack pnpm build:unpack

# 仅验证本次拖动和帮助功能
corepack pnpm -C packages/muya exec vitest run src/editor/__tests__/listImageDrag.spec.ts src/editor/__tests__/imageDragMove.spec.ts src/editor/__tests__/dragDropImage.spec.ts src/ui/__tests__/inlineFormatToolbarDrag.spec.ts --maxWorkers=2 --silent
corepack pnpm -C packages/desktop exec playwright test test/e2e/list-image-drag.spec.ts test/e2e/user-guide.spec.ts --workers=1
corepack pnpm -C packages/desktop exec playwright test test/e2e/sidebar-menu-layout.spec.ts test/e2e/editor-menus-clipboard.spec.ts -g "sidebar header|sidebar menus preserve" --workers=1

# 静态检查
corepack pnpm lint
corepack pnpm typecheck
```

## 云端构建与发布

[Windows Preview Build](.github/workflows/windows-preview.yml) 支持手动运行，也在 `develop` 提交消息包含 `[windows-build]` 时启动。本次功能测试仅运行拖动、图片续写、工具栏、离线帮助和受影响菜单的相关场景，同时执行类型、静态检查和生产构建；之后生成 Windows x64 安装程序与 ZIP，并记录构建来源和 SHA-256。

[Publish Windows Release](.github/workflows/windows-release.yml) 接收成功的构建运行 ID 和匹配版本标签，校验源代码提交与摘要，上传四个附件并核对 GitHub 上的大小及摘要后发布。

## 许可证与致谢

[MIT](LICENSE)。感谢 MarkText、Muya 的原作者、维护者与贡献者。本分支的 Windows 下载由本仓库发布；其他平台可参考源码中的构建配置自行编译。
