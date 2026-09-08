# 页知 — PageMind

> 浏览器阅读伴侣。读懂任何页面，提出任何问题，即刻获得 AI 回答。

---

## 概述

页知是一款 Chromium 浏览器扩展，能够读取您正在浏览的页面（或选中的文字），让您随时向 AI 提问 —— 总结、解释、翻译，或者随意提问。无需复制粘贴，无需切换窗口。

基于 Manifest V3 构建，纯 TypeScript + CSS。支持任意实现 `openai-chat`、`openai-responses` 或 `anthropic-messages` 协议的 API。

**产品名：** PageMind  
**中文名：** 页知

---

## 功能

### 核心

- **页面感知问答** — 自动读取当前页面并作为上下文发送给 AI。询问关于当前页面的任何问题。
- **选中文字问答** — 在任意页面选中文字，右键点击"询问页知"，获取针对该文字的 AI 回答。
- **快捷操作** — 一键总结、解释、翻译当前页面。

### API 格式

- **协议驱动** — 不绑定供应商，用户输入 API 端点和密钥；支持上述三种协议。
- **自定义 Base URL** — 指向任意自定义端点。
- **模型发现** — 从 API 端点获取可用模型列表，从下拉框中选择。

### 安全与隐私

- **API 密钥加密** — API 密钥使用 AES-GCM 加密后存储。
- **会话级存储** — 默认情况下 API 密钥仅存储在 `chrome.storage.session` 中，关闭浏览器即清除。可勾选"在此设备记住密钥"持久化到 `chrome.storage.local`。
- **页面内容不离开您的控制** — 内容仅发送给您配置的 API，且仅在您提问时发送。
- **DOM 永不修改** — 提取内容前克隆页面元素，不触碰原页面。

### 语言

- **双语界面** — 支持中文（默认）和英文，随时切换。
- **可扩展国际化** — 代码结构支持轻松添加更多语言。

### 侧边栏

- 持续显示侧边栏，浏览时保持打开。
- **标签页感知** — 切换标签页或单页应用导航时自动切换上下文。
- **SPA 导航检测** — 使用 `webNavigation.onHistoryStateUpdated` 捕获客户端路由变化。

---

## 安装

### 手动安装（开发推荐）

1. 克隆仓库并安装依赖：
   ```bash
   git clone <repo>
   cd page-mind
   npm install
   ```

2. 构建扩展：
   ```bash
   npm run build
   ```

3. 打开 Chrome 进入 `chrome://extensions/`。
4. 开启**开发者模式**（右上角开关）。
5. 点击**加载已解压的扩展程序**，选择 `dist/` 文件夹。

### Chrome 网上应用店

*即将推出。*

---

## 使用方法

### 首次配置

0.1.2 使用多 API 配置协议；默认仅保存在当前浏览器会话中。支持任意实现 `openai-chat`、`openai-responses` 或 `anthropic-messages` 协议的服务，端点可自行填写。

1. 点击工具栏中的页知图标打开侧边栏。
2. 点击**设置**（齿轮图标）。
3. 选择 **API 格式**（OpenAI 兼容或 Anthropic 兼容）。
4. 输入 **API 端点**（如 `https://api.openai.com/v1`）。
5. 输入您的 **API 密钥**。
6. 点击**测试连接**验证。
7. 保存后自动获取模型列表。
8. 从头部下拉框中选择一个模型。

### 询问关于页面

- 打开侧边栏，当前页面自动显示在预览条中。
- 输入问题并按 Enter 发送，AI 以页面内容为上下文进行回答。

### 询问关于选中文字

1. 在页面上选中任意文字。
2. 右键点击并选择**询问页知**。
3. 侧边栏打开，选中文字显示在预览条中。
4. 输入问题并按 Enter 发送。

### 快捷操作

点击输入框上方的快捷按钮：

| 按钮 | 操作 |
|--------|------|
| ▤ 总结 | "总结当前页面的主要内容。" |
| ◎ 解释 | "用通俗易懂的语言解释当前页面最重要的内容。" |
| 文 翻译 | "将当前页面的关键内容翻译成中文。" |

### 语言切换

点击头部语言指示器（中 / EN）切换中英文界面。

---

## 项目结构

```text
page-mind/
├── agent.md
├── README.md / README-EN.md
├── manifest.json
├── package.json / package-lock.json
├── tsconfig*.json / jest.config.js
├── src/
│   ├── background/
│   ├── content/
│   ├── sidepanel/
│   ├── i18n/
│   ├── utils/
│   └── types/
├── assets/icons/
├── scripts/
│   ├── copy-assets.js
│   └── generate-icons.js
├── tests/
│   ├── *.test.ts
│   └── helpers/
├── docs/
│   ├── CHANGELOG.md
│   ├── CODE_REVIEW.md
│   ├── reports/
│   └── design/
└── dist/
```

目录职责与新增文件规范见 [agent.md](agent.md)。`dist/` 为生成的扩展目录；测试报告放在 `docs/reports/`，设计源稿放在 `docs/design/`。

---

## 开发

### 构建

```bash
npm run build
```

### 测试

```bash
npm test
```

### 添加新语言

1. 在 `src/sidepanel/sidepanel.ts` 的 `translations` 对象中添加翻译。
2. 确保所有 UI 元素在 `updateUILanguage()` 中引用了翻译键。

---

## 技术栈

| 组件 | 技术 |
|-----------|----------|
| 扩展 API | Manifest V3 |
| UI | TypeScript + HTML + CSS（无框架） |
| 加密 | Web Crypto API（AES-GCM） |
| 存储 | Chrome Storage API（session + local） |
| 构建 | TypeScript 编译器（`tsc`） |
| 测试 | Jest |

---

## 许可证

MIT
