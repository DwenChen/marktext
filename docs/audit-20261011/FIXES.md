# 审查问题修复记录 — 2026-10-11

依据 [原始审查报告](README.md)，在保留现有主题、图标、导出设置和窗口修改的工作区上修复。原始采集结果保留，修复后的浏览器采集写入 `browser-after-fixes.json`。

## 功能修复

| 编号 | 修复                                                                                                                                                                                                                               |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01  | 保存请求携带请求序号、内容签名、文件选项签名和历史 ID；普通保存、另存为、自动保存、批量保存和关闭保存均回传对应快照。每个 tab 的主进程请求串行执行，旧回执不能覆盖新基线。写盘期间继续编辑保持未保存；保存失败或取消不会强制关闭。 |
| F02  | 保存全部、关闭窗口、单独关闭 tab 均先提交待处理编辑。关闭等待恢复文件写盘期间如内容、路径或保存选项变化，会再次持久化；恢复失败时 Restore All 仍提示处理未保存内容。                                                               |
| F03  | 选项更新前先按旧解析选项 flush。源码模式忽略隐藏 Muya 的内容和选择通知，防止偏好修改覆盖源码编辑与光标。                                                                                                                           |
| F04  | 结构重解析记录为独立、可逆的整树重建边界，保留之前的历史。逆操作验证与实际应用成功后才转移栈项；失败恢复文档、选择及记录状态。                                                                                                     |
| F05  | 历史操作先同步 JSON 和真实 block 树，再同步发出内容通知；监听器读取的 Markdown、目录和选择对应同一版本。                                                                                                                           |
| F06  | 导出前冻结 Markdown；目录直接读取该次渲染正文的标题和实际 ID，包括重复标题和显式 HTML 锚点。导出设置的标题探测也读取当前 Markdown。                                                                                                |
| F07  | 保存状态采用跨模式一致的内容签名，避免源码保存后因 Muya 历史 ID 改变而误判未保存。改变编码、换行或尾部换行选项需要重新保存。                                                                                                       |
| F08  | 每个 WebContents 只安装一次搜索销毁钩子，完成和取消搜索不再累积监听器。                                                                                                                                                            |

## 性能与工程改进

- P01：Markdown 按修订与缩进选项缓存；未消费的 `json-change.doc` 延迟复制；引用定义按不变状态节点缓存，标题按文字、解析选项和引用定义缓存；保存判断复用合成历史已计算的签名。
- P02：全文提交和统计改为 CodeMirror `changes` 事件，并用 change generation 去重。光标事件只处理光标与选择；视口范围恢复为 10，CodeMirror 自己滚动。目录跳转、外部重载滚动位置随之验证。
- P03：恢复文件采用按窗口串行异步原子写入，保留 fsync，合并过期快照；等待者在最新快照落盘后才完成。恢复调度最长等待 5 秒。
- 合成历史签名缓存最多 256 项，初始签名独立保留。
- 目录高亮优先识别光标所在标题，避免字体度量使光标矩形高于标题边框而选中上一节。
- 根 Lint 排除 `temp/**`，脚本设置 6 GiB 的堆上限；更新开发说明中的依赖版本、网站 Next.js 工具链和 Electron 沙箱说明。

同一浏览器探针在空闲环境下测量，每组 5 次取中位数：

|   块数 | 原始同步编辑 | 修复后同步编辑 | 修复后派生计算 |
| -----: | -----------: | -------------: | -------------: |
|  1,001 |       7.2 ms |         4.1 ms |         1.3 ms |
|  3,001 |      16.4 ms |        11.4 ms |         4.3 ms |
| 10,001 |      44.4 ms |        34.0 ms |        10.9 ms |

这是合成文档的单机同步路径采样，不是完整输入延迟或 FPS。P01 为局部优化：序列化、全文字数统计、历史前置快照复制和部分块遍历仍与文档规模相关；恢复文件的 JSON 序列化仍在主进程。大 chunk 的启动加载优化未作推测性拆分。

后续针对 P01 的专项研究已完成：同方法空选区探针 33.7 → 27.2 ms；有光标的同路径首块采样 13.0 → 7.7 ms。全文派生计算 10.0 → 7.2 ms。选区读取触发布局的归因、全部场景和追加回归见 [万块文档专项优化](C:/Users/chen/Desktop/marktext-develop/docs/audit-20261011/PERFORMANCE.md)。

## 验证

- Desktop 全量：1080 条通过、36 条跳过；后续保存/关闭边界扩充至 11 条并全部通过。保存、恢复队列、导出和历史签名定向回归共 46 条通过。
- Muya 全量：2479 条通过；2 条图表模块首次加载用例超过默认 5 秒，单独以 30 秒超时重跑，其所在文件 14 条全部通过；新增选项及历史边界 5 条通过。
- CommonMark/GFM 现有基线：1347 条通过，保留既有 expected-failures。
- Muya 类型检查、声明构建、Desktop vue-tsc、根 ESLint、Muya `src test` ESLint、Electron 主进程/preload/renderer 编译通过。
- Lint 无错误，未统一清理现有警告。格式化后按仓库 ESLint 修正 async 间距与条件表达式缩进。
- Electron 相关 18 条通过，包含 `save-outline-regression`、`parity-source-undo-saved`、`external-reload-undo`、`source-mode-flush`、`source-toc-scroll` 和 `toc-preference-live-update`。
- 真实 Electron 写盘时暂停 fsync，保存 A 后继续输入 B 并改变解析偏好：磁盘为 A、编辑器为 B 且仍未保存。另验证当前源码导出锚点、目录撤销、连续 12 次搜索监听器数量稳定、2000 行源码文档的光标移动零全文读取及有限视口。

最后补充的源码选择隔离和保存回执 flush 修改后，重建并重跑相关 13 条 Electron 用例，全部通过。

使用已安装的本地工具直接运行，未重新安装依赖。首次同时运行构建和不限并发的单测出现资源竞争及超时；Desktop 降至 2 workers 后全量通过。Windows 上验证，未运行安装器、全量 Electron E2E 或 macOS/Linux 回归。

主要回归的直接调用：

```powershell
# 仓库根
node --max-old-space-size=6144 node_modules/eslint/bin/eslint.js --cache . --quiet
node node_modules/vitest/vitest.mjs run --config docs/audit-20261011/vitest.config.ts

# packages/desktop
node ../../node_modules/vue-tsc/bin/vue-tsc.js --noEmit
node ../../node_modules/electron-vite/bin/electron-vite.js build --logLevel error
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=2
node ../../node_modules/@playwright/test/cli.js test test/e2e/save-outline-regression.spec.ts test/e2e/parity-source-undo-saved.spec.ts test/e2e/external-reload-undo.spec.ts test/e2e/source-mode-flush.spec.ts test/e2e/source-toc-scroll.spec.ts test/e2e/toc-preference-live-update.spec.ts

# packages/muya
node ../../node_modules/eslint/bin/eslint.js src test --quiet
node ../../node_modules/typescript/bin/tsc --noEmit
node ../../node_modules/vitest/vitest.mjs run --maxWorkers=2
```
