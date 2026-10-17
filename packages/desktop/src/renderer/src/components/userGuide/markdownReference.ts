import type { GuideSection } from './content'

export const markdownSections: GuideSection[] = [
  {
    id: 'syntax-start',
    title: ['阅读方式与语法开关', 'Reading this reference and syntax settings'],
    items: [
      [
        '本参考按本软件的编辑器、预览和内置 HTML 导出实现编写，包含 CommonMark、GFM 及已实现的扩展。示例是可复制的原始 Markdown；手册自身不执行 HTML、不加载示例网址，也不需要联网。',
        'This reference follows the app’s editor, preview and built-in HTML export, covering CommonMark, GFM and implemented extensions. Examples are raw Markdown. The reference does not execute HTML or load example URLs and works offline.'
      ],
      [
        '在普通编辑模式直接输入标记即可即时预览；需要逐字检查缩进、空行和分隔符时，切换“视图 → 源代码模式”。复杂块也可通过“段落”菜单或空段落的 / 插入菜单创建。',
        'Type markup in the editor for live preview. Use View → Source Code Mode to inspect indentation, blank lines and delimiters. Create complex blocks through Paragraph or the / menu in an empty paragraph.'
      ],
      [
        '“首选项 → Markdown”控制扩展。桌面版初始设置启用美元符号公式和 HTML；脚注、上下标、高亮、行内差异、多行引用及另外三种公式语法默认关闭。用户修改后的设置优先于这里描述的初始值。',
        'Preferences → Markdown controls extensions. Desktop defaults enable dollar math and HTML; footnotes, superscript/subscript, highlighting, inline diff, multiline quotes and the other three math syntaxes start disabled. Your saved preferences override these defaults.'
      ],
      [
        '扩展未开启时，对应写法可能作为普通文字保留。内置导出沿用当前语法设置；Pandoc 导入和转换还取决于 Pandoc 版本、格式及其参数。',
        'Disabled extensions may remain literal text. Built-in export follows the syntax settings; Pandoc import and conversion also depend on its version, format and arguments.'
      ]
    ]
  },
  {
    id: 'paragraph-breaks',
    title: ['段落、空行与换行', 'Paragraphs, blank lines and line breaks'],
    items: [
      [
        '空行分隔段落。段内单个换行是软换行；本软件默认按可见换行显示，可在 Markdown 设置中开启“软换行作为空格”。需要可移植的硬换行时，在行尾保留两个空格后换行。',
        'Blank lines separate paragraphs. A single newline inside a paragraph is a soft break, displayed as a newline by default here. Enable Soft Newline as Space to collapse it. Use two trailing spaces before a newline for a portable hard break.'
      ],
      [
        'Enter 创建段落或继续列表，Shift+Enter 在当前段落内换行。列表中要保留同一条目的多段正文，应正确缩进后续段落；不要仅凭空行判断列表层级。',
        'Enter creates a paragraph or continues a list; Shift+Enter breaks a line inside the paragraph. Indent continuation paragraphs to keep them inside the same list item; blank lines alone do not define nesting.'
      ]
    ],
    example: '第一段。\n\n第二段第一行。\n第二段的软换行。\n\n硬换行第一行。  \n硬换行第二行。'
  },
  {
    id: 'headings-rules',
    title: ['标题与分隔线', 'Headings and thematic breaks'],
    items: [
      [
        '# 到 ###### 后加空格创建六级标题。也支持在文字下一行使用 === 或 --- 创建一级或二级 Setext 标题。标题会进入侧栏目录。',
        'Use # through ###### followed by a space for six heading levels. Underline text with === or --- for level-one or level-two Setext headings. Headings populate the sidebar outline.'
      ],
      [
        '单独一行的 ---、*** 或 ___ 可创建分隔线。为避免 --- 被解释为上一行的二级标题下划线，请在分隔线前留空行。',
        'A standalone --- , *** or ___ creates a thematic break. Leave a blank line before --- to avoid interpreting it as a Setext underline.'
      ]
    ],
    example:
      '# 一级标题\n\n## 二级标题\n\n###### 六级标题\n\n另一种一级标题\n================\n\n正文。\n\n---'
  },
  {
    id: 'inline-format',
    title: ['强调、删除线与行内代码', 'Emphasis, strikethrough and inline code'],
    items: [
      [
        '*文字* 或 _文字_ 为斜体，**文字** 或 __文字__ 为加粗，***文字*** 可组合两种效果。成对标记内部的开头和末尾不要留空格。',
        'Use *text* or _text_ for emphasis, **text** or __text__ for strong emphasis, and ***text*** for both. Avoid spaces just inside the paired delimiters.'
      ],
      [
        '~~文字~~ 是 GFM 删除线。反引号包裹行内代码，其中的格式标记按原文显示；代码本身包含反引号时，可使用一对更长的反引号定界符。',
        '~~text~~ is GFM strikethrough. Backticks delimit inline code, where formatting markers stay literal. Use longer backtick delimiters when the code contains a backtick.'
      ]
    ],
    example: '*斜体*  **加粗**  ***加粗斜体***  ~~删除~~\n\n`const total = 1`\n\n``含有 ` 的代码``'
  },
  {
    id: 'lists-tasks',
    title: ['列表、嵌套与任务', 'Lists, nesting and tasks'],
    items: [
      [
        '无序列表用 -、+ 或 * 加空格；有序列表用数字加 . 或 ) 再加空格。使用 Tab / Shift+Tab 或列表缩进菜单调整层级；源代码模式中让子项缩进到父项内容下方。',
        'Use - , + or * plus a space for bullets, and a number followed by . or ) plus a space for ordered lists. Adjust nesting with Tab / Shift+Tab or the list indentation commands. In source mode, indent children beneath the parent content.'
      ],
      [
        '条目正文开头的 [ ] 表示未完成任务，[x] 或 [X] 表示完成任务，后面要有空格。任务标记可用于无序或有序列表；编辑器中可点击复选框切换状态。',
        'Start item text with [ ] for an unchecked task or [x] / [X] for a checked task, followed by a space. Task markers work in bullet and ordered lists; click the checkbox to toggle completion.'
      ],
      [
        '列表条目可以包含多段正文、图片或子列表。图片后可继续当前层级的条目；具体拖动和续写手势见“使用帮助”。松散列表、无序标记、有序分隔符及缩进方式可在 Markdown 设置调整。',
        'Items can contain multiple paragraphs, images and child lists. Continue items at the same level after an image; see User Guide for dragging and continuation gestures. Markdown preferences control loose items, markers, delimiters and indentation.'
      ]
    ],
    example:
      '- 父条目\n  - 子条目\n  - [ ] 待完成\n  - [x] 已完成\n\n1. 第一步\n2. 第二步\n\n- 含图片的条目\n\n  ![说明](./images/example.png)\n\n- 同级的下一条'
  },
  {
    id: 'quotes-alerts',
    title: ['引用与 GitHub 提示块', 'Block quotes and GitHub alerts'],
    items: [
      [
        '引用行以 > 加空格开始；多个 > 可以嵌套。引用内可以包含段落、列表等块。',
        'Start quote lines with > and a space. Repeated > markers nest quotes. Quotes can contain paragraphs, lists and other blocks.'
      ],
      [
        '顶层引用首行单独写 [!NOTE]、[!TIP]、[!IMPORTANT]、[!WARNING] 或 [!CAUTION] 可显示 GitHub 提示块，正文从下一引用行开始。嵌套引用中的相同标记不转换成提示块。',
        'Use [!NOTE], [!TIP], [!IMPORTANT], [!WARNING] or [!CAUTION] alone on the first line of a top-level quote for a GitHub alert, then start its body on the next quoted line. Nested quotes do not become alerts.'
      ]
    ],
    example: '> 引用正文\n>\n> - 引用中的列表\n>\n> > 嵌套引用\n\n> [!NOTE]\n> 这里是说明文字。'
  },
  {
    id: 'links-anchors',
    title: ['链接、引用式链接与锚点', 'Links, reference links and anchors'],
    items: [
      [
        '[文字](目标) 创建链接，可附加引号包裹的标题。支持网页、邮箱及本地相对路径；相对路径以 Markdown 文件所在目录为基准。自动链接可使用 <https://example.com>，GFM 也识别常见裸网址。',
        'Use [text](destination), optionally followed by a quoted title. Web, email and relative local links are supported; local paths resolve from the Markdown file’s directory. Use <https://example.com> for an autolink; GFM also recognizes common bare URLs.'
      ],
      [
        '引用式链接把 [文字][标识] 与单独的 [标识]: 目标 定义配对；也支持折叠或简写形式。导出 HTML 会为标题生成锚点，重名标题追加数字后缀；优先使用软件的“复制标题链接”取得实际目标。',
        'Reference links pair [text][id] with a separate [id]: destination definition; collapsed and shortcut forms also work. HTML export assigns heading anchors and numeric suffixes to duplicates. Use Copy Heading Link for the actual target.'
      ]
    ],
    example:
      '[示例网站](https://example.com "标题")\n\n[本地文档](./notes.md)\n\n<writer@example.com>\n\n[引用式链接][site]\n\n[site]: https://example.com\n\n[跳到标题](#overview)\n\n## Overview'
  },
  {
    id: 'images',
    title: ['图片与尺寸', 'Images and dimensions'],
    items: [
      [
        '![替代文字](图片地址) 插入图片，也支持引用式图片。地址可用本地相对路径或远程 URL；远程图片需要网络，本地图片应随 Markdown 文件一并保存。',
        'Use ![alt text](image source), or a reference-style image. Sources can be relative local paths or remote URLs. Remote images need network access; keep local images with the Markdown file.'
      ],
      [
        '图片可位于段落或列表中。拖放外部图片文件、粘贴图片、调整保存位置等行为取决于图片设置；选中后的移动、复制拖动和缩放操作见“使用帮助”。',
        'Images can appear in paragraphs or lists. External file drops, pasted images and storage behavior follow image preferences. See User Guide for selection, move/copy dragging and resizing.'
      ],
      [
        '需要在源码指定尺寸时可使用 HTML 的 <img src="..." width="...">；渲染需开启 HTML。标准 Markdown 图片语法本身没有通用的宽高参数。',
        'Use HTML <img src="..." width="..."> when dimensions must be explicit in source; enable HTML rendering. Standard Markdown image syntax has no portable width/height parameters.'
      ]
    ],
    example:
      '![图片说明](./images/example.png)\n\n![另一张图][picture]\n\n[picture]: ./images/example.png\n\n<img src="./images/example.png" alt="图片说明" width="320">'
  },
  {
    id: 'tables',
    title: ['GFM 表格', 'GFM tables'],
    items: [
      [
        '表头下一行必须有分隔行，单元格用 | 分隔；分隔行的冒号控制左对齐、居中或右对齐。表格前留空行可避免与前文混淆。',
        'A table needs a header and delimiter row, with cells separated by |. Colons in the delimiter row set left, center or right alignment. Leave a blank line before the table.'
      ],
      [
        '单元格支持行内格式；内容中的竖线写成 \\|。此类表格不表示合并单元格或任意多段块；行列增删、对齐及键盘导航见“使用帮助”。',
        'Cells support inline formatting; escape a literal pipe as \\|. This table syntax does not express merged cells or arbitrary multi-paragraph blocks. See User Guide for row/column editing, alignment and keyboard navigation.'
      ]
    ],
    example:
      '| 左对齐 | 居中 | 右对齐 |\n| :--- | :---: | ---: |\n| **项目** | 内容 | 123 |\n| a\\|b | `code` | 456 |'
  },
  {
    id: 'code-blocks',
    title: ['围栏代码与缩进代码', 'Fenced and indented code'],
    items: [
      [
        '三个或更多反引号或波浪号建立代码围栏，结束围栏使用相同字符且长度不少于开头。开头可写语言名，如 javascript、python 或 json，已支持的语言会高亮显示。',
        'Fence code with at least three backticks or tildes. Close with the same character and at least the opening length. Add a language such as javascript, python or json for supported syntax highlighting.'
      ],
      [
        '四空格缩进也可表示代码块；位于列表中时须额外考虑列表缩进。代码块内的 Markdown 不参与排版。行号、代码字体与自动换行属于显示设置，不会改变代码内容。',
        'Four-space indentation can also create a code block; account for the surrounding indentation inside lists. Markdown inside code stays literal. Line numbers, font and wrapping are display settings and do not alter the code.'
      ]
    ],
    example:
      '```javascript\nconst answer = 42\nconsole.log(answer)\n```\n\n~~~text\n**这里保留星号**\n~~~\n\n    缩进代码块'
  },
  {
    id: 'math-dollars',
    title: ['数学公式：美元符号', 'Math: dollar delimiters'],
    items: [
      [
        '美元符号公式默认开启：$...$ 为行内公式；独立段落中的 $$...$$ 或上下独占一行的 $$ 可作为展示公式。公式使用 KaTeX 支持的 TeX 语法，并包含 mhchem 化学公式扩展。',
        'Dollar math is enabled by default: $...$ is inline math; $$...$$ alone in a paragraph or on separate delimiter lines is display math. Formulas use the TeX syntax supported by KaTeX, including the mhchem chemistry extension.'
      ],
      [
        '行内公式的分隔符与内容之间不要留空格；单行公式中间不要换行。金额与普通美元符号可用 \\$ 转义。无法解析的 TeX 会显示错误提示，可回到公式源码修正。',
        'Avoid spaces immediately inside inline math delimiters and keep inline formulas on one line. Escape a literal dollar sign as \\$. Invalid TeX shows an error; edit the formula source to correct it.'
      ]
    ],
    example:
      '行内公式：$E=mc^2$。\n\n$$\n\\frac{a}{b} + \\sqrt{x}\n$$\n\n化学公式：$\\ce{H2O}$。\n\n价格：\\$10'
  },
  {
    id: 'math-other',
    title: ['可选公式：GFM 与反斜杠', 'Optional math: GFM and backslashes'],
    items: [
      [
        'tex_math_gfm 默认关闭。开启后，$`...`$ 为 GitHub 风格行内公式，语言标记为 math 的代码围栏成为展示公式；关闭时 ```math 保持普通代码块。',
        'tex_math_gfm is disabled by default. Enable it for GitHub-style $`...`$ inline math and display formulas in math code fences. With it disabled, a math fence remains a code block.'
      ],
      [
        'tex_math_single_backslash 默认关闭，开启后支持 \\( ... \\) 和 \\[ ... \\]。tex_math_double_backslash 也默认关闭，开启后支持双反斜杠形式 \\\\( ... \\\\) 和 \\\\[ ... \\\\]。各开关独立，不要求同时启用美元公式。',
        'tex_math_single_backslash is disabled by default; enable it for \\( ... \\) and \\[ ... \\]. tex_math_double_backslash is also disabled by default and enables \\\\( ... \\\\) and \\\\[ ... \\\\]. These switches work independently of dollar math.'
      ],
      [
        '反斜杠方括号公式应独占段落以获得展示模式。开启单反斜杠扩展后，原本用于转义括号的文本可能被识别为公式；只开启文档实际需要的语法。',
        'Put bracket-delimited formulas alone in a paragraph for display mode. Enabling single-backslash math may reinterpret escaped brackets as formulas; enable the syntaxes your document uses.'
      ]
    ],
    example:
      '$`a^2+b^2=c^2`$\n\n```math\n\\sum_{n=1}^{10} n\n```\n\n\\(x+y\\)\n\n\\[x^2+y^2\\]\n\n\\\\(x+y\\\\)\n\n\\\\[x^2+y^2\\\\]'
  },
  {
    id: 'diagrams-local',
    title: ['图表：Mermaid、Flowchart 与 Sequence', 'Diagrams: Mermaid, Flowchart and Sequence'],
    items: [
      [
        '用代码围栏的语言名选择图表：mermaid、flowchart、sequence、vega-lite、plantuml。语言名需使用这些小写写法；普通代码块可以通过修改语言转换为图表。',
        'Select a diagram with one of these lowercase fence languages: mermaid, flowchart, sequence, vega-lite, plantuml. Change a code block’s language to convert it into a diagram.'
      ],
      [
        'Mermaid、Flowchart 和 Sequence 的渲染器随软件提供，可在本地渲染以下简单示例。三种围栏使用各自的语法，不能互换；语法错误时回到图表源码修改。',
        'Mermaid, Flowchart and Sequence renderers ship with the app and can render these simple examples locally. Their syntaxes are distinct; edit the diagram source to fix errors.'
      ]
    ],
    example:
      '```mermaid\nflowchart LR\n  A[开始] --> B[完成]\n```\n\n```flowchart\nst=>start: Start\ne=>end: End\nst->e\n```\n\n```sequence\nAlice->Bob: Hello\nBob-->Alice: OK\n```'
  },
  {
    id: 'diagrams-data-server',
    title: ['图表：Vega-Lite 与 PlantUML', 'Diagrams: Vega-Lite and PlantUML'],
    items: [
      [
        'vega-lite 围栏内容必须是 JSON 图表规格。内联 values 数据可在本地使用；使用远程数据地址仍需相应网络资源。',
        'A vega-lite fence contains a JSON chart specification. Inline values can be used locally; remote data URLs still require their network resources.'
      ],
      [
        'plantuml 使用设置中的 PlantUML 服务器生成图像，默认指向在线服务，离线环境需要可访问的本地服务器。离线参考可阅读 PlantUML 示例，并不代表软件内置了本地 PlantUML 服务。',
        'plantuml requests an image from the configured PlantUML server, which defaults to an online service. Offline rendering requires an accessible local server. Reading this offline reference does not require that server.'
      ]
    ],
    example:
      '```vega-lite\n{\n  "data": {"values": [{"item": "A", "value": 3}, {"item": "B", "value": 5}]},\n  "mark": "bar",\n  "encoding": {\n    "x": {"field": "item", "type": "nominal"},\n    "y": {"field": "value", "type": "quantitative"}\n  }\n}\n```\n\n```plantuml\n@startuml\nAlice -> Bob: Hello\n@enduml\n```'
  },
  {
    id: 'footnotes',
    title: ['脚注（需开启）', 'Footnotes (enable first)'],
    items: [
      [
        '脚注默认关闭。在 Markdown 设置开启后，用 [^标识] 引用，用 [^标识]: 正文 定义；标识中不要包含空格。定义可写在文档后方，多段内容需缩进。',
        'Footnotes are disabled by default. Enable them in Markdown preferences, reference with [^id] and define with [^id]: text. Identifiers must not contain spaces. Definitions can appear later; indent continuation paragraphs.'
      ],
      [
        '同一脚注可多次引用；内置 HTML 导出会生成脚注内容和返回链接。未开启时不要依赖脚注渲染。',
        'A footnote can be referenced multiple times. Built-in HTML export generates footnote content and return links. Do not rely on footnote rendering with the extension disabled.'
      ]
    ],
    example:
      '这里引用脚注[^note]，再次引用[^note]。\n\n[^note]: 脚注的第一段。\n\n    脚注的第二段。'
  },
  {
    id: 'optional-inline',
    title: [
      '上下标、高亮与行内差异（需开启）',
      'Scripts, highlighting and inline diff (enable first)'
    ],
    items: [
      [
        '上下标默认关闭：开启后 x^2^ 表示上标，H~2~O 表示下标。单个 ~ 与删除线的双 ~~ 含义不同；内容中的空格需转义，如 ^a\\ b^。',
        'Superscript/subscript is disabled by default: enable it for x^2^ and H~2~O. Single ~ differs from double-tilde strikethrough. Escape internal spaces, for example ^a\\ b^.'
      ],
      [
        '高亮默认关闭：开启后 ==文字== 产生标记高亮，分隔符内侧不要留空格。文字颜色和背景色工具使用 HTML 表达样式，与 == 高亮语法不同。',
        'Highlighting is disabled by default: enable it for ==text==, without spaces inside the delimiters. Text/background color tools express styling through HTML and are distinct from == highlighting.'
      ],
      [
        '行内差异默认关闭：开启后 {+新增+} 或 [+新增+] 表示增加，{-删除-} 或 [-删除-] 表示删除。起止括号必须配对，内容不能跨行或为空。',
        'Inline diff is disabled by default: enable it for additions {+added+} / [+added+] and deletions {-removed-} / [-removed-]. Brackets must match; content must be nonempty and stay on one line.'
      ]
    ],
    example:
      'x^2^  H~2~O\n\n==需要注意的文字==\n\n{+新增内容+} {-删除内容-}\n\n[+另一种新增+] [-另一种删除-]'
  },
  {
    id: 'multiline-quote',
    title: ['多行引用围栏（需开启）', 'Multiline quote fences (enable first)'],
    items: [
      [
        '多行引用默认关闭。开启后，用独占一行的 >>> 开始和结束引用，内部无需每行重复 >，可以包含列表等 Markdown 块。关闭时完整围栏作为文字保留。',
        'Multiline quotes are disabled by default. Enable them to open and close a quote with >>> on its own line; its body needs no repeated > and may contain Markdown blocks. With the extension disabled, the complete fence stays literal.'
      ]
    ],
    example: '>>>\n第一段引用。\n\n- 引用内的列表\n- 第二项\n>>>'
  },
  {
    id: 'front-matter-toc',
    title: ['Front Matter 与目录', 'Front Matter and contents'],
    items: [
      [
        'Front Matter 需放在文档最开头：--- 包围 YAML，+++ 包围 TOML，;;; 包围 JSON；也识别以 { 和 } 各占一行包围的 JSON。结束后留空行再写正文，避免与标题或分隔线混淆。',
        'Put Front Matter at the very beginning: use --- for YAML, +++ for TOML or ;;; for JSON. JSON with { and } on their own lines is also recognized. Leave a blank line after it before the document body.'
      ],
      [
        '“段落 → Front Matter”按设置的类型创建元数据块。元数据内容保存在 Markdown 中，不会自动变成正文标题或修改软件首选项。',
        'Paragraph → Front Matter creates metadata using the configured type. It is saved in Markdown and does not automatically create a body heading or alter app preferences.'
      ],
      [
        '侧栏目录由文档标题自动生成；正文单独一段的 [TOC] 是内置 HTML／PDF 导出识别的目录占位符。编辑时请使用侧栏目录导航，不要把占位符当成通用 Markdown 标准。',
        'The sidebar outline is generated from headings. A standalone [TOC] paragraph is a contents placeholder recognized by built-in HTML/PDF export. Use the sidebar for navigation while editing; this placeholder is not a universal Markdown standard.'
      ]
    ],
    example: '---\ntitle: 示例文档\nauthor: Writer\n---\n\n[TOC]\n\n# 第一章\n\n正文。\n\n## 第一节'
  },
  {
    id: 'html-emoji-escaping',
    title: ['HTML、表情与转义', 'HTML, emoji and escaping'],
    items: [
      [
        'HTML 默认启用，支持行内标签和 HTML 块，常用写法包括 <u>、<span>、<img> 和注释。渲染内容会经过过滤；脚本、事件处理和任意网页交互不属于 Markdown 编辑器的功能。关闭 HTML 后按相应设置显示。',
        'HTML is enabled by default, with inline tags and HTML blocks such as <u>, <span>, <img> and comments. Rendering is sanitized; scripts, event handlers and arbitrary web interactions are not editor features. Disabling HTML changes its display.'
      ],
      [
        ':smile: 等已收录的表情短码可转换成表情，也可直接输入 Unicode 表情。冒号输入时的候选列表以软件实际收录名称为准。',
        'Supported shortcodes such as :smile: become emoji; Unicode emoji can also be typed directly. The app’s colon-triggered picker lists the available names.'
      ],
      [
        '用反斜杠转义 *、[、# 等标点，使其按文字显示；也支持 &amp;、&lt; 等 HTML 字符实体。反引号代码中通常无需转义 Markdown 标记。',
        'Escape punctuation such as *, [ and # with a backslash to display it literally. HTML entities such as &amp; and &lt; are supported. Markdown delimiters inside code spans usually need no escaping.'
      ]
    ],
    example:
      '<u>下划线</u>\n\n<span style="color: red">红色文字</span>\n\n<!-- 注释 -->\n\n:smile: 😀\n\n\\*显示星号\\*  \\[显示方括号\\]\n\n&amp; &lt; &gt;'
  }
]
