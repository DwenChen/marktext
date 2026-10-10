# 在云端构建 Windows 体验版

使用 GitHub Actions 的 Windows 2022 构建机编译原生模块、生成安装包和免安装 ZIP。本机只需要下载并运行构建产物，无需安装 C++ 构建工具、Node.js 或 Python。

## 操作步骤

1. 在 GitHub 上 Fork MarkText，或者创建你自己的源码仓库。
2. 将本次修改后的源码、测试和 `.github/workflows/windows-preview.yml` 提交到该仓库。不要上传 `node_modules`、`out` 或 `dist`。当前本地目录没有 `.git`，如果使用 Fork，先克隆 Fork，再复制修改后的文件并提交。
3. 确保 `windows-preview.yml` 已提交到仓库的默认分支。GitHub 只有在默认分支包含手动工作流时才会显示运行按钮。
4. 打开仓库的 **Actions** 页面；如果 Fork 的 Actions 尚未启用，先启用。
5. 选择 **Windows Preview Build**，点击 **Run workflow**，选择包含此次修改的分支并运行。
6. 等待构建成功，打开此次运行，在 **Artifacts** 区域下载 **marktext-windows-x64-preview**。
7. 解压下载的构建产物：运行其中的 `*-setup.exe` 安装，或者继续解压应用 ZIP 后运行 `marktext.exe`，直接体验免安装版。

应用打开后，在 **偏好设置 → 编辑器 → 正文渲染风格** 中选择 GitHub、经典或书籍风格。统计信息显示在底部状态栏。

## 构建范围

- Windows x64；构建环境固定为 Windows 2022，以匹配仓库的 MSVC 2022 配置。
- 完整编译真实原生模块，并运行启动及编辑器回归检查；不使用本地界面验证时的临时替身。
- 仅上传下载产物，不发布 GitHub Release；使用 GitHub 自动提供的令牌，无需配置个人令牌或签名证书。
- 构建产物保留 7 天，过期后可以再次手动构建。

配置文件已在本地准备好，首次云端构建仍需在你自己的 GitHub 仓库中执行。云端运行结果才会确认原生编译、测试和打包是否成功。

## 官方参考

- [GitHub 托管构建机](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Windows 2022 已安装工具](https://github.com/actions/runner-images/blob/main/images/windows/Windows2022-Readme.md)
- [手动运行工作流](https://docs.github.com/actions/managing-workflow-runs/manually-running-a-workflow)
- [下载构建产物](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)
