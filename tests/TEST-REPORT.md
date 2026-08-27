# 页知 (PageMind) 测试报告

- **日期**: 2026-08-27
- **执行方式**: `npm test`（jest）、`npm run test:types`（tsc 全量类型检查）
- **结果**: ✅ **6 个测试套件、43 个用例全部通过**，类型检查零错误

## 一、结果总览

| 指标 | 结果 |
|---|---|
| 测试套件 | 6 passed / 6 total |
| 测试用例 | 43 passed / 43 total |
| 用时 | ~1.8s |
| `tsc -p tsconfig.test.json` | 0 错误（修复了 PyCharm 报的 TS2740） |
| `tsc --noEmit`（构建配置） | 0 错误 |

## 二、各套件明细

### 1. `tests/markdown.test.ts` — Markdown 渲染器（22 例）

针对原子化重构后的渲染器（`renderMarkdown` / `tableToMarkdown` / `escapeHtml`）：

| 分组 | 用例数 | 覆盖点 |
|---|---|---|
| 安全 | 2 | `<script>`、`onerror` 等注入内容一律转义为纯文本（防 XSS） |
| 围栏代码块 | 3 | 语言标签、复制按钮、内容转义、多块顺序、中间正文 |
| 标题 | 1 | `##` → `<h2>` 层级映射 + 行内加粗 |
| 行内格式 | 3 | 粗体/斜体/删除线/行内代码/链接；代码内的 `*` 不被误解析；`javascript:` 协议不成链 |
| 列表 | 3 | 无序/有序、缩进续行并入上一项、普通文本终止列表 |
| 引用块 | 1 | `>` 前缀剥离、多行合并 |
| 表格 | 2 | 完整渲染（表头/分隔行/单元格行内代码/复制按钮）；**无分隔行的表格行降级为段落（防死循环回归）** |
| 分隔线 / 段落 | 2 | `---` → `<hr>`；连续行以 `<br>` 连接 |
| 表格还原 | 2 | DOM → Markdown 源码重建（含 `**加粗**`、`` `代码` ``、链接、`\|` 转义） |

> 其中「无分隔行降级为段落」是此前页面卡死事故的回归测试：流式输出中表头先到、`|---|` 未到时，渲染必须前进而非死循环。

### 2. `tests/sidepanel-helpers.test.ts` — 自定义模型解析（4 例）

逗号/换行分隔、trim、去空、去重、100 条上限、空输入。

### 3. `tests/storage.test.ts` — 设置与历史存储（8 例）

默认设置兜底、stored 与默认值合并（`customModels` 透传、部分 api 对象补全默认值）、**API 密钥只从 session 读取**、存储异常回退默认值、保存时密钥不落盘（session 隔离）、空密钥清理 session、历史追加与 100 条裁剪。

### 4. `tests/crypto.test.ts` — 密钥加密（2 例）

加解密往返、同明文密文不同（随机 IV）。

### 5. `tests/i18n.test.ts` — 国际化（4 例）

中英文切换、缺失 key 回退、全量字典导出。

### 6. `tests/api.test.ts` — API 服务（7 例）

缺密钥拒绝、请求形状（URL/方法/Authorization 头）、错误消息透传、内容截断（含 `...` 后缀/短内容不动）。

## 三、覆盖率

```
---------------|---------|----------|---------|---------|
File           | % Stmts | % Branch | % Funcs | % Lines |
---------------|---------|----------|---------|---------|
 i18n/index.ts |   100   |   100    |   100   |   100   |
 utils 均值     |  73.77  |  48.48   |  62.5   |  76.72  |
 sidepanel.ts  |  13.19  |  11.01   |  24.44  |  12.73  |
---------------|---------|----------|---------|---------|
```

说明：`sidepanel.ts` 覆盖的是纯函数层（渲染器/解析器），DOM 控制器部分依赖 Chrome 扩展运行时（`chrome.storage`、`chrome.scripting` 等），由浏览器内手工验证覆盖；`utils` 未覆盖的分支主要是流式响应解析（SSE），后续可补。

## 四、本次测试基建改进

1. **修复 PyCharm TS2740**：chrome mock 只实现用到的命名空间，在唯一入口 `installChromeMock()` 以显式断言安装（`as unknown as typeof chrome`），测试文件全部拿到强类型 mock。
2. **删除死代码**：`tests/setup.ts`（从未接入 jest 配置）与旧 `tests/unit.test.ts`（类型错误源头）移除，按关注点拆分为 6 个套件文件 + 共享 `tests/helpers/chrome.ts`。
3. **新增 `tsconfig.test.json` + `npm run test:types`**：让命令行也能做全量类型检查，此类「IDE 报错但 jest 静默」的问题以后在终端即可拦截（此前 tsconfig 排除了 tests、ts-jest 关闭了诊断，两个通道都看不到）。
4. **`sidepanel.ts` 纯函数改为可导出**（`export` + `<script type="module">` + 扩展环境启动守卫），使渲染器可被单元测试导入。

## 五、复跑方式

```bash
npm test              # 运行全部用例
npm run test -- --coverage   # 带覆盖率
npm run test:types    # 测试代码全量类型检查
```
