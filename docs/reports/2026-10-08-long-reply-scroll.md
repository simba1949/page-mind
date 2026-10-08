# 长 AI 回复滚动修复验收

日期：2026-10-08。范围：用户反馈的生成中、生成完成后均无法自由滚动。

修复分支：`fix-20261008-1703`，基于当时最新 `origin/master`（`80cbdba`）。未修改扩展权限、接口协议、历史记录格式或模型输出长度上限。

## 问题与修改

上一轮的 `min-height: 0` 和流式纯文本渲染已在 master 中。本次浏览器复现发现，它们没有覆盖以下情况：

1. 短窗口中，快捷操作等输入区内容仍能把消息区挤到仅 32px，输入区底部超过 500px 视口，达到约 602px。现在输入区最多占主区域一半，快捷操作、附件列表优先独立滚动，保留消息区和编辑器。
2. 原先“距底部 80px 内自动跟随”会覆盖用户小幅上滚；浏览器实测上滚 40px 后，下个输出帧又把位置拉回底部。现在向上滚动立即暂停跟随，滚回实际底部后恢复；滚动事件同时支持键盘和滚动条引起的位置变化。
3. 每帧设置完整 `textContent` 会替换已累计的文本节点。现在只追加新后缀，保留同一节点和流式选区；结束时仍只执行一次安全 Markdown 渲染。
4. Markdown 排版后高度可能缩小，浏览器会把原来的滚动位置钳制到底部。现在保留当前回复内的相对阅读位置；若读者在较早消息中，则保留原滚动位置。相对位置不是精确的段落/字符锚点，转换格式时仍可能有小范围排版位移。
5. 保存历史记录完成后的旧自动滚动，以及异常结束时的强制滚动，会覆盖等待期间的用户操作。现在结束态跟随在保存前处理，错误提示也尊重当前暂停状态。

## 验证结果

| 检查 | 结果 |
| --- | --- |
| `npm test -- --runInBand` | 14 个套件，191 项通过 |
| `npm run test:browser` | 8 项 Chromium 行为测试通过 |
| `npm run test:types` | 通过 |
| `npm run lint` | 通过 |
| `npm run build` | 通过，已重新生成 dist |
| `git diff --check` | 通过 |
| `npm audit --omit=dev` | 生产依赖未报告已知漏洞；不代表完整安全证明 |

Chromium 测试使用项目真实 HTML/CSS 和编译后的控制器，运行在隔离文档中；拦截网络，模拟 API 和存储，不使用用户浏览器会话或真实密钥。测试不是安装后的扩展端到端测试。

8 项测试覆盖：

- 360×500 短视口、10 个快捷操作和长回复；消息区至少保留主区域 45% 的可用高度，发送按钮位于视口内，快捷操作列表可滚动。
- 完成后的长 Markdown、长代码块和 5000 行表格：上下滚动、触底、Home/PageDown。
- 距底部上滚 40px、滚动条等效位置变化、生成中 Home：后续输出不抢回位置，回底部后恢复跟随。滚动条场景通过设置 scrollTop 并触发浏览器原生滚动事件验证，未实测鼠标拖动原生滚动条。
- 等待存储时手动上滚：存储完成不回跳。
- 正常完成、连接中断：Markdown 转换保留相对阅读位置，异常保留部分回复并显示错误。
- 新回复最终排版不移动正在阅读旧消息的视口。
- 20 万字符分 200 批输出：内容完整，同一文本节点持续追加；输出中途使用真实鼠标滚轮上滚，剩余输出不覆盖阅读位置。

最后一次压测的帧等待时间 p95 约 75.7ms，包含浏览器调度/布局时间，且受机器负载影响。这验证了该长度下的内容完整性与滚动交互，不代表达到 60fps，也不作稳定百分比提速承诺。

已检查短窗口截图：快捷操作列表受限并可独立滚动，输入框和发送按钮可见。用户实际安装的 Chrome 侧栏、真实 API 网络和触控设备：**未验证**。

复现自动化检查：安装项目开发依赖后执行 `npm run test:browser`；若缺少测试浏览器，先执行 `npx playwright install chromium`。Playwright 仅为开发依赖，不进入扩展构建产物。

## 四维验收

### 资深架构师视角

【潜在风险】滚动跟随属于用户交互状态，不能只根据距离推断；结束态与异步存储的先后顺序可能造成竞争。

【修改建议（附代码对比）】已落实：将跟随状态显式保存在控制器中，保留既有合帧和最终 Markdown 路径，不引入运行时依赖。

```ts
// 修改前
const stick = this.isChatNearBottom();
await this.saveChatHistory();
if (stick) this.scrollToBottom();

// 修改后：用户上滚暂停，到底部恢复
const stick = this.followStream;
if (stick) this.scrollChatBottomInstant();
await this.saveChatHistory();
```

### 资深 UI 设计工程师视角

【潜在风险】仅允许消息区收缩仍会被过高输入区挤占；只给整个输入区加滚动，会隐藏编辑器。极小高度或大量附件仍可能需要输入区兜底滚动。用户安装的 Chrome 侧栏视觉效果未验证。

【修改建议（附代码对比）】已落实：限制输入区高度，固定编辑器所在部分，让可增长列表优先收缩滚动；消息区可聚焦以使用键盘翻页。

```css
/* 修改前：输入区无高度上限，快捷操作列表无限增长 */
.input-container { padding: var(--space-md) var(--space-lg); }

/* 修改后：省略未改变样式 */
.input-container {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  max-height: 50%;
  overflow-y: auto;
}
.input-container > * { flex-shrink: 0; }
.input-container > .quick-actions,
.input-container > .attachment-bar {
  flex-shrink: 1;
  min-height: 0;
  overflow-y: auto;
}
```

### 资深测试工程师视角

【潜在风险】静态样式断言无法证明浏览器可以滚动，DOM 模拟环境也不具备真实布局；最终 Markdown 重排和失败路径易被漏测。

【修改建议（附代码对比）】已落实：保留既有单元/安全测试，增加真实 Chromium 行为测试与 20 万字符压力场景，不只断言源代码包含某个字符串。

```js
// 修改前：主要为静态实现契约
expect(streamBody).toContain('contentEl.textContent = message.content');

// 修改后：追加可执行浏览器行为检查（示意）
await wheel(page, -40);
const before = await page.evaluate(() => panel.chatMessages.scrollTop);
// 调用真实 scheduleStreamRender 并等待浏览器渲染
assert.ok(Math.abs(after - before) <= 2);
```

### 资深安全工程师视角

【潜在风险】模型文本不可信，性能优化不能把增量文本直接作为 HTML；新增浏览器测试依赖不能进入生产扩展或扩大权限。真实 API/安装态联动未验证。

【修改建议（附代码对比）】已落实：增量使用文本 API，最终渲染沿用现有转义和链接协议限制；manifest 未修改，测试依赖仅在开发环境，测试网络被拦截。

```ts
// 修改前：安全，但整段替换节点
contentEl.textContent = message.content;

// 修改后：保持文本语义，只追加后缀
text.appendData(content.slice(text.length));

// 最终渲染保持原有安全路径
contentEl.innerHTML = renderMarkdown(content);
```

【综合评审结论】通过

结论限于本次代码审查、自动化和隔离 Chromium 布局/交互验收；未验证项目不视为通过。请在浏览器扩展管理页重新加载 `D:\Workspace\Codebase\Project\page-mind\dist`，关闭并重新打开页知侧栏，再使用真实长回复确认。
