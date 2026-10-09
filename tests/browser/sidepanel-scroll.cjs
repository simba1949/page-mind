// Real layout/input checks; the fixture runs repository HTML/CSS and controller
// code in an isolated document, with no extension credentials or API requests.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const ts = require('typescript');
const { chromium } = require('playwright');

const root = join(__dirname, '../..');
const read = path => readFileSync(join(root, path), 'utf8');
const html = read('src/sidepanel/index.html')
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<link[^>]+>|<img[^>]+>/g, '');
const css = read('src/sidepanel/styles.css');
const modules = {};
for (const [id, path] of Object.entries({
  '../utils/crypto.js': 'src/utils/crypto.ts',
  '../utils/constants.js': 'src/utils/constants.ts',
  './composer.js': 'src/sidepanel/composer.ts',
  panel: 'src/sidepanel/sidepanel.ts'
})) {
  // Expose the private controller only in the test bundle, without booting it.
  const source = read(path) + (id === 'panel' ? '\nexport { SidePanelController };' : '');
  modules[id] = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }
  }).outputText;
}

let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

async function fixture(viewport = { width: 400, height: 700 }, actions = 3) {
  const page = await browser.newPage({ viewport });
  await page.route('**/*', route => route.abort());
  await page.setContent(html);
  await page.addStyleTag({ content: css });
  await page.evaluate(({ modules, actions }) => {
    const cache = {};
    const load = id => {
      if (!cache[id]) {
        const module = { exports: {} };
        cache[id] = module;
        new Function('require', 'module', 'exports', modules[id])(load, module, module.exports);
      }
      return cache[id].exports;
    };
    window.panelExports = load('panel');
    window.panel = Object.create(window.panelExports.SidePanelController.prototype);
    panel.initializeDOMElements();
    panel.messages = [];
    panel.isSending = false;
    panel.streamRenderRaf = null;
    panel.followStream = true;
    panel.lastChatScrollTop = 0;
    panel.saveChatHistory = async () => {};
    panel.chatMessages.replaceChildren();
    panel.setupMessageEvents();
    panel.quickActionsContainer.innerHTML = '<button class="quick-action">测试操作</button>'.repeat(actions);
    panel.previewBar.classList.remove('hidden');
    panel.previewText.textContent = '测试页面';
    window.nextFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { modules, actions });
  return page;
}

async function wheel(page, deltaY) {
  const rect = await page.locator('#chat-messages').boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.wheel(0, deltaY);
  await page.evaluate(() => nextFrame());
}

test('long answers leave room for chat and composer at short heights', async () => {
  const page = await fixture({ width: 360, height: 500 }, 10);
  try {
    const metrics = await page.evaluate(async () => {
      const message = { id: 'long', role: 'assistant', content: '长回复测试。\n'.repeat(20000), timestamp: 0 };
      panel.renderMessage(message);
      await nextFrame();
      await Promise.all(document.getAnimations().map(animation => animation.finished));
      const chat = panel.chatMessages;
      const main = document.querySelector('.chat-container');
      const input = document.querySelector('.input-container');
      return { chatHeight: chat.clientHeight, mainHeight: main.clientHeight,
        inputBottom: input.getBoundingClientRect().bottom, viewport: innerHeight };
    });
    assert.ok(metrics.chatHeight >= metrics.mainHeight * 0.45, JSON.stringify(metrics));
    assert.ok(metrics.inputBottom <= metrics.viewport + 1, JSON.stringify(metrics));
    assert.ok(await page.locator('#message-input').isVisible());
    const send = await page.locator('#send-btn').boundingBox();
    assert.ok(send.y + send.height <= metrics.viewport, 'send button must stay inside the viewport');
    const shortcuts = await page.locator('#quick-actions').boundingBox();
    await page.mouse.move(shortcuts.x + shortcuts.width / 2, shortcuts.y + shortcuts.height / 2);
    await page.mouse.wheel(0, 600);
    await page.evaluate(() => nextFrame());
    assert.ok(await page.evaluate(() => panel.quickActionsContainer.scrollTop > 0));
    if (process.env.SCROLL_TEST_SCREENSHOT) {
      await page.screenshot({ path: process.env.SCROLL_TEST_SCREENSHOT });
    }
    await wheel(page, 600);
    assert.ok(await page.evaluate(() => panel.chatMessages.scrollTop > 0));
  } finally { await page.close(); }
});

test('completed long Markdown, code and tables scroll down and back up', async () => {
  const page = await fixture();
  try {
    for (const content of [
      '## 长回复\n\n- 分段内容\n- 验证滚动\n\n'.repeat(3000),
      '```js\n' + ('const value = "' + 'x'.repeat(300) + '";\n').repeat(550) + '```',
      '| 列一 | 列二 |\n|---|---|\n' + '| 内容 | 内容 |\n'.repeat(5000)
    ]) {
      await page.evaluate(async content => {
        panel.chatMessages.replaceChildren();
        panel.renderMessage({ id: 'long', role: 'assistant', content, timestamp: 0 });
        await nextFrame();
      }, content);
      await wheel(page, 600);
      const down = await page.evaluate(() => panel.chatMessages.scrollTop);
      assert.ok(down > 0, 'wheel must scroll long Markdown');
      await wheel(page, -300);
      assert.ok(await page.evaluate(previous => panel.chatMessages.scrollTop < previous, down));
      await page.evaluate(() => panel.scrollChatBottomInstant());
      assert.ok(await page.evaluate(() => {
        const el = panel.chatMessages;
        return el.scrollHeight - el.scrollTop - el.clientHeight <= 2;
      }), 'the actual bottom must be reachable');
    }
    await page.locator('#chat-messages').focus();
    await page.keyboard.press('Home');
    await page.waitForFunction(() => panel.chatMessages.scrollTop === 0);
    await page.keyboard.press('PageDown');
    await page.waitForFunction(() => panel.chatMessages.scrollTop > 0);
  } finally { await page.close(); }
});

test('a small manual scroll near the bottom suspends stream following', async () => {
  const page = await fixture();
  try {
    await page.evaluate(async () => {
      panel.isSending = true;
      window.message = { id: 'stream', role: 'assistant', content: '长回复。\n'.repeat(1000), timestamp: 0 };
      window.parts = panel.buildMessageElement(message);
      panel.chatMessages.append(parts.messageEl);
      panel.scrollChatBottomInstant();
      await nextFrame();
    });
    await wheel(page, -40);
    const before = await page.evaluate(() => panel.chatMessages.scrollTop);
    await page.evaluate(async () => {
      message.content += '新增的一段内容。\n';
      panel.scheduleStreamRender(parts.contentEl, parts.reasoningBody, message);
      await nextFrame();
    });
    const after = await page.evaluate(() => panel.chatMessages.scrollTop);
    assert.ok(Math.abs(after - before) <= 2, `manual scroll was overridden: ${before} -> ${after}`);
    // A scrollbar drag also changes scrollTop without a wheel event.
    await page.evaluate(async () => {
      panel.scrollChatBottomInstant();
      await nextFrame();
      panel.chatMessages.scrollTop -= 200;
      await nextFrame();
    });
    const dragged = await page.evaluate(() => panel.chatMessages.scrollTop);
    await page.evaluate(async () => {
      message.content += '拖动滚动条之后继续输出。\n';
      panel.scheduleStreamRender(parts.contentEl, parts.reasoningBody, message);
      await nextFrame();
    });
    assert.ok(Math.abs(await page.evaluate(() => panel.chatMessages.scrollTop) - dragged) <= 2);
    await page.locator('#chat-messages').focus();
    await page.keyboard.press('Home');
    await page.waitForFunction(() => panel.chatMessages.scrollTop === 0);
    await page.evaluate(async () => {
      message.content += '键盘翻页之后继续输出。\n';
      panel.scheduleStreamRender(parts.contentEl, parts.reasoningBody, message);
      await nextFrame();
    });
    assert.equal(await page.evaluate(() => panel.chatMessages.scrollTop), 0);
    // Following resumes when the reader explicitly returns to the bottom.
    await page.evaluate(async () => { panel.scrollChatBottomInstant(); await nextFrame(); });
    await page.evaluate(async () => {
      message.content += '继续输出。\n';
      panel.scheduleStreamRender(parts.contentEl, parts.reasoningBody, message);
      await nextFrame();
    });
    assert.ok(await page.evaluate(() => {
      const el = panel.chatMessages;
      return el.scrollHeight - el.scrollTop - el.clientHeight <= 2;
    }));
  } finally { await page.close(); }
});

test('saving a completed answer never overrides scrolling done during storage', async () => {
  const page = await fixture();
  try {
    await page.evaluate(() => {
      panel.saveChatHistory = () => new Promise(resolve => { window.finishSave = resolve; });
      panel.apiService = { chat: async (_messages, handlers) => {
        const content = '长回复。\n'.repeat(1000);
        handlers.onContent(content);
        await nextFrame();
        return { content };
      } };
      window.requestDone = panel.sendToAI({ id: 'user', role: 'user', content: '测试', timestamp: 0 });
    });
    await page.waitForFunction(() => typeof window.finishSave === 'function');
    await page.evaluate(() => panel.scrollChatBottomInstant());
    await wheel(page, -300);
    const before = await page.evaluate(() => panel.chatMessages.scrollTop);
    await page.evaluate(async () => { finishSave(); await requestDone; await nextFrame(); });
    await page.evaluate(() => new Promise(resolve => {
      let stable = 0;
      let last = panel.chatMessages.scrollTop;
      const check = () => {
        const top = panel.chatMessages.scrollTop;
        stable = top === last ? stable + 1 : 0;
        last = top;
        if (stable >= 10) resolve(); else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }));
    assert.ok(Math.abs(await page.evaluate(() => panel.chatMessages.scrollTop) - before) <= 2,
      'storage completion must not jump back to the bottom');
    assert.equal(await page.locator('#chat-messages').getAttribute('aria-busy'), 'false');
  } finally { await page.close(); }
});

for (const failed of [false, true]) test(`${failed ? 'failed' : 'completed'} Markdown preserves the relative reading position`, async () => {
  const page = await fixture();
  try {
    await page.evaluate(failed => {
      panel.apiService = { chat: async (_messages, handlers) => {
        handlers.onContent('## 已生成部分\n\n段落内容。\n'.repeat(1000));
        await nextFrame();
        await new Promise(resolve => { window.finishRequest = resolve; });
        if (window.failResponse) throw new Error('测试连接中断');
        return { content: '## 已生成部分\n\n段落内容。\n'.repeat(1000) };
      } };
      window.failResponse = failed;
      window.requestDone = panel.sendToAI({ id: 'user', role: 'user', content: '测试', timestamp: 0 });
    }, failed);
    await page.waitForFunction(() => typeof window.finishRequest === 'function');
    await wheel(page, -600);
    const progress = () => {
      const content = document.querySelector('.message.assistant .message-content').getBoundingClientRect();
      return (panel.chatMessages.getBoundingClientRect().top - content.top) / content.height;
    };
    const before = await page.evaluate(progress);
    await page.evaluate(async () => { finishRequest(); await requestDone; await nextFrame(); });
    assert.ok(await page.locator('.message.assistant .md-h').count() > 0);
    if (failed) assert.equal(await page.locator('.message.error').textContent(), '测试连接中断');
    assert.equal(await page.locator('#chat-messages').getAttribute('aria-busy'), 'false');
    const after = await page.evaluate(progress);
    assert.ok(Math.abs(after - before) < 0.0001, JSON.stringify({ before, after }));
    assert.equal(await page.evaluate(() => panel.followStream), false);
  } finally { await page.close(); }
});

test('final Markdown leaves a reader in older messages at the same position', async () => {
  const page = await fixture();
  try {
    await page.evaluate(async () => {
      panel.renderMessage({ id: 'old', role: 'assistant', content: '历史内容。\n'.repeat(2000), timestamp: 0 });
      window.message = { id: 'stream', role: 'assistant', content: '## 新回复\n\n内容。\n'.repeat(1000), timestamp: 0 };
      window.parts = panel.buildMessageElement(message);
      panel.chatMessages.append(parts.messageEl);
      panel.chatMessages.scrollTop = 200;
      panel.followStream = false;
      await nextFrame();
    });
    const before = await page.evaluate(() => panel.chatMessages.scrollTop);
    await page.evaluate(async () => { panel.renderFinalStreamContent(parts.contentEl, message.content); await nextFrame(); });
    assert.equal(await page.evaluate(() => panel.chatMessages.scrollTop), before);
  } finally { await page.close(); }
});

test('200k-character streaming preserves text nodes and manual scrolling', async t => {
  const page = await fixture();
  try {
    const stream = page.evaluate(async () => {
      panel.isSending = true;
      const message = { id: 'stress', role: 'assistant', content: '', timestamp: 0 };
      const parts = panel.buildMessageElement(message);
      panel.chatMessages.append(parts.messageEl);
      const chunk = '增量回复\n'.repeat(200);
      let firstText;
      let retained = true;
      const timings = [];
      for (let i = 0; i < 200; i++) {
        message.content += chunk;
        const start = performance.now();
        panel.scheduleStreamRender(parts.contentEl, parts.reasoningBody, message);
        await new Promise(resolve => requestAnimationFrame(resolve));
        window.stressProgress = i;
        timings.push(performance.now() - start);
        if (i === 0) firstText = parts.contentEl.firstChild;
        retained &&= firstText === parts.contentEl.firstChild;
      }
      timings.sort((a, b) => a - b);
      return { length: message.content.length, retained, p95FrameMs: timings[Math.floor(timings.length * 0.95)],
        complete: parts.contentEl.textContent === message.content };
    });
    await page.waitForFunction(() => window.stressProgress >= 100);
    await wheel(page, -600);
    const readingPosition = await page.evaluate(() => panel.chatMessages.scrollTop);
    const result = await stream;
    t.diagnostic(JSON.stringify(result));
    assert.equal(result.length, 200000);
    assert.equal(result.complete, true);
    assert.equal(result.retained, true, 'streaming must not replace the text node every frame');
    assert.ok(Math.abs(await page.evaluate(() => panel.chatMessages.scrollTop) - readingPosition) <= 2,
      'ongoing long output must preserve the manual reading position');
    assert.ok(await page.evaluate(() => {
      const el = panel.chatMessages;
      return el.scrollHeight - el.scrollTop - el.clientHeight > 80;
    }));
  } finally { await page.close(); }
});
