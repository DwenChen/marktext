# 项目性能与潜在 Bug 审查 — 2026-10-11

> 本文保留修复前的发现与采集结果。后续代码修复、性能对比和验证结果见 [修复记录](FIXES.md)。

审查对象：`develop`，HEAD `46decaa9`，**包含当前未提交的主题、导出、窗口与界面修改**。重点覆盖 Electron 主进程、桌面编辑器/源码模式、保存/恢复、Muya 状态与撤销链路；网站包完成类型、Lint 和关键交互代码检查。

**结论：仍有值得优先处理的问题。确认 2 项 P1、6 项 P2；主要性能瓶颈是编辑时的全文派生计算、源码光标事件的全文处理，以及主进程同步恢复写盘。建议先修保存一致性，再优化大文档路径。**

本次只增加审查报告、复现脚本和结果，没有修改生产源码，也没有覆盖原有工作区修改。优先级表示修复顺序：P1 涉及内容丢失风险；P2 为可复现的功能错误或持续资源积累。

## 1. 已确认的问题

| 编号 | 优先级 | 问题                                              | 验证方式                             |
| ---- | ------ | ------------------------------------------------- | ------------------------------------ |
| F01  | P1     | 保存回执把保存请求之后的新编辑误标为已保存        | 真实 Pinia store，控制 IPC 回执时序  |
| F02  | P1     | 保存全部、关闭窗口未先提交 Muya 待处理编辑        | 真实 Pinia store，模拟待提交编辑边界 |
| F03  | P2     | 修改渲染/解析选项时，待处理编辑丢失或与界面不同步 | 真实 Muya，浏览器复现                |
| F04  | P2     | 解析选项改变文档结构后，撤销抛错并消耗历史项      | 真实 Muya，浏览器复现                |
| F05  | P2     | 撤销/重做时目录读取早于编辑器树更新               | 浏览器事件捕获 + Electron 实测       |
| F06  | P2     | 源码模式导出正文与目录来自不同版本                | Electron 实测导出 HTML               |
| F07  | P2     | 源码模式保存后切回可视化，错误显示未保存          | Electron 保存后核对磁盘内容          |
| F08  | P2     | 每次全文搜索累积一个窗口销毁监听器                | Electron 连续 12 次完成搜索          |

### F01：保存回执没有对应保存快照

位置：[editor.ts:645](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/store/editor.ts:645)、[file.ts:289](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/main/menu/actions/file.ts:289)。

触发：内容 A 发起保存；异步写盘完成前继续编辑为 B；主进程回传 `mt::tab-saved(tabId)`。当前处理器取的是**回执到达时**的历史 ID，并无条件设置 `isSaved = true`，而磁盘保存的是 A。新文件的 `mt::set-pathname` 同样无条件设置已保存。

复现断言要求 B 仍为未保存，实际得到 `true`。关闭流程随后可能跳过未保存提示；自动保存也依据这一状态决定是否写盘，因此这是内容丢失风险。复现使用真实 store 和模拟 IPC，没有通过真实慢磁盘制造该竞态。

建议：在保存请求中记录内容签名/修订号及请求 ID；回执携带对应快照，只有当前内容仍匹配时才能标为已保存。保存、另存为、自动保存和批量保存共用这一规则，并覆盖保存中继续输入、连续保存与保存失败的时序。

### F02：保存全部和窗口关闭缺少 flush

位置：[editor.ts:687](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/store/editor.ts:687)、[editor.ts:729](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/store/editor.ts:729)。

单文件保存已在读取 Markdown 前调用 `flushActiveEditor()`；`ASK_FOR_SAVE_ALL()` 和 `mt::ask-for-close` 仍直接读取 tab 状态。Muya 的文字操作按 `requestAnimationFrame` 批处理，因此同帧保存/关闭或后台帧延迟时，tab 尚未包含最后一次输入。窗口关闭的恢复快照也先读取了旧状态。

