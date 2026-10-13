# GitHub Alert 支持

MarkText 在所见即所得编辑、复制、HTML/PDF 导出和打印中支持 GitHub 的五种 Alert：`NOTE`、`TIP`、`IMPORTANT`、`WARNING`、`CAUTION`。

```markdown
> [!NOTE]
> 提示内容可以包含 Markdown 行内格式。
```

标记必须是顶层引用的第一行，并独占一行；类型名不区分大小写。正文可以包含多段文字、列表和代码块。未知类型、转义标记、代码示例以及其他元素中的嵌套引用保持普通 Markdown。

编辑器保留原始标记和字符偏移，点击标记时显示可编辑的源码，移开光标时显示标题和图标。Alert 外观跟随浅色/深色外观，并用于 GitHub、Academic、Liber 和自定义文档主题。导出使用浅色页面。

GitHub 建议只在确有必要时使用 Alert，避免连续排列；[演示文档](github-alerts-showcase.md)连续排列五种类型，方便人工比较。

手动验证：

1. 打开演示文档，比较五种提示的边线、标题和图标。
2. 切换浅色/深色外观及三个内置文档主题。
3. 将 `[!NOTE]` 编辑为 `[!TIP]`，检查实时更新，再撤销和重做。
4. 切换源码模式，保存并重新打开，确认标记和正文保持完整。
5. 导出 HTML/PDF，检查多段正文、列表和代码块。
6. 显示左侧栏，检查“打开文件夹”按钮高度为 28px。

规范和图标来源：

- [GitHub 官方 Alert 文档](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts)。大小写、独占一行和嵌套行为另外使用 GitHub Markdown API 核对。
- [Primer Octicons](https://github.com/primer/octicons)，MIT 许可；[图标许可](../packages/desktop/static/licenses/github-alert-icons.LICENSE.txt)随桌面应用一起分发。
