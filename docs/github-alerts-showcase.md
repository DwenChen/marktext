# GitHub Alerts

下面依次展示五种 GitHub Alert。点击标题可以编辑 `[!TYPE]` 标记，点击正文或其他段落可恢复标题预览。

> [!NOTE]
> 常规提示：支持 **加粗**、_斜体_、`行内代码` 和 [链接](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts)。

> [!TIP]
> 使用建议：切换 GitHub、Academic、Liber 文档主题，检查颜色、图标和左侧边线。

> [!IMPORTANT]
> 重要信息：切换源码模式后，Alert 的 Markdown 标记应保持完整。

> [!WARNING]
> 警告信息：保存、重新打开以及导出 HTML/PDF 后应保持相同的提示类型。

> [!CAUTION]
> 风险提示：深色外观使用适合暗背景的颜色，打印和导出使用浅色页面。

## 多段正文

> [!note]
> 小写类型也兼容 GitHub 的渲染行为。
>
> - 列表第一项
> - 列表第二项
>
> ```ts
> const message = 'Markdown 原文不会改变'
> ```

## 保持普通引用

> 普通引用保持原来的文档主题样式。

> [!UNKNOWN]
> 未知类型不会变成 Alert。

> [!NOTE] 标记与正文在同一行，保持普通引用。

> \[!TIP]
> 转义后的标记保持普通文字。

> 外层普通引用
>
> > [!WARNING]
> > 嵌套的标记保持普通引用。

- 列表中的引用

  > [!CAUTION]
  > Alert 不在列表内启用。

测试结束。
