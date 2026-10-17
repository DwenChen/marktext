export type GuideText = readonly [zh: string, en: string]

export interface GuideSection {
  id: string
  title: GuideText
  items: GuideText[]
  example?: string
}

export const guideSections: GuideSection[] = [
  {
    id: 'start',
    title: ['开始使用与菜单', 'Getting started and menus'],
    items: [
      [
        'MarkText 是即时预览的 Markdown 编辑器。直接输入文字和 Markdown 标记即可编辑；需要查看原始标记时，使用“视图 → 源代码模式”。',
        'MarkText is a live-preview Markdown editor. Type text and Markdown directly; use View → Source Code Mode to edit the underlying markup.'
      ],
      [
        '侧栏顶部提供“段落、格式、视图、帮助”。侧栏隐藏时，可从标题栏左上角的菜单按钮进入完整菜单；原生标题栏模式也可使用系统菜单。',
        'The sidebar provides Paragraph, Format, View and Help. With the sidebar hidden, open the full menu from the top-left title-bar button; native title bars also provide the system menu.'
      ],
      [
        '空段落输入 / 或 、，可搜索并插入标题、列表、表格、代码、公式及图表；用上下方向键选择、Enter 确认、Esc 取消。',
        'Type / or 、 in an empty paragraph to search for headings, lists, tables, code, equations and diagrams. Use arrow keys, Enter and Escape.'
      ],
      [
        '本手册可离线阅读。使用顶部搜索框按“图片、列表、导出”等关键词检索；左侧目录可跳转。文末列出当前窗口实际菜单和快捷键。',
        'This guide works offline. Search for topics such as images, lists or export, or use the contents. The final section lists the actual menu commands and shortcuts for this window.'
      ]
    ]
  },
  {
    id: 'files',
    title: ['文件、文件夹与标签页', 'Files, folders and tabs'],
    items: [
      [
        '通过“文件”菜单新建标签页或窗口、打开文件或文件夹、打开最近文件；也可将文档拖入窗口打开。',
        'Use File to create tabs or windows, open files or folders, and reopen recent documents. Documents can also be dropped into the window.'
      ],
      [
        '打开文件夹后，在侧栏文件树浏览和打开文档；通过文件或文件夹的右键菜单进行新建、重命名、移动或删除等操作。',
        'After opening a folder, browse documents in the sidebar tree. File and folder context menus provide creation, rename, move and delete actions.'
      ],
      [
        '点击标签页切换文档，拖动标签页调整顺序，点击关闭按钮关闭。标题旁的未保存标记提示当前修改尚未写入文件。',
        'Click tabs to switch documents, drag tabs to reorder them, and use the close button to close them. The title indicator shows unsaved changes.'
      ],
      [
        '默认可用 Ctrl+Tab / Ctrl+Shift+Tab 循环切换标签页，Ctrl+PageUp / Ctrl+PageDown 切换相邻标签页；macOS 的默认绑定请以快捷键设置为准。',
        'Default Windows/Linux bindings include Ctrl+Tab / Ctrl+Shift+Tab and Ctrl+PageUp / Ctrl+PageDown for tab switching. Check Keybindings for macOS defaults or custom mappings.'
      ],
      [
        '“文件 → 保存／另存为”写入 Markdown 文件；“重命名／移动到”改变文件名或位置。“自动保存”及其延迟可在首选项配置。',
        'File → Save / Save As writes the Markdown file; Rename / Move To changes its name or location. Auto Save and its delay are configurable in Preferences.'
      ],
      [
        '文件在外部发生变化时，按软件提示处理重新加载或冲突。关闭未保存文件时，请根据提示保存、放弃修改或取消关闭。',
        'When a file changes outside MarkText, follow the reload or conflict prompt. When closing an unsaved file, choose Save, Discard or Cancel.'
      ]
    ]
  },
  {
    id: 'editing',
    title: ['输入、选区与编辑', 'Typing, selection and editing'],
    items: [
      [
        'Enter 新建段落或继续当前列表；Shift+Enter 在段落内换行。括号、引号和 Markdown 标记自动配对可在首选项开关。',
        'Enter creates a paragraph or continues a list; Shift+Enter adds a line break within a paragraph. Pairing of brackets, quotes and Markdown delimiters is configurable.'
      ],
      [
        '用鼠标或 Shift+方向键选择文字；使用“编辑”菜单剪切、复制、粘贴、粘贴为纯文本，以及撤销和重做。',
        'Select with the mouse or Shift+arrow keys. Edit provides Cut, Copy, Paste, Paste as Plain Text, Undo and Redo.'
      ],
      [
        '全选会根据当前范围逐步扩展：先选当前内容块，再扩展到全文。表格内的选择可逐步扩展为整个表格或全文。',
        'Select All expands according to the current selection: from a content block to the document. Table selections can expand to the entire table and then the document.'
      ],
      [
        '“编辑 → 复制段落／新建段落／删除段落”以及段落前方标记菜单可操作当前段落；完整块操作与选中文字操作的范围不同。',
        'Edit and the paragraph handle menu provide copy, new-paragraph and delete-paragraph operations. Whole-block operations have a different scope from selected-text operations.'
      ],
      [
        '状态栏显示全文或选区统计，并提供编码、换行符等文档信息。可在相关菜单或首选项中设置编码、LF／CRLF、结尾换行和文本方向。',
        'The status bar shows document or selection statistics and document information. Menus and Preferences control encoding, LF/CRLF, final newlines and text direction.'
      ]
    ]
  },
  {
    id: 'blocks',
    title: ['标题、段落、引用与分隔线', 'Headings, paragraphs, quotes and rules'],
    items: [
      [
        '行首输入 # 到 ###### 再加空格可创建六级标题；“段落 → 标题”可转换当前块，提升或降低标题级别。',
        'Type # through ###### followed by a space for six heading levels. Paragraph → Heading converts the current block and promotes or demotes its level.'
      ],
      [
        '“段落 → 段落”可切回普通段落；行首输入 > 加空格可建立引用，引用内也可插入段落和列表。',
        'Paragraph → Paragraph returns to a plain paragraph. Type > followed by a space for a quote, which can contain paragraphs and lists.'
      ],
      [
        '单独一行输入 ---、*** 或 ___ 可建立分隔线；“段落”菜单和 / 插入菜单也可创建。',
        'A line containing ---, *** or ___ creates a horizontal rule. The Paragraph and / menus provide the same block types.'
      ],
      [
        '支持 GitHub 风格提示引用，例如 > [!NOTE]、> [!TIP]、> [!IMPORTANT]、> [!WARNING]、> [!CAUTION]。',
        'GitHub-style alert quotes support > [!NOTE], > [!TIP], > [!IMPORTANT], > [!WARNING] and > [!CAUTION].'
      ]
    ],
    example: '# 一级标题\n## 二级标题\n\n> 引用内容\n\n> [!NOTE]\n> 提示内容\n\n---'
  },
  {
    id: 'format',
    title: ['文字格式、颜色与快捷栏', 'Text formatting, colors and toolbar'],
    items: [
      [
        '选中文字后使用“格式”菜单或浮现快捷栏设置粗体、斜体、下划线、删除线、行内代码、链接和图片等。再次执行同一种格式可取消；“清除格式”移除格式标记。',
        'Select text and use Format or the floating toolbar for bold, italic, underline, strikethrough, inline code, links and images. Toggle a format again to remove it, or use Clear Format.'
      ],
      [
        '快捷栏中的颜色面板可设置文字颜色或背景色；关闭面板后，选择其他文字仍可继续使用格式工具。',
        'The toolbar color panel changes text or background colors. Select another range to continue formatting.'
      ],
      [
        '高亮、上标、下标、脚注和行内差异等扩展受“首选项 → Markdown”中的相应开关控制。',
        'Highlight, superscript, subscript, footnotes and inline-diff extensions depend on the corresponding Markdown preferences.'
      ],
      [
        '快捷栏在文字或图片拖动开始时隐藏，放下或取消后不会因旧选区重新弹出；重新用鼠标或键盘选择文字即可恢复。',
        'The toolbar hides when a text or image drag starts and stays hidden after dropping or cancelling. A fresh mouse or keyboard selection restores it.'
      ]
    ],
    example: '**粗体**  *斜体*  ~~删除线~~  `行内代码`\n==高亮==  H~2~O  X^2^'
  },
  {
    id: 'lists',
    title: ['列表、层级与图片后续写', 'Lists, nesting and continuing after images'],
    items: [
      [
        '行首输入 -、+、* 加空格创建无序列表；数字加 . 或 ) 再加空格创建有序列表。“段落”菜单也可创建或切换列表。',
        'Type -, + or * and a space for a bullet list, or a number followed by . or ) and a space for an ordered list. Paragraph also creates and switches lists.'
      ],
      [
        '输入 - [ ] 或 - [x] 创建任务列表，点击复选框切换完成状态。有序任务列表也可使用数字前缀。',
        'Use - [ ] or - [x] for task items and click checkboxes to toggle completion. Task lists may also use ordered prefixes.'
      ],
      [
        '在列表中按 Enter 继续同级条目；空条目上按 Enter 退出当前列表层级。Tab 缩进为子项，Shift+Tab 反向缩进；也可使用右键菜单中的层级和块操作。',
        'Enter continues the current level; Enter on an empty item exits that list level. Tab indents and Shift+Tab outdents. Context menus provide block and level operations.'
      ],
      [
        '通过“段落 → 宽松列表条目”或 Markdown 首选项设置宽松列表、项目符号、有序列表分隔符及缩进宽度。',
        'Use Paragraph → Loose List Item and Markdown preferences for list spacing, bullet markers, ordered delimiters and indentation.'
      ],
      [
        '列表里插入图片后，单击选中图片再按 Enter，会保留图片并接着创建同层级条目；可撤销和重做。',
        'After inserting an image into a list, select the image and press Enter to keep it and create a following item at the same level. Undo and redo are supported.'
      ]
    ],
    example: '- 父条目\n  - 子条目\n1. 有序条目\n- [ ] 待办\n- [x] 完成'
  },
  {
    id: 'text-drag',
    title: ['选中文字拖动与落点提示', 'Dragging selected text and drop indicators'],
    items: [
      [
        '先选中同一段内的几个字或整行文字，再从选区内按住并拖动。普通拖动为移动，拖动中按住 Ctrl（或 Alt）可复制；Esc 取消。',
        'Select part or all of one text block, then drag from inside the selection. Drag to move, hold Ctrl (or Alt) while dragging to copy, or press Escape to cancel.'
      ],
      [
        '竖向蓝色光标表示插入目标文字中的精确位置。即使整行选中，也可以在字符之间插入。',
        'A vertical blue caret marks the exact character insertion point. A fully selected line can also be inserted between characters.'
      ],
      [
        '移到段落上、下边缘或段落间隙，蓝色横线表示新建独立段落；移到列表边缘则表示新建对应层级条目。',
        'At a paragraph edge or gap, a horizontal blue line creates a separate paragraph. At a list boundary it creates an item at that level.'
      ],
      [
        '在嵌套列表左侧缩进区域左右移动，可选择已有父级或子级位置；以横线的缩进和上下位置为准。目标有子列表时，横线表示整个目标块之前或之后。',
        'Move horizontally through a nested list’s left gutter to choose an existing parent or child level. The line shows the indentation and boundary of the complete target item, including its children.'
      ],
      [
        '完整选中列表首段并放到横线位置时，会连同子列表移动或复制；放到竖向光标处则只处理选中文字，原子列表保留。',
        'A fully selected first paragraph dropped on a boundary carries the item’s children. A caret drop transfers only the selected text and preserves the source children.'
      ],
      [
        '整行移走后会清除空条目的序号、圆点或复选框；剩余子列表保留并提升一级。部分选区、复制及原本就存在的空条目不会因此清理。',
        'Moving a whole line removes its vacated marker or checkbox; remaining child lists survive and rise one level. Partial moves, copies and unrelated pre-existing empty items are not cleaned up.'
      ],
      [
        '跨段落多选拖动及不允许的自包含落点会取消操作，原内容保留。拖动完成后可以使用撤销／重做。',
        'Cross-block text drags and forbidden self-containing targets are cancelled without removing content. Completed moves support undo and redo.'
      ]
    ]
  },
  {
    id: 'block-drag',
    title: ['段落前标记与整块移动', 'Paragraph handles and whole-block moves'],
    items: [
      [
        '鼠标移到段落前方，浮现标记可打开段落菜单，复制、删除、新建段落或转换块类型。',
        'Hover before a paragraph to reveal its handle. Its menu offers copy, delete, new paragraph and block conversion.'
      ],
      [
        '按住标记约 300 毫秒后拖动，蓝色横线表示整个块的插入位置；目标上半部插到之前，下半部插到之后。',
        'Hold the handle for about 300 ms and drag. A blue line marks the whole-block destination: above the target’s midpoint inserts before it, below inserts after it.'
      ],
      [
        '列表和引用按完整块移动，并保留其嵌套内容。按 Esc 或移出有效目标可取消；放置后可撤销／重做。',
        'Lists and quotes move as complete blocks with nested content. Escape or an invalid destination cancels the move. Dropped moves support undo and redo.'
      ]
    ]
  },
  {
    id: 'images',
    title: ['图片插入、选中、缩放与预览', 'Inserting, selecting, resizing and previewing images'],
    items: [
      [
        '通过“格式 → 图片”、快捷栏图片按钮、粘贴或拖入图片文件插入图片；也可以输入 Markdown 图片语法及有效的图片链接。',
        'Insert through Format → Image, the toolbar image button, paste, or a dropped image file. Markdown image syntax and valid image URLs also work.'
      ],
      [
        '在“首选项 → 图片”选择保留路径、复制到文件夹或上传，设置图片目录、相对路径及已配置的图床。上传需要可用的图床配置和网络。',
        'Preferences → Image controls path, folder-copy or upload behavior, image folders, relative paths and image-host settings. Uploading requires a configured host and network access.'
      ],
      [
        '单击图片后出现图片工具栏和左右缩放手柄。拖动左右手柄改变尺寸；图片工具栏提供对齐、编辑等操作，按 Delete 或 Backspace 删除选中图片。',
        'Click an image for its toolbar and side resize handles. Drag a handle to resize; use its toolbar for alignment and editing. Delete or Backspace removes the selected image.'
      ],
      [
        '选中图片后按空格预览。Ctrl／Cmd 单击普通图片也可预览；链接中的图片使用修饰键单击时按链接行为处理。',
        'Press Space with an image selected to preview it. Ctrl/Cmd-click also previews ordinary images; modifier-click on linked images follows the link behavior.'
      ],
      [
        '图片失效时检查路径或网络；“视图 → 重新加载图片”可刷新图片缓存。相对路径以当前文档所在文件夹为基准。',
        'For a failed image, check its path or network. View → Reload Images refreshes the cache. Relative paths are based on the document’s folder.'
      ]
    ],
    example: '![图片说明](images/photo.png "标题")'
  },
  {
    id: 'image-drag',
    title: ['选中图片后拖动插入', 'Dragging an existing image'],
    items: [
      [
        '单击选中已插入的图片，再从图片中间按住并拖动；左右手柄用于缩放，不用于移动。',
        'Click an inserted image to select it, then drag from its center. The side handles resize rather than move it.'
      ],
      [
        '竖向光标表示插到段落或列表文字之间；横线表示独立插入段落或列表条目。在列表缩进区可选择已有层级。',
        'A vertical caret inserts between text characters; a horizontal line inserts a separate paragraph or list item. The list gutter selects an existing level.'
      ],
      [
        '普通拖动移动图片，拖动过程中按 Ctrl（或 Alt）复制；Esc 取消，撤销和重做可恢复图片位置。',
        'Drag to move, hold Ctrl (or Alt) during the drag to copy, or Escape to cancel. Undo and redo restore image positions.'
      ],
      [
        '移动保留图片原有标记中的路径、说明、标题和尺寸。只处理图片本身；原条目中的子列表保留，移空条目会清除标记并提升剩余子列表。',
        'The original image markup retains its path, alt text, title and dimensions. Only the image moves; source child lists remain, and vacated items are removed with children promoted.'
      ],
      [
        '拖动期间隐藏图片工具栏、缩放手柄和文字格式快捷栏。再次单击图片可重新显示图片操作工具。',
        'Image tools, resize handles and text-format tools hide during a drag. Click an image again to show its tools.'
      ]
    ]
  },
  {
    id: 'links',
    title: ['链接、脚注、表情与扩展语法', 'Links, footnotes, emoji and extensions'],
    items: [
      [
        '选中文字执行“格式 → 超链接”，或输入 [文字](地址)。点击链接可编辑，Ctrl／Cmd 单击可打开链接。引用式链接和图片可使用文末定义。',
        'Use Format → Hyperlink on selected text, or type [text](URL). Click to edit and Ctrl/Cmd-click to open. Reference-style links and images use definitions elsewhere in the document.'
      ],
      [
        '启用脚注后，使用 [^标识] 与 [^标识]: 内容；点击引用可使用脚注工具。',
        'With footnotes enabled, use [^id] and [^id]: content. Click a reference to access footnote tools.'
      ],
      [
        '输入 : 后继续输入表情名称，可使用表情选择器；Esc 关闭候选。',
        'Type : and an emoji name to use emoji suggestions. Escape dismisses the picker.'
      ],
      [
        '支持 HTML 行内格式和 HTML 块；在 Markdown 首选项中设置 HTML、上／下标、高亮、差异标记、多行引用及数学扩展。',
        'Inline HTML and HTML blocks are supported. Markdown preferences control HTML, super/subscript, highlighting, inline diff, multiline quotes and math extensions.'
      ]
    ],
    example:
      '[链接文字](https://example.com)\n[引用链接][ref]\n\n[ref]: https://example.com\n\n带脚注的文字[^note]\n\n[^note]: 脚注内容'
  },
  {
    id: 'tables',
    title: ['表格与行列操作', 'Tables and row/column operations'],
    items: [
      [
        '通过“段落 → 表格”或 / 菜单选择表格尺寸，或输入带有表头分隔行的 Markdown 表格。',
        'Create a table through Paragraph → Table, the / menu’s size picker, or Markdown with a header separator row.'
      ],
      [
        '点击单元格编辑内容，用 Tab／Shift+Tab 在单元格间移动；表格的行列工具栏和右键菜单可插入、删除行列及设置对齐。',
        'Click cells to edit and use Tab / Shift+Tab to navigate. Row/column tools and context menus insert or delete rows and columns and set alignment.'
      ],
      [
        '行列拖动条可调整顺序，选区工具支持单元格、行、列和矩形区域的操作；复制表格内容时保留相应结构。',
        'Row/column drag bars reorder the table. Selection tools work with cells, rows, columns and rectangular ranges, preserving structure when copied.'
      ],
      [
        '表格居中和编辑外观可在首选项设置；文档保存为 Markdown 表格。',
        'Preferences control table centering and appearance. Tables are saved as Markdown.'
      ]
    ],
    example: '| 名称 | 数值 |\n| :--- | ---: |\n| 示例 | 10 |'
  },
  {
    id: 'code',
    title: ['代码块与 HTML', 'Code blocks and HTML'],
    items: [
      [
        '行内代码用反引号包围。代码块通过“段落 → 代码块”、/ 菜单或三反引号创建；在语言输入框选择或输入语言，获得语法高亮。',
        'Wrap inline code in backticks. Create fenced blocks through Paragraph, / or triple backticks; choose a language for highlighting.'
      ],
      [
        '代码块内容保持为代码；围栏长度会根据内容处理。代码字体、字号及自动换行可在编辑器首选项设置。',
        'Code blocks retain code content and handle fence lengths as needed. Code font, size and wrapping are configurable in Editor preferences.'
      ],
      [
        '“段落 → HTML 块”可插入 HTML 内容；是否启用 HTML 由 Markdown 首选项控制。',
        'Paragraph → HTML Block inserts HTML content. Markdown preferences control whether HTML is enabled.'
      ]
    ],
    example: '```javascript\nconst greeting = "Hello MarkText"\nconsole.log(greeting)\n```'
  },
  {
    id: 'math',
    title: ['数学公式', 'Math equations'],
    items: [
      [
        '使用 $公式$ 插入行内公式，使用独立的 $$ 围栏创建公式块，或通过“段落 → 数学公式”和“格式 → 行内公式”插入。',
        'Use $math$ inline or standalone $$ fences for a math block, or choose Paragraph → Math Formula and Format → Inline Math.'
      ],
      [
        '公式采用 KaTeX 渲染。点击公式可继续编辑；如果语法不生效，检查“首选项 → Markdown”的数学扩展开关。',
        'Equations render with KaTeX. Click to edit. If delimiters are not recognized, check the math extension settings in Preferences → Markdown.'
      ],
      [
        '可按需要启用 GFM 数学和反斜线数学语法。公式保存时保留对应 Markdown 源码。',
        'GFM and backslash math syntaxes can be enabled as needed. Saving retains the corresponding Markdown source.'
      ]
    ],
    example: '$E = mc^2$\n\n$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$'
  },
  {
    id: 'diagrams',
    title: ['流程图、时序图与数据图表', 'Flowcharts, sequence diagrams and charts'],
    items: [
      [
        '通过 / 插入菜单选择 Mermaid、PlantUML、Flowchart、Sequence 或 Vega-Lite；也可创建同名语言的代码围栏，输入对应图表源码。',
        'Use / to choose Mermaid, PlantUML, Flowchart, Sequence or Vega-Lite, or create a fence with that language and enter diagram source.'
      ],
      [
        'Mermaid 可绘制流程图、时序图等；Flowchart 和 Sequence 使用各自语法。Vega-Lite 使用 JSON 图表规格。',
        'Mermaid supports flowcharts, sequence diagrams and more. Flowchart and Sequence use their own syntaxes; Vega-Lite uses a JSON specification.'
      ],
      [
        '编辑源码后查看预览；报错时检查语法。PlantUML 依赖已配置的服务地址及网络，包含远程数据的图表也需要相应网络资源。',
        'Edit the source to update the preview and check syntax when errors appear. PlantUML requires the configured server and network; charts using remote data need those resources.'
      ]
    ],
    example: '```mermaid\ngraph TD\n  A[开始] --> B[编辑文档]\n  B --> C[保存]\n```'
  },
  {
    id: 'frontmatter',
    title: ['Front Matter 与文档结构', 'Front matter and document structure'],
    items: [
      [
        '通过“段落 → Front Matter”或 / 菜单插入文档元数据；首选项可选择 YAML、TOML、JSON 等支持的分隔风格。',
        'Insert document metadata through Paragraph → Front Matter or /. Preferences select supported YAML, TOML and JSON styles.'
      ],
      [
        '将 Front Matter 放在文档开头，按对应语法填写标题、日期、标签等字段；它会随 Markdown 文件保存。',
        'Place front matter at the beginning and use its syntax for fields such as title, date and tags. It is saved with the Markdown file.'
      ],
      [
        '“视图 → 目录”或侧栏目录图标显示标题结构，点击标题可跳到对应位置；修改标题后目录随之更新。',
        'View → Table of Contents or the sidebar contents icon displays headings. Click a heading to jump to it; editing headings updates the outline.'
      ]
    ],
    example: '---\ntitle: 文档标题\ntags: [笔记, Markdown]\n---'
  },
  {
    id: 'search',
    title: ['查找、替换、目录搜索与命令面板', 'Find, replace, folder search and commands'],
    items: [
      [
        '“编辑 → 查找／替换”搜索当前文档，使用上一个／下一个匹配定位，并按面板选项执行单次或全部替换。大小写和正则等选项以查找面板为准。',
        'Edit → Find / Replace searches the document, navigates matches and performs individual or all replacements. The panel provides options such as case sensitivity and regular expressions.'
      ],
      [
        '打开文件夹后使用“编辑 → 在文件夹中查找”跨文件检索，点击结果打开对应文档和位置。',
        'After opening a folder, use Edit → Find in Folder. Click a result to open its document and location.'
      ],
      [
        '首选项可设置搜索排除规则、最大文件大小、隐藏文件、忽略规则和符号链接行为，决定文件夹搜索范围。',
        'Preferences control search exclusions, maximum file size, hidden files, ignore rules and symbolic-link behavior.'
      ],
      [
        '“视图 → 命令面板”可按名称搜索命令，使用方向键和 Enter 执行，Esc 关闭；快速打开功能用于定位项目文件。',
        'View → Command Palette searches commands by name. Use arrows and Enter to run a command or Escape to close. Quick Open locates project files.'
      ]
    ]
  },
  {
    id: 'modes',
    title: ['编辑模式、界面与窗口', 'Editing modes, layout and windows'],
    items: [
      [
        '源代码模式直接编辑 Markdown；返回后继续即时预览。源码模式中部分“段落”和“格式”操作不可用，可直接修改标记。',
        'Source Code Mode edits Markdown directly; switch back for live preview. Some Paragraph and Format actions are unavailable in source mode, where you can edit markup directly.'
      ],
      [
        '打字机模式让正在输入的位置保持在便于阅读的区域；专注模式突出当前编辑内容。这两项可在“视图”切换。',
        'Typewriter Mode keeps the writing position in a comfortable area; Focus Mode emphasizes the current content. Toggle them in View.'
      ],
      [
        '“视图”可显示或隐藏侧栏、标签栏和目录；拖动侧栏分隔线调整宽度，也可聚焦分隔线后用方向键调整。',
        'View toggles the sidebar, tab bar and contents. Drag the sidebar separator to resize it, or focus it and use arrow keys.'
      ],
      [
        '“窗口”菜单提供最小化、置顶、缩放和全屏等当前平台支持的操作；标题栏可切换原生或自定义样式。',
        'Window provides platform-supported minimize, always-on-top, zoom and fullscreen actions. Preferences switch between native and custom title bars.'
      ]
    ]
  },
  {
    id: 'appearance',
    title: ['主题、字体与首选项', 'Themes, fonts and preferences'],
    items: [
      [
        '通过“文件 → 首选项”（macOS 为 MarkText 菜单）打开设置，按常规、编辑器、Markdown、拼写检查、主题、图片和快捷键分类调整。',
        'Open Preferences from File (the MarkText menu on macOS). Categories include General, Editor, Markdown, Spell Checking, Theme, Image and Keybindings.'
      ],
      [
        '明暗外观可设为浅色、深色或跟随系统；文档主题与应用外观分别控制。主题页可选择内置文档主题、导入或移除自定义主题。',
        'Appearance can be light, dark or follow the system. Document themes are separate from application appearance. Theme settings select built-ins or import and remove custom themes.'
      ],
      [
        '编辑器设置提供字体、字号、行高、代码字体、代码换行、表格居中、滚动条和插入提示等选项。',
        'Editor settings control font, size, line height, code font and wrapping, table centering, scrollbars and insertion hints.'
      ],
      [
        '常规设置可调整启动行为、默认目录、文件打开方式、自动保存、语言和文件排序；Markdown 设置控制语法与列表偏好。',
        'General settings control startup, default folders, opening behavior, auto-save, language and sorting. Markdown settings control syntax and list preferences.'
      ],
      [
        '快捷键可在设置中搜索并修改；发生冲突时按配置界面提示处理。文末快捷键清单取自当前菜单，优先参考实际显示的绑定。',
        'Search and change bindings in Keybindings and follow its conflict messages. The command reference below reads the current menu; use its actual bindings as the source of truth.'
      ]
    ]
  },
  {
    id: 'spelling',
    title: ['拼写检查与词典', 'Spell checking and dictionaries'],
    items: [
      [
        '在首选项中启用拼写检查并选择语言；拼写下划线可单独设置。',
        'Enable spell checking and choose a language in Preferences. Underlines have a separate setting.'
      ],
      [
        '对提示单词使用右键菜单查看建议、更正或执行词典相关操作。词典资源是否可用取决于当前语言和平台。',
        'Use a flagged word’s context menu for suggestions, corrections and dictionary actions. Dictionary availability depends on language and platform.'
      ]
    ]
  },
  {
    id: 'export',
    title: ['导入、导出与打印', 'Import, export and printing'],
    items: [
      [
        'Markdown 文件直接打开编辑。其他格式通过“文件 → 导入”选择软件支持的转换方式和文件。',
        'Open Markdown files directly. For other formats, use File → Import and choose a supported conversion and file.'
      ],
      [
        '“文件 → 导出”提供 HTML、PDF 等选项；按导出设置选择格式和样式，再指定保存位置。Markdown 的日常保存使用“保存／另存为”。',
        'File → Export offers HTML, PDF and other available formats. Choose export settings and destination. Use Save / Save As for normal Markdown saving.'
      ],
      [
        '使用 Pandoc 的导入或转换，需要安装并正确配置 Pandoc。开启“显示 Pandoc 转换”后，可从菜单选择支持的格式。',
        'Pandoc-based import or conversion requires Pandoc to be installed and configured. Enable Show Pandoc Conversion to expose the supported formats.'
      ],
      [
        '“文件 → 打印”打开平台打印流程，可选择打印设备及相关参数。导出和打印前检查图片加载及公式、图表是否已渲染完成。',
        'File → Print opens the platform printing flow. Before exporting or printing, check that images, equations and diagrams have finished rendering.'
      ]
    ]
  },
  {
    id: 'support',
    title: ['帮助与常见问题', 'Help and troubleshooting'],
    items: [
      [
        '使用“帮助 → 使用帮助”或 F1 重新打开本手册。关闭帮助不会修改当前文档。',
        'Open this guide through Help → User Guide or F1. Closing it does not change the document.'
      ],
      [
        '“帮助 → Markdown 参考”提供本软件实际支持的语法、扩展开关和原始示例，同样可离线搜索阅读。',
        'Help → Markdown Reference documents the syntax, extension settings and raw examples supported by this app, with offline search.'
      ],
      [
        '格式命令变灰时，检查当前是否处于源码模式、选区是否跨块或该位置是否允许此类型。快捷键无效时先查看菜单及快捷键设置。',
        'If formatting is unavailable, check source mode, selection scope and whether the block type is permitted. For shortcut problems, check menus and Keybindings.'
      ],
      [
        '拖动时先看落点：竖光标是文字内部插入，横线是独立块插入；图片从中间拖动、两侧手柄缩放，段落标记需按住片刻。',
        'Check the drop indicator: a vertical caret inserts inline and a horizontal line inserts a block. Drag images from the center, resize from side handles, and hold paragraph handles briefly.'
      ],
      [
        '反馈问题时说明操作步骤、版本、平台和是否可撤销，必要时提供可复现的最小 Markdown 示例。',
        'When reporting an issue, include steps, version, platform, undo behavior and a minimal reproducible Markdown example.'
      ]
    ]
  }
]

export const guideText = (value: GuideText, language: string): string =>
  value[language.startsWith('zh') ? 0 : 1]

export const filterGuide = (
  query: string,
  language: string,
  sections: GuideSection[] = guideSections
): GuideSection[] => {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  return sections.filter((section) => {
    const text = [
      guideText(section.title, language),
      ...section.items.map((item) => guideText(item, language)),
      section.example ?? ''
    ]
      .join('\n')
      .toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  })
}
