# PageMind 项目协作指南

## 项目概况

页知（PageMind）是基于 Manifest V3 的 Chromium 浏览器扩展，使用 TypeScript 和 CSS，提供侧栏问答、页面上下文与选中文字问答。

## 目录规范

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

| 位置 | 职责与存放规则 |
| --- | --- |
| 根目录 | 项目入口说明、agent.md、扩展 manifest、包管理及 TypeScript/Jest 配置；构建脚本与专题报告归入下述目录。 |
| `src/background/` | 后台服务和浏览器事件处理。 |
| `src/content/` | 页面内容与选区提取。 |
| `src/sidepanel/` | 侧栏界面、输入交互与问答逻辑；HTML、CSS 和对应功能模块就近存放。 |
| `src/i18n/` | 国际化定义。 |
| `src/utils/` | 跨功能复用的工具；仅单个功能使用的方法优先留在该功能目录。 |
| `src/types/` | 共享类型定义；模块私有类型就近声明。 |
| `assets/` | 扩展运行时资源，随构建复制到 dist；图标放在 icons/。 |
| `scripts/` | 构建与维护脚本；文件路径基于脚本位置解析，避免依赖调用目录。 |
| `tests/` | 可执行测试，命名为 *.test.ts；共享模拟与辅助代码放在 helpers/。 |
| `docs/` | 项目文档；[变更记录](docs/CHANGELOG.md) 与 [代码审查](docs/CODE_REVIEW.md) 放在此目录。 |
| `docs/reports/` | 有日期和验证范围的测试、安全及验收报告；报告描述当时结果，不能替代当前测试。 |
| `docs/design/` | 设计源稿和参考素材，不进入扩展构建产物。 |
| `dist/` | 生成的扩展，不直接维护或提交。 |

### 新增与迁移约定

- 优先使用现有目录；只有出现明确职责时再新增子目录，避免为单个文件建立多层结构。
- 新增文件和目录优先使用小写 kebab-case；已有约定名称如 README.md、CHANGELOG.md 保留。
- 测试代码与报告分开；文档除根目录入口说明外统一放入 docs/。
- 运行时静态资源与设计源稿分开，避免将源稿、报告或测试文件打包进扩展。
- 移动文件时同步更新导入、npm 脚本、配置、文档链接和 README 目录树；涉及构建路径时执行构建并检查产物。
- node_modules/、coverage/、dist/ 及工具缓存不属于手工维护的项目内容；保持忽略规则，不提交。
- .git/、.codegraph/、编辑器及本地工具目录由各工具管理，整理项目时不随意迁移或清理。

## 开发原则

- 保持架构简约，方法职责单一；仅在有明确复用或测试价值时提取模块。
- 修改前检查工作区差异，保留已有的无关改动。
- 若根目录存在 `.codegraph/`，理解或定位代码时先使用 `codegraph explore "问题或符号"`；不存在时跳过，不自动建立索引。
- 浏览器 ES 模块的相对导入保留 `.js` 后缀。
- 文档统一放在 `docs/`，移动文档时检查相对链接。

## 验证

- `npm test -- --runInBand`：运行功能与安全测试。
- `npm run test:types`：检查测试代码类型。
- `npm run lint`：检查源码类型。
- `npm run build`：构建扩展到 `dist/`。
- 涉及浏览器焦点、系统剪贴板或扩展权限时，补充真实浏览器验收；明确区分自动化测试结果与尚未实测的场景。

## 安全边界

- 不在源码、日志或测试数据中写入真实 API 密钥。
- 对页面内容、模型回复和剪贴板内容按不可信输入处理；纯文本使用文本 API，HTML 渲染沿用安全转义与链接协议限制。
- 保持最小扩展权限，不因局部修复扩大主机访问范围。
- 交互变更应检查其他输入控件、设置弹窗、选区和已取消事件，避免误读或转移敏感输入。