受控复现中，flush 可把 A 更新为 B，但这两个入口没有调用它，发送的保存/关闭确认内容仍为 A。该测试验证入口缺失，未测量日常交互中的发生概率。

建议：将“flush → 收集快照 → 持久化/关闭判断”做成统一边界。关闭恢复快照必须在 flush 后创建，不能只在确认保存阶段补 flush。

### F03：选项切换可能覆盖尚未提交的文字

位置：[muya.ts:334](C:/Users/chen/Desktop/marktext-develop/packages/muya/src/muya.ts:334)、[state/index.ts:78](C:/Users/chen/Desktop/marktext-develop/packages/muya/src/state/index.ts:78)。桌面中的相关调用见 [editor.vue:613](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue:613)。

`setOptions(..., true)` 没有先 flush。重解析从尚未更新的 JSON 文档生成内容；`JSONState.setContent()` 随后取消待处理帧并清空操作队列。纯重绘则从旧 JSON 状态重建编辑器树，之后队列更新 JSON，却没有把文字补回界面。

浏览器复现：把 `alpha` 改成 `alpha!`，在帧提交前切换选项。`superSubScript` 重绘后 Markdown 是 `alpha!`，界面仍为 `alpha`；`footnote` 重解析后两者都退回 `alpha`，最后一个字符丢失。

建议：在同一文档的重绘/重解析开始前先提交操作，且在更改解析选项之前完成该提交。保留“换成另一份文档时丢弃旧队列”的规则，避免把旧文档操作应用到新文档。

### F04：重解析后原撤销操作已不适用

位置：[muya.ts:359](C:/Users/chen/Desktop/marktext-develop/packages/muya/src/muya.ts:359)、[history/index.ts:156](C:/Users/chen/Desktop/marktext-develop/packages/muya/src/history/index.ts:156)。

关闭脚注解析时，`[^f]: note` 是普通段落。编辑成 `[^f]: note!` 后开启脚注解析，文档变成脚注容器和子段落；原历史操作仍指向旧结构的 `[0, 'text']`。撤销时报 `Invalid document snapshot: undefined`，内容不变。`_change()` 在验证逆操作前已 `pop()`，这条历史记录也被消耗。

建议：把结构重解析作为明确的历史边界，转换/重建受影响历史，或采用能恢复前后完整状态的边界设计。历史操作成功前不能删除源栈项；失败时应恢复两侧栈和选择状态。直接清空历史可规避异常，但会损失用户撤销体验。

### F05：撤销后目录仍显示上一个版本

位置：[editor/index.ts:400](C:/Users/chen/Desktop/marktext-develop/packages/muya/src/editor/index.ts:400)、[editor/index.ts:486](C:/Users/chen/Desktop/marktext-develop/packages/muya/src/editor/index.ts:486)、[editor.vue:1956](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue:1956)、[getTOC.ts:31](C:/Users/chen/Desktop/marktext-develop/packages/muya/src/state/getTOC.ts:31)。

历史应用先 `jsonState.dispatch()`，同步触发 `json-change`，再更新真实 block 树。桌面监听器在该事件里调用 `getTOC()`，而它读取的是旧 block 树。Markdown 已更新，目录还是旧标题/slug；后续没有必然触发目录刷新。

Electron 复现：标题 `Before → After → 撤销`，正文和 Markdown 都回到 `Before`，store 目录仍为 `After`。浏览器事件采样也同时观察到新 Markdown 与旧 TOC。

建议：让依赖 block 树的通知在树更新完成后发出，或让桌面在历史操作完成后同步刷新目录。不要通过延迟整个内容更新事件规避，否则会重新引入保存边界竞态。

### F06：源码模式导出目录链接指向旧标题

位置：[editor.vue:1351](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue:1351)。相关功能探测见 [exportSettings/index.vue:452](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/components/exportSettings/index.vue:452)。

源码模式的正文取当前 tab 的 Markdown；目录取隐藏的 Muya 实例，后者还保留进入源码模式前的内容。源码改动没有同步更新它。导出前已有 flush，但不能解决两个来源不同的问题。

