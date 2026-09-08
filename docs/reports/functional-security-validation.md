# 功能与安全测试报告

日期：2026-09-08

## 结论

当前工作区通过自动化功能测试、安全测试、类型检查、扩展构建和 npm 依赖审计。自动化测试共 12 个套件、147 项用例，全部通过；npm 官方 registry 审计为 0 个已知漏洞。

自动化结果不能替代真实 Chrome 验收。当前环境没有可连接的 Chrome 自动化实例，因此新标签页、侧栏、系统剪贴板和浏览器地址栏焦点的端到端行为未被本轮自动化复现。

## 功能测试

覆盖范围包括 API 请求与错误转换、流式回答、模型参数、页面和选区上下文、会话存储、配置切换、附件选择/拖放/粘贴、图片处理、文本附件、引用、Markdown 展示、国际化、主题、侧栏启动、右键菜单交接及输入框焦点。

重点边界已验证：

- HTTP 错误被转换为用户可读文本并调用 `showError`；聊天原始响应体不再写入控制台。
- 输入框选区可被剪贴板纯文本替换，并触发一次 input 更新。
- 密码框、按钮、select、textarea 和 contenteditable 保持浏览器原生粘贴。
- 图片、文本、空剪贴板、HTML-only 剪贴板、取消事件和超大/不支持附件均有覆盖。
- 右键选区先写入存储再通知侧栏，侧栏未加载时不会依赖不存在的消息接收端。
- 工具栏使用 Chrome 原生 `openPanelOnActionClick` 打开侧栏，右键菜单保留用户手势中的 `sidePanel.open`。

执行命令：

```text
npm test -- --runInBand
npm run test:types
npm run lint
npm run build
```

以上命令均成功，`dist/manifest.json` 的后台脚本、侧栏入口和图标文件均存在，构建产物不包含 docs、design 或 Markdown 报告。

## 安全测试

已验证或静态检查：

- Markdown 先转义后渲染；script、img、iframe、事件属性及 SVG 注入不会成为 DOM 标签。
- Markdown 链接和裸 URL 仅允许 HTTP/HTTPS，危险协议不会生成锚点；外链带 `noopener noreferrer`。
- 历史附件只接受白名单栅格图片的 base64 data URL，拒绝远程 URL、SVG、HTML data URL、javascript URL 和非法 base64。
- API 密钥按会话/持久化策略保存；持久化密钥经过 AES-GCM 保护，未记住的密钥不写入 local storage。
- manifest 没有 `<all_urls>`，主机权限限定为 API 域名，站点访问走 optional permissions。
- 未授权 runtime 消息不能打开侧栏；上下文菜单和存储数据均经过边界处理。
- 剪贴板兜底只读取 `text/plain`，恶意 HTML 作为普通文本写入 textarea，不执行。

## 发现与风险

未发现本轮新增的高危或中危安全缺陷。

已处理的维护风险：此前 `src/sidepanel/sidepanel.ts` 与 `src/utils/api.ts` 各自包含 APIService 实现，行为和错误日志策略可能分叉。现在仅保留侧栏中的唯一实现，已删除 `src/utils/api.ts`，测试直接依赖该实现；超时计时器使用 `globalThis`，非流式 JSON 响应也由同一实现处理。后续新调用方应直接依赖该实现，不再复制 API 逻辑。

## Chrome 实机验收清单

在 Chrome 中重新加载 `dist/` 扩展后执行：

1. 新建标签页，点击页知图标，点击页知输入框，Ctrl+V；内容应进入输入框，地址栏内容不变。
2. 在普通网页、已有侧栏、设置弹窗和新标签页分别重复粘贴；设置 API Key 时不得被兜底粘贴逻辑抢走。
3. 粘贴图片应进入附件栏，粘贴 HTML/XSS 字符串应显示为文本。
4. 右键选中文字选择页知，确认侧栏打开后选区上下文只出现一次。
5. 模拟 API 返回 401、404、500 和超时；错误应出现在对话区域，开发者工具 Console 不应出现聊天原始响应体。

依赖审计命令：`npm audit --registry=https://registry.npmjs.org --json`，结果为 0 个已知漏洞。该结果不等同于完整渗透测试。
