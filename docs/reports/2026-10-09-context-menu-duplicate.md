# askAI 右键菜单重复注册修复

验收日期：2026-10-09。修复分支：`fix-20261008-1728`。

## 原因与范围

原来的 `runtime.onInstalled` 回调不检查已有菜单，直接创建固定 ID `askAI`，也没有提供创建完成回调检查 `runtime.lastError`。Chrome 官方文档说明，同一扩展的菜单 ID 必须唯一，创建错误在回调中报告；未打包扩展重新加载会触发安装事件，原因是 update。因此已有菜单时，这条创建路径会产生用户报告的 duplicate ID 错误。

参考：[contextMenus 官方文档](https://developer.chrome.com/docs/extensions/reference/api/contextMenus)、[runtime 官方文档](https://developer.chrome.com/docs/extensions/reference/api/runtime)。按 Context7 技能核对 API 文档；本次未提供 Context7 连接，使用官方文档作为替代，采用与当前项目类型定义兼容的回调 API。

修改为：清理本扩展旧菜单 → 等清理完成 → 创建 askAI。初始化进行中不启动第二轮；清理与创建的回调都读取 lastError，明确报告失败并释放初始化状态，允许下一次安装/更新事件重试。

只改变菜单注册流程，菜单标题、选中文字场景、点击后打开侧栏的用户手势路径保持不变。不清理聊天记录或配置，不增加权限/依赖。分支从当时最新 origin/master 创建，并保留上一轮长回复滚动修复；用户提交的 AGENTS.md 重命名没有被覆盖。

## 验证

- 修复前新增测试可复现 `Cannot create item with duplicate id askAI`。
- 修复后 14 个 Jest 套件、197 项测试通过。
- 新增 6 项菜单测试：首次安装；已有菜单更新；重叠事件和后续重载；普通后台启动不重复注册；清理失败处理与重试；创建失败处理与重试。
- 测试模拟菜单持久状态及仅在 API 回调期间存在的 lastError，检查不存在未读取的异步错误；原有点击菜单时同步打开侧栏、消息授权校验等测试仍通过。
- 8 项 Chromium 长回复滚动测试通过，保留上一次修复。
- `npm run test:types`、`npm run lint`、`npm run build`、`git diff --check` 通过。
- 隔离 Chromium 实际加载构建后的未打包扩展成功，使用真实 contextMenus.update 回调确认 askAI 存在。
- **真实重新加载链路未验证**：隔离 Chromium 的 runtime.reload 探测等待新后台服务超时；随后尝试打开扩展页时返回 ERR_BLOCKED_BY_CLIENT，未继续绕过限制。这项探测不能计为通过。用户日常 Chrome 中的原生右键菜单外观和重新加载行为也未验证。

## 四维验收

### 资深架构师视角

【潜在风险】异步清理未完成就创建或初始化重叠，会再次重复注册。removeAll 清理本扩展的全部菜单；当前仅有 askAI，未来新增菜单时应统一重建。

【修改建议（附代码对比）】已落实：清理回调串联创建，并以初始化状态排除重叠执行；只在安装/更新事件重建，不在每次后台唤醒时重建。

```ts
// 修改前
chrome.contextMenus.create({ id: 'askAI', title: '页问', contexts: ['selection'] });
// 修改后（省略错误处理）
if (this.contextMenuInitializing) return;
this.contextMenuInitializing = true;
chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({ id: 'askAI', title: '页问', contexts: ['selection'] }, () => {
    this.contextMenuInitializing = false;
  });
});
```

### 资深 UI 设计工程师视角

【潜在风险】创建失败后菜单可能暂时不可用；原生菜单外观与用户实际 Chrome 的重载行为未验证。

【修改建议（附代码对比）】已落实：保持菜单标题、出现条件及点击行为；失败明确记录，下一次重载可重试。实际 Chrome 仍需人工验收。

```ts
// 修改前与修改后保持一致
{ id: 'askAI', title: '页问', contexts: ['selection'] }
// 点击路径保持：先在用户手势内打开侧栏，再异步保存选区
this.openSidePanel(tab.id);
```

### 资深测试工程师视角

【潜在风险】普通无状态 create mock 无法发现重复 ID；只检查函数调用会遗漏 lastError 没有被处理的问题。

【修改建议（附代码对比）】已落实：补充菜单状态、异步回调、错误生命周期、重复事件和失败后重试测试，先复现再验证修复。

```ts
// 修改前
contextMenus: { create: jest.fn(), /* ... */ }
// 修改后：测试模拟持久菜单，调用结束后检查
expect(state.unchecked).toEqual([]);
expect([...state.menus.keys()]).toEqual(['askAI']);
```

### 资深安全工程师视角

【潜在风险】仅屏蔽控制台消息并不能修复注册失败；清理范围不能扩大到用户存储或其他扩展。

【修改建议（附代码对比）】已落实：仅调用当前扩展的菜单清理 API，manifest、存储处理和选区安全边界不变；创建/清理失败不静默吞掉。

```ts
// 修改前：创建没有完成回调
chrome.contextMenus.create(properties);
// 修改后：回调内读取并报告 API 错误
chrome.contextMenus.create(properties, () => {
  this.contextMenuInitializing = false;
  const error = chrome.runtime.lastError;
  if (error) console.error('Failed to create context menu:', error.message);
});
```

【综合评审结论】通过

结论仅针对代码及已完成的验证；未验证项不计为通过。构建目录为 `D:\Workspace\Codebase\Project\page-mind\dist`。请在浏览器扩展管理页重新加载该目录中的扩展，清除旧错误记录，再选择网页文字检查右键菜单及新增错误记录。无需卸载扩展或清除历史记录。