Electron 实测导出 HTML：正文标题 ID 为 `saved-in-source`，目录链接却为 `#before`。此复现验证了 styled HTML；PDF/打印/PNG 共享这段目录生成代码，存在同源风险，但本次没有逐一导出验证。

建议：正文、目录及导出选项的标题探测都从同一份冻结 Markdown 派生；使用独立解析结果生成 TOC，避免为导出重置编辑器或破坏历史。

### F07：已保存的源码内容切回后变脏

位置：[sourceCode.vue:324](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/components/editorWithTabs/sourceCode.vue:324)、[editor.ts:645](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/store/editor.ts:645)、[editor.vue:1626](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue:1626)。

源码编辑只同步 Markdown，没有同步 synthetic history。保存回执记录的是进入源码模式前的历史 ID；退出源码模式时 `replaceContent()` 为新内容生成另一 ID，store 将其判断为未保存。

Electron 实测：源码保存后 `isSaved=true`；切回可视化后 `isSaved=false`，但当前 Markdown 与刚保存的磁盘内容完全一致。会出现错误的未保存标记和关闭提示。

建议：保存基线采用跨模式统一的内容签名，并与 F01 的保存快照绑定；切模式仅改变编辑器表现，不应改变相同内容的保存判断。

### F08：全文搜索累积销毁监听器

位置：[ripgrep.ts:31](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/main/ipc/ripgrep.ts:31)、[ripgrep.ts:435](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/main/ipc/ripgrep.ts:435)。

每次 `start` 都注册一次 `sender.once('destroyed', handler)`。正常完成或取消会清理 `activeSearches`，却没有移除这个 handler。长时间打开的窗口会持续累积回调。

Electron 连续完成 12 次搜索，`destroyed` listener 数量从 1 变为 13。这里只证明回调数量线性增长，没有将其描述为整份文档泄漏或已测得的明显卡顿。

建议：每个 WebContents 只注册一个生命周期清理钩子，例如用 WeakSet 去重；或在最后一个任务完成时移除对应订阅。增加“多次完成/取消搜索后监听器数量保持稳定”的回归验证。

## 2. 性能优化空间

### P01：普通编辑仍有随文档大小增长的同步全文工作

位置：[state/index.ts:329](C:/Users/chen/Desktop/marktext-develop/packages/muya/src/state/index.ts:329)、[inlineRenderer/index.ts:88](C:/Users/chen/Desktop/marktext-develop/packages/muya/src/inlineRenderer/index.ts:88)、[editor.vue:1956](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue:1956)、[getTOC.ts:31](C:/Users/chen/Desktop/marktext-develop/packages/muya/src/state/getTOC.ts:31)。

一次局部编辑仍会触发：JSON 文档前后两次深拷贝、全文 Markdown 序列化、全文字数统计、全文内容哈希、TOC 全块扫描和标题 tokenization。引用定义虽已按 revision 缓存，但普通正文编辑也使 revision 变化，下一次读取仍会深拷贝并扫描全文。

本机浏览器探针：真实 Muya 局部文字修改及 flush，追加与桌面相同的序列化/计数/哈希/TOC 调用，每组 5 次，取中位数。

| 文档规模  |  字符数 | 单次同步编辑中位数 | 其中派生数据计算中位数 |
| --------- | ------: | -----------------: | ---------------------: |
| 1,001 块  |  43,817 |              7.2ms |                  2.4ms |
| 3,001 块  | 133,617 |             16.4ms |                  7.0ms |
| 10,001 块 | 447,917 |             44.4ms |                 18.5ms |

10,001 块的单次样本最高为 90.1ms。44.4ms 已明显超过 60Hz 下单帧约 16.7ms 的时间预算；完整桌面还包含 Pinia 更新、IPC 与绘制。**这些是局部同步路径耗时，不是完整输入延迟或 FPS。**

