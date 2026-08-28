# 页知 (PageMind) 安全报告

- **日期**: 2026-08-28
- **审计范围**: 本批未提交改动（附件上传/粘贴、引用、思考过程、Markdown 链接、主题与 manifest 调整）+ 既有安全面复核
- **方法**: 威胁建模 → 攻击者视角注入矩阵测试（`tests/security.test.ts`）→ 持久化数据边界测试 → 权限/CSP 静态审计（`tests/ui-static.test.ts`）
- **结论**: 发现并修复 1 项中危（F1），其余攻击面均处于「已防护 + 已有测试钉住」状态；无高危未决项

## 一、威胁模型

| # | 攻击者 | 入口 | 最坏后果 |
|---|---|---|---|
| T1 | 恶意/被投毒的 AI 输出 | `renderMarkdown`（唯一 `innerHTML` 入口） | 侧边栏内执行任意 HTML/JS（XSS） |
| T2 | 被篡改的本地聊天历史 | `chrome.storage.local` 反序列化 | 伪造消息、加载远程图片（追踪/内网探测） |
| T3 | 恶意网页 | 页面正文/选中文字进入 prompt | 提示注入（诱导 AI 误导用户） |
| T4 | 本机其他进程/用户 | manifest 权限面、密钥存储 | 权限滥用、密钥泄露 |
| T5 | 网络中间人 | 自定义 API 端点 | 密钥/对话明文窃听 |

## 二、发现与处置明细

### F1（中危 · 本轮修复）历史附件图片未校验 dataUrl 前缀

- **位置**: `sanitizeAttachments`（sidepanel.ts）
- **问题**: 净化持久化历史时只截断 `dataUrl` 长度、不校验前缀。若 `chat_history` 被篡改（其他本机进程或存储损坏），`img.src` 可指向远程 URL（追踪像素、内网地址探测）或 `data:text/html`。
- **修复**: 图片附件强制 `data:image/` 前缀，否则整条丢弃；已随构建进入 dist。
- **测试**: `attachments.test.ts` — `https://` / `data:text/html` / `javascript:` 三向量全部拒绝。

### F2（高危面 · 已防护 + 已测）AI 输出 XSS

- **防护架构**: `renderMarkdown` 采用 escape-first——输入在**任何**解析前整体 HTML 转义，此后只追加渲染器自生成的标签；攻击者内容在结构上不可能成为标签。
- **测试**: 8 种块类型注入矩阵（段落/标题/列表/引用/表格单元格/事件处理器属性/iframe），`<script>`、`<img onerror>`、`<svg onload>`、`<iframe>` 一律以转义文本呈现。代码块与行内代码内容同样转义。

### F3（中危面 · 已防护 + 已测）危险链接协议

- **防护**: Markdown 链接与裸 URL 白名单均为 `http(s)://`（大小写敏感匹配，`JavaScript:` 变体不逃逸）；渲染器无图片语法，`![x](url)` 不产生 `<img>`。
- **测试**: `javascript:` / `JavaScript:` / `data:text/html` / `vbscript:` 四向量 + 裸文本危险协议 + 图片语法走私，均不成链。
- **加固**: 所有生成锚点携带 `target="_blank" rel="noopener noreferrer"`（防 tab-nabbing）。

### F4（低 · 已防护 + 已测）属性逃逸

- URL 内引号经 escape-first 只会以 `&quot;` 存在，无法闭合 `href` 注入 `onmouseover` 等属性；链接文字中的标记同样保持转义。测试断言原始 `"onmouseover="` 不出现、`&quot;` 形式出现。

### F5（低 · 已防护）innerHTML 之外的注入路径

- 思考过程正文、用户消息、附件文件名、引用预览均经 `textContent` 或 DOM 属性赋值写入，无字符串拼 HTML；图片缩略图 `src` 在 F1 修复后仅接受 `data:image/`。
- 内部掩码占位符（`\x00`/`\x01` 序列）在输出前必然还原，测试断言输出不含原始控制字符（也保护 grep/IDE 不被字节污染）。

### F6（权限面 · 最小化 + 已测）manifest

- **必选**主机权限仅两个 API 端点（`api.openai.com`、`api.anthropic.com`）；**无 `<all_urls>` 必选权限**；读取任意网站需 `optional_host_permissions` 中的 `https://*/*` 经用户在 UI 中显式授权（未授权时显示 🔒 授权条而非静默失败）。
- `unlimitedStorage`（本轮新增）仅扩大存储配额，不扩大访问面。
- **测试**: 权限清单逐项锁死——多一个权限、`<all_urls>` 进必选清单都会 fail。

### F7（凭据面 · 已防护 + 已测）API 密钥

- 加密存储（AES，随机 IV，`crypto.test.ts`）；「记住密钥」未勾选时密钥只进 `chrome.storage.session`（浏览器关闭即清，`storage.test.ts` 验证不落盘）；输入框 `type="password"` + `autocomplete="new-password"`（防浏览器把密钥当账号密码自动填充/同步）。

### F8（CSP 面 · 默认安全 + 已测）内容安全策略

- 未自定义 CSP → 采用 MV3 默认（远程代码禁止、`script-src 'self'`）；页面唯一脚本是外部 module，无内联 `<script>`、无内联事件处理器（ui-static 测试锁死）。纵深意义：即使未来出现 F2 类转义遗漏，注入的远程/内联脚本也过不了 CSP。

### F9（提示注入面 · 已缓解）网页内容 → prompt

- 页面正文以 `=== PAGE REFERENCE ===` / `=== END OF REFERENCE ===` 定界并入 prompt，并声明「仅作参考材料」；附件文本同样定界；页面内容截断 8000 字。
- 恶意网页最坏影响是诱导 AI 输出误导性回答——网页无法触达扩展 API 或 DOM。对 AI 助手属固有风险，现有缓解为定界隔离。

## 三、安全测试映射（30+ 用例）

| 套件 | 安全相关用例 | 对应发现 |
|---|---|---|
| `security.test.ts`（18） | 全部 | F2 / F3 / F4 / F5 |
| `attachments.test.ts` | 7（sanitizeAttachments 组） | F1 / T2 |
| `ui-static.test.ts` | 8（权限 3 + HTML 卫生 5） | F6 / F7 / F8 |
| `storage.test.ts` + `crypto.test.ts` | 10（密钥隔离/加密） | F7 / T4 |
| `markdown.test.ts` | 2（safety 组） | F2 |

## 四、残余风险与建议

| # | 等级 | 描述 | 建议 |
|---|---|---|---|
| R1 | 低 | 自定义端点允许 `http://`（localhost 除外场景），明文 http 端点会明文传输密钥与对话（T5） | 保存设置时对非 localhost 的 http 端点弹警告 |
| R2 | 低 | SSE 流式解析与 service worker 消息处理无单测（`sidepanel.ts` 覆盖率 16% 的主因） | 抽纯函数后补测 |
| R3 | 信息 | 聊天历史（含附件）明文存 `chrome.storage.local`；密钥已加密但历史未加密 | 如需更强保护可复用现有 crypto 基建对历史整体加密 |
| R4 | 信息 | 「记住密钥」勾选时密钥加密落盘，本机管理员仍可解密（密钥派生存于同一 profile） | 属产品定位内的可接受残留 |

## 五、结论

本轮安全审计在新增功能（附件、思考过程、链接）上未发现未防护的高危路径；修复 1 项中危（历史图片 dataUrl 校验），并以 30+ 个安全相关用例将各攻击面行为固化，防止后续改动无意回退。
