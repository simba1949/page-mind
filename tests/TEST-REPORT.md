# 页知 (PageMind) 测试报告

- **日期**: 2026-08-28（第 3 轮，覆盖「附件上传/粘贴、引用、思考过程、链接、主题和谐」整批未提交改动）
- **执行方式**: `npm test`（jest）、`npm run test:types` + `npm run lint`（两套 tsc 全量类型检查）、`npm run build`
- **结果**: ✅ **9 个测试套件、101 个用例全部通过**，两套类型检查零错误，构建成功
- **安全专项**: 见 [SECURITY-REPORT.md](./SECURITY-REPORT.md)

## 一、结果总览

| 指标 | 结果 |
|---|---|
| 测试套件 | 9 passed / 9 total |
| 测试用例 | 101 passed / 101 total（上一轮 61，**本轮 +40**） |
| 用时 | ~0.7s |
| `tsc -p tsconfig.test.json`（含 tests） | 0 错误 |
| `tsc --noEmit`（构建配置） | 0 错误 |
| `npm run build` → dist | 成功 |
| 源文件原始控制字符扫描（\x00/\x01 等） | 0 个（占位符测试已改为转义文本写法） |

## 二、各套件明细

| 套件 | 用例 | 覆盖点 |
|---|---|---|
| `markdown.test.ts` | 25 | 渲染器全量：代码块/标题/行内格式/列表/引用/表格/分隔线/段落、表格→Markdown 还原、裸 URL 链接化（含中文标点边界）、**无分隔行表格降级为段落（防卡死回归）** |
| `security.test.ts` 🆕 | 18 | 安全专项：各块类型 XSS 注入、危险协议链接、属性逃逸、锚点安全属性、占位符不泄漏 |
| `attachments.test.ts` | 16 | 附件分类（图片/文本/未知二进制拒收）、提示词包裹、`sanitizeAttachments` 历史净化（7 例）、`filesFromDataTransfer` 粘贴/拖拽提取（3 例） |
| `ui-static.test.ts` 🆕 | 12 | 静态回归：浅色主题发送按钮禁用态优先级、按钮同尺寸、蓝色家族统一、manifest 权限最小化、HTML 无内联脚本/内联事件处理器 |
| `sidepanel-helpers.test.ts` | 11 | 自定义模型解析（4）+ 思考过程分离 `stripThinkTags`（4）+ 流式思考分隔器 `createThinkSeparator`（3，含标签跨分片切断） |
| `storage.test.ts` | 8 | 设置合并/兜底、密钥 session 隔离、历史 100 条裁剪 |
| `api.test.ts` | 5 | 缺密钥拒绝、请求形状、错误消息、内容截断 |
| `i18n.test.ts` | 4 | 中英切换、缺失回退、字典导出 |
| `crypto.test.ts` | 2 | 密钥加解密往返、随机 IV |

### 本轮新增用例（+40）对应改动

1. **附件功能**（`attachments.test.ts` +10）：`sanitizeAttachments` 验证持久化历史不可塞入非 `data:image/` 图片（本轮顺手加固：修复前远程 URL 可作为 `img.src` 被加载）、字段截断上限（name 200 / mime 100 / dataUrl 3MB / text 64k）、最多 4 个附件、坏形状条目丢弃；`filesFromDataTransfer` 只取 `kind === 'file'` 条目、空事件安全。
2. **安全专项**（`security.test.ts` 🆕 18）：见安全报告第三节。
3. **UI/权限静态回归**（`ui-static.test.ts` 🆕 12）：本两轮主题修复中真实发生过的 CSS 优先级 bug（`:root[data-theme="light"] .send-btn` 压过 `.send-btn:disabled`，导致空输入时按钮亮蓝）现在有回归测试钉住 `:not(:disabled)` 写法；attach/send 48px 同尺寸、快捷按钮与欢迎图标蓝色家族（禁 `--accent-warm` 回潮）；manifest 权限清单锁死为最小集合、`<all_urls>` 只能出现在 optional；页面无内联脚本与内联事件处理器、输入长度上限、密码框 `autocomplete="new-password"`、文件选择器不含原生可执行文件。
4. **思考过程 / 裸链接**（前期本轮改动内）：`stripThinkTags` 4 例（含 `<thinking>` 长拼写、未闭合标签按思考处理）、`createThinkSeparator` 3 例（跨分片 `<th` + `ink>` 重组、孤悬 `<` 放行）；裸 URL 中文标点边界 3 例。

## 三、覆盖率

```
Statements : 21.28% (338/1588)    Branches : 20.2%  |  Functions : 31.39%  |  Lines : 21.04%
 i18n/  crypto.ts : 100% 全维度
 storage.ts : 71%   api.ts : 63%   sidepanel.ts : 16%（纯函数层已覆盖，控制器层依赖 Chrome 运行时）
```

说明与上轮一致：`sidepanel.ts` 未覆盖部分集中在 `SidePanelController`（依赖 `chrome.*` 与真实 DOM，由浏览器内手工验证覆盖）与 SSE 流式解析循环（后续可抽纯函数补测）。

## 四、本轮测试基建改动

1. `sanitizeAttachments` / `filesFromDataTransfer` 改为导出以纳入单测（与此前渲染器导出同一模式）。
2. 新增两类此前没有的测试形态：**安全专项**（攻击者视角的注入向量矩阵）与**静态回归**（node 环境无法渲染的 CSS/manifest/HTML 规则直接读源文件断言，防止已修复的样式 bug 被无意回退）。
3. 修复一个测试编写隐患：正则中的占位符曾以原始 \x00/\x01 字节写入源文件（会破坏 grep/IDE），已统一改为 `\u0000` 转义文本写法，并加入 C0 控制字符扫描作为自检。

## 五、复跑方式

```bash
npm test                      # 运行全部用例
npm run test -- --coverage    # 带覆盖率
npm run test:types            # 含 tests 的全量类型检查
npm run build                 # 构建 dist（chrome://extensions 加载目录）
```