优化方向：按变更块增量维护 Markdown 片段、字数与标题索引；只有标题/引用定义发生变化才重建相关 TOC；审计 `json-change.doc` 是否有消费者，减少重复深拷贝并考虑共享只读快照。UI 派生数据可以合并刷新，但保存读取必须显式 flush。

### P02：源码模式移动光标也处理全文，并禁用了视口裁剪

位置：[sourceCode.vue:324](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/components/editorWithTabs/sourceCode.vue:324)、[sourceCode.vue:345](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/components/editorWithTabs/sourceCode.vue:345)、[sourceCode.vue:384](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/components/editorWithTabs/sourceCode.vue:384)。

`cursorActivity` 每次触发都调用 `saveContent()`：`cm.getValue()` 获取全文，全文统计字数，再提交 store。箭头移动、鼠标定位与拖动选择都可能重复这段工作，即使内容没有变化。另有 `viewportMargin: Infinity` 和外层滚动容器，使 CodeMirror 为整篇文档挂载行元素。

单独测量源码路径中的 `getValue + wordCount`，每组 5 次：

| 源码行数 |    字符数 | 读取与计数中位数 |
| -------- | --------: | ---------------: |
| 1,000    |    42,889 |            0.7ms |
| 10,000   |   438,889 |            4.5ms |
| 100,000  | 4,488,889 |           70.6ms |

探针刻意使用 `viewportMargin: 10`，排除“全部 DOM 行”的成本。因此这里量化的是光标事件中不必要的全文 CPU 工作，**没有量化当前 Infinity 设置的实际 DOM 开销**。

优化方向：内容派生计算放到 `changes` 事件；光标事件仅更新光标/选中字数，并用 change generation 避免内容未变时重复计数。恢复有限视口与 CodeMirror 自身滚动，同时适配目录跳转、选区与窗口缩放逻辑。

### P03：崩溃恢复快照在 Electron 主进程同步写盘

位置：[editorBufferStore/index.ts:189](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/main/editorBufferStore/index.ts:189)、[bufferedState.ts:52](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/store/bufferedState.ts:52)、[editor.ts:2199](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/store/editor.ts:2199)。

恢复快照包含所有 tab，主进程 `JSON.stringify()` 后执行 `writeFileAtomic.sync()`，含同步写盘/fsync。大文档、多 tab 或慢磁盘会阻塞主进程事件循环，影响菜单、窗口和 IPC 响应。这是代码路径确认，**尚未测量实际主进程停顿时间**。

当前 1 秒 debounce 没有 `maxWait`，持续事件可能不断推迟恢复写入。源码光标事件也参与内容更新，使恢复调度产生额外工作。

优化方向：每个窗口采用串行异步原子写入，合并过期快照并保证最终版本顺序；保留 fsync 的可靠性，关闭窗口前等待队列。设置合理的最长恢复间隔，内容/光标/布局状态使用不同更新策略。

### 次级优化与工程项

- [SyntheticHistory](C:/Users/chen/Desktop/marktext-develop/packages/desktop/src/renderer/src/components/editorWithTabs/syntheticHistory.ts:77) 的内容签名 Map 没有容量上限，增长持续到重载文档；Muya undo 栈已限制为 100。可按可达历史和保存基线维护必要签名。未做多小时堆快照，暂不归类为已确认的严重内存泄漏。
- 生产构建中存在约 3.23MB、2.63MB、2.61MB 等大 JS chunk。图表已有部分动态加载，应测量实际启动加载集合后再拆分；本次没有实测冷启动，不能仅凭总产物大小判定启动卡顿。
- 根 Lint 默认 Node 堆容量不足，本机曾 OOM；增加到 6GiB 后，用户本地 `temp/*.cjs` 又被纳入检查。排除 `temp/**` 后通过。建议明确临时目录忽略规则，评估 typed lint 的扫描范围。
- 仓库开发说明与实际依赖有偏差：当前 website 是 Next/React，部分说明仍写 Vite；桌面部分依赖版本也已升级。更新文档能避免后续按过时命令排查问题。

