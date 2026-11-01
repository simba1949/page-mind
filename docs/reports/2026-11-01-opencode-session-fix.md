# OpenCode 会话请求头修复验收

日期：2026-11-01（Asia/Shanghai）  
分支：`fix-20261101-1520`，基于最新 `origin/master`；已建立同名远程跟踪分支，修复改动尚未提交。  
范围：API 请求、聊天会话 ID 生命周期、回归测试；未改变界面资源或扩展权限。

## 原因与结果

模型发现和模型推理是不同的请求。原推理请求未携带 `x-opencode-session`，与用户提供的 HTTP 400 完全对应。

[OpenCode Go 官方说明](https://opencode.ai/v2/docs/console/go/#where-can-i-use-it)要求每段会话使用稳定的会话 ID，也要求客户端明确标识自身并发送编程代理类流量。Context7 检索结果未覆盖这项新要求，以直接读取的官方文档为依据。

现在三种 API 格式共用请求层，只在目标 hostname 精确为 `opencode.ai` 时添加会话头。控制器在 `chrome.storage.session` 中保存随机 UUID，与聊天历史共用浏览器会话生命周期。重新打开侧栏、切换配置或模型不会改变当前对话 ID；新建对话会清除旧 ID 并生成新 ID。独立调用 APIService 时也有实例级默认 ID。

此次修复处理缺失会话头，不改变 PageMind 的阅读助手用途，不伪装成其他客户端。没有真实账号联调，不能据此承诺 OpenCode Go 接受一般网页问答。

## 资深架构师视角

- 【潜在风险】若按请求或 APIService 实例生成控制器会话 ID，重开侧栏及切换模型会割裂同一会话。本次由控制器持有并恢复 ID，请求层统一加头；跨面板同时首次创建 ID 的竞争场景未验证。
- 【修改建议（附代码对比）】已落实共享请求层与独立会话存储，无新依赖；只有出现多个独立会话模型时才扩展会话管理。

```ts
// 修改前
return await fetch(url, { ...init, signal: controller.signal });
// 修改后：所有适配器传递 sessionId，到共同请求层处理
if (sessionId && new URL(url).hostname === 'opencode.ai') {
  const headers = new Headers(init.headers);
  headers.set('x-opencode-session', sessionId);
  init = { ...init, headers: Object.fromEntries(headers.entries()) };
}
return await fetch(url, { ...init, signal: controller.signal });
```

## 资深 UI 设计工程师视角

- 【潜在风险】新建对话仅清空可见消息、却继续发送旧会话 ID，会导致界面与后端会话边界不一致。已用 Chromium 验证新建后发送采用新 ID，并检查 360×500 窗口截图：输入区、按钮、预览及聊天区域可见，长回复可滚动。完整用户浏览器侧栏及真实服务错误状态未验证；截图来自隔离测试页面。
- 【修改建议（附代码对比）】已把 ID 更新放在新建对话流程中，不增加用户配置项。

```ts
// 修改前
await Promise.all([StorageService.clearChatHistory(), StorageService.clearConversationHistory()]);
this.renderMessages();
// 修改后：清除聊天同时移除旧 ID，随后取得新的会话 ID
await Promise.all([StorageService.clearChatHistory(), StorageService.clearConversationHistory()]);
this.chatSessionId = await StorageService.getChatSessionId();
this.renderMessages();
```

## 资深测试工程师视角

- 【潜在风险】只测试单一协议或只检查配置可能遗漏 Responses、Anthropic 和历史恢复路径。已覆盖三种协议、模型发现不变、客户端重建、默认 ID、历史恢复、新建会话、非法存储值、其他目标域名及伪造域名。真实 OpenCode 认证、额度和服务端用途策略未验证。
- 【修改建议（附代码对比）】已增加协议参数化测试与 Chromium 请求头及控制器生命周期回归。

```ts
// 修改前：仅验证 OpenAI 请求认证
headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' })
// 修改后：三种格式都检查稳定性与会话切换，并继续检查原认证头
expect(fetchMock.mock.calls.map(([, init]) => new Headers(init.headers).get('x-opencode-session')))
  .toEqual([sessionId, sessionId, nextSession]);
```

验证结果：

- `npm test -- --runInBand`：14 个测试套件、206 项测试通过。
- `npm run test:types`、`npm run lint`：通过。
- `npm run build`：通过，生成 `dist/`。
- `npm run test:browser`：9 项 Chromium 测试通过。网络测试使用模拟响应与测试凭据，验证浏览器发出的请求和真实 DOM 行为。
- 现有 20 万字符流式压力测试通过：输出完整、文本节点保留、阅读位置保持；本机 p95 帧时间为 180ms，该数据不代表真实服务延迟。
- 短窗口截图已查看；`git diff --check` 通过。

## 资深安全工程师视角

- 【潜在风险】把会话头加到所有自定义 API 会泄漏跨服务关联标识，使用页面内容生成标识则可能泄漏隐私。已使用随机 UUID、精确 hostname 匹配，并测试欺骗性子域名和路径。未增加权限、未保存真实密钥、未改变模型输出渲染。
- 【修改建议（附代码对比）】已限制头的发送范围，并校验存储 ID；自定义代理转发场景未验证，不自动向代理发送会话标识。

```ts
// 修改前：无会话存储校验或会话头发送规则
// 修改后
if (typeof stored === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(stored)) return stored;
// 只有 new URL(url).hostname === 'opencode.ai' 时添加 x-opencode-session
```

## 【综合评审结论】

通过

结论限于上述代码审查、自动化测试和模拟后端的 Chromium 验证范围。真实服务联调仍未验证。浏览器扩展管理页重新加载 `dist/` 后即可使用本地构建。