## 3. 验证结果与边界

| 验证                                                  | 结果                                                           |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| Desktop 单元测试                                      | 1,069 通过，36 跳过；98 文件通过，4 跳过                       |
| Muya 单元测试                                         | 2,476 通过，287 文件通过                                       |
| CommonMark/GFM 现有基线套件                           | 1,347 通过；保留 expected-failures，不能等同 100% 规范合规     |
| Muya 类型声明构建                                     | 通过                                                           |
| Desktop vue-tsc                                       | 通过                                                           |
| Website tsc                                           | 通过                                                           |
| electron-vite 生产编译                                | 主进程、preload、renderer 通过                                 |
| 根 ESLint，增加堆并排除 `temp/**`                     | 0 error，240 warning                                           |
| Muya ESLint                                           | 0 error，10 warning                                            |
| Website ESLint，`--max-warnings 0`                    | 通过                                                           |
| Electron 主题、导出设置布局、tabs、window-resize 回归 | 21 通过                                                        |
| 本次 Electron 行为采集                                | 1 个探针通过执行；结果确认 F05–F08，不能作为这些功能正确的证明 |
| 新增保存边界回归用例                                  | **3 条失败**，对应 F01 和 F02；是本次发现的问题                |

运行环境为 Windows，浏览器探针使用本机 Edge `155.0.4283.45`，Electron 使用项目安装的 42 系列运行时。性能样本来自合成英文段落，单机、每组 5 次；中文/复杂公式/图表文档和不同硬件需要后续补充。网站没有做完整生产构建或浏览器 E2E；本次也没有运行全部 Electron E2E、macOS/Linux、安装器或长时间堆分析。

本机实际 pnpm 版本与项目固定的 10.33.4 不匹配，自动版本切换遇到无 TTY 的依赖目录处理限制。没有重新安装依赖；本次通过已安装的本地 Vitest、vue-tsc、ESLint、electron-vite、Playwright 可执行文件完成检查。因此这里报告的是明确列出的等价直接调用，未声称原始 `pnpm` 脚本全部成功。

## 4. 复现与修复顺序

原始数据：[browser-results.json](C:/Users/chen/Desktop/marktext-develop/docs/audit-20261011/browser-results.json)、[electron-results.json](C:/Users/chen/Desktop/marktext-develop/docs/audit-20261011/electron-results.json)、[store-failures.log](C:/Users/chen/Desktop/marktext-develop/docs/audit-20261011/store-failures.log)。

保存边界回归（仓库根运行；原始审查时失败 3 条，修复后均通过）：

```powershell
node node_modules/vitest/vitest.mjs run --config docs/audit-20261011/vitest.config.ts
```

Electron 行为采集（需先有最新 `packages/desktop/out` 构建，测试使用临时用户目录与 Markdown）：

```powershell
node node_modules/playwright/cli.js test --config docs/audit-20261011/playwright.config.mjs
```

浏览器复现与性能采样（第一个命令在一个终端启动，第二个在仓库根的另一终端执行）：

```powershell
# 工作目录 packages/muya/e2e
.\node_modules\.bin\vite.cmd --port 5174 --strictPort --host 127.0.0.1

# 工作目录为仓库根
node docs/audit-20261011/browser-repro.mjs
```

浏览器脚本的 Vite `/@fs/` 导入使用当前机器的绝对路径，换机器需调整。所有探针与结果独立放在审查目录；Electron/浏览器探针主要采集错误行为，修复时还应将相应预期转换为正式断言。

推荐顺序：

1. F01/F02：统一保存快照、回执和 flush 边界，先避免内容丢失。
2. F03/F04：确保重绘/重解析保持状态、界面与历史一致。
3. F05/F06/F07：统一目录、导出和跨模式保存状态的数据来源。
4. F08 与 P02：监听器去重，源码光标事件减负并恢复视口裁剪。
5. P01/P03：增量派生与异步恢复写盘，加入有代表性的大文档性能基线。
