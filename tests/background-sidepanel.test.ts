import { createChromeMock } from './helpers/chrome';

function backgroundMock() {
  const mock = createChromeMock();
  mock.sidePanel.setPanelBehavior.mockResolvedValue(undefined);
  mock.sidePanel.open.mockResolvedValue(undefined);
  mock.storage.local.set.mockResolvedValue(undefined);
  mock.storage.session.set.mockResolvedValue(undefined);
  mock.runtime.sendMessage.mockResolvedValue(undefined);
  return {
    ...mock,
    contextMenus: { ...mock.contextMenus, removeAll: jest.fn() },
    runtime: { ...mock.runtime, id: 'test-extension', onInstalled: { addListener: jest.fn() } },
    tabs: {
      ...mock.tabs,
      TAB_ID_NONE: -1,
      onActivated: { addListener: jest.fn() },
      onUpdated: { addListener: jest.fn() }
    },
    webNavigation: { onHistoryStateUpdated: { addListener: jest.fn() } }
  };
}

let mock: ReturnType<typeof backgroundMock>;
const originalChrome = Object.getOwnPropertyDescriptor(globalThis, 'chrome');

function startBackground() {
  Object.defineProperty(globalThis, 'chrome', { configurable: true, writable: true, value: mock });
  jest.isolateModules(() => require('../src/background/service-worker'));
}

beforeEach(() => { mock = backgroundMock(); });
afterEach(() => {
  jest.restoreAllMocks();
  if (originalChrome) Object.defineProperty(globalThis, 'chrome', originalChrome);
  else Reflect.deleteProperty(globalThis, 'chrome');
});

test('uses native toolbar activation without a competing programmatic click handler', () => {
  startBackground();
  expect(mock.sidePanel.setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  expect(mock.action.onClicked.addListener).not.toHaveBeenCalled();
  expect(mock.sidePanel.open).not.toHaveBeenCalled();
  expect(mock.tabs.query).not.toHaveBeenCalled();
});

test('reports a configuration failure without an unhandled rejection', async () => {
  const failure = new Error('Unavailable');
  mock.sidePanel.setPanelBehavior.mockRejectedValue(failure);
  const report = jest.spyOn(console, 'error').mockImplementation(() => {});
  startBackground();
  await Promise.resolve();
  expect(report).toHaveBeenCalledWith('Failed to configure side panel:', failure);
});

test('context-menu opening still happens synchronously within the user gesture', async () => {
  startBackground();
  const onClick = mock.contextMenus.onClicked.addListener.mock.calls[0][0];
  onClick({ menuItemId: 'askAI', selectionText: 'selected', pageUrl: 'https://example.com/' }, { id: 7 });
  expect(mock.sidePanel.open).toHaveBeenCalledWith({ tabId: 7 });
  expect(mock.sidePanel.open.mock.invocationCallOrder[0])
    .toBeLessThan(mock.storage.session.set.mock.invocationCallOrder[0]);
  await Promise.resolve();
});

test('unauthorized messages cannot open the side panel', () => {
  startBackground();
  const onMessage = mock.runtime.onMessage.addListener.mock.calls[0][0];
  const reply = jest.fn();
  onMessage({ type: 'OPEN_SIDEPANEL' }, { id: 'other-extension', tab: { id: 7 } }, reply);
  expect(mock.sidePanel.open).not.toHaveBeenCalled();
  expect(reply).toHaveBeenCalledWith({ success: false, error: 'Unauthorized message' });
});

// Menu state persists across extension updates; lastError exists only while
// an API callback runs. Model both so duplicate IDs cannot silently pass.
function menuState(existing = false, failures: { remove?: string; create?: string } = {}) {
  const menus = new Map<string, unknown>(existing ? [['askAI', { title: '旧标题' }]] : []);
  const unchecked: string[] = [];
  const complete = (callback: (() => void) | undefined, message?: string) => {
    let read = false;
    Object.defineProperty(mock.runtime, 'lastError', {
      configurable: true,
      get: () => { read = true; return message ? { message } : undefined; }
    });
    try { callback?.(); } finally {
      Reflect.deleteProperty(mock.runtime, 'lastError');
      if (message && !read) unchecked.push(message);
    }
  };
  mock.contextMenus.removeAll.mockImplementation((callback?: () => void) => {
    queueMicrotask(() => {
      if (!failures.remove) menus.clear();
      complete(callback, failures.remove);
    });
  });
  mock.contextMenus.create.mockImplementation((properties, callback?: () => void) => {
    queueMicrotask(() => {
      const error = failures.create || (menus.has(properties.id) ? `Cannot create item with duplicate id ${properties.id}` : undefined);
      if (!error) menus.set(properties.id, properties);
      complete(callback, error);
    });
    return properties.id;
  });
  return { menus, unchecked };
}

const flushMenus = () => new Promise<void>(resolve => setImmediate(resolve));

test('a first installation creates the selection menu', async () => {
  const state = menuState();
  startBackground();
  mock.runtime.onInstalled.addListener.mock.calls[0][0]();
  await flushMenus();
  expect([...state.menus.keys()]).toEqual(['askAI']);
  expect(state.menus.get('askAI')).toEqual({ id: 'askAI', title: '页问', contexts: ['selection'] });
  expect(state.unchecked).toEqual([]);
});

test('an update replaces the persisted menu without a duplicate ID', async () => {
  const state = menuState(true);
  startBackground();
  mock.runtime.onInstalled.addListener.mock.calls[0][0]();
  await flushMenus();
  expect(state.unchecked).toEqual([]);
  expect([...state.menus.keys()]).toEqual(['askAI']);
  expect(state.menus.get('askAI')).toEqual({ id: 'askAI', title: '页问', contexts: ['selection'] });
});

test('overlapping install events and subsequent reloads remain idempotent', async () => {
  const state = menuState(true);
  startBackground();
  const onInstalled = mock.runtime.onInstalled.addListener.mock.calls[0][0];
  onInstalled();
  onInstalled();
  await flushMenus();
  onInstalled();
  await flushMenus();
  expect(state.unchecked).toEqual([]);
  expect([...state.menus.keys()]).toEqual(['askAI']);
  expect(mock.contextMenus.create).toHaveBeenCalledTimes(2);
});

test('a normal worker startup does not recreate persisted menus', () => {
  menuState(true);
  startBackground();
  expect(mock.contextMenus.removeAll).not.toHaveBeenCalled();
  expect(mock.contextMenus.create).not.toHaveBeenCalled();
});

test.each(['remove', 'create'] as const)('%s failure is handled and does not prevent a later retry', async operation => {
  const failures: { remove?: string; create?: string } = { [operation]: '测试菜单失败' };
  const state = menuState(true, failures);
  const report = jest.spyOn(console, 'error').mockImplementation(() => {});
  startBackground();
  const onInstalled = mock.runtime.onInstalled.addListener.mock.calls[0][0];
  onInstalled();
  await flushMenus();
  expect(state.unchecked).toEqual([]);
  expect(report).toHaveBeenCalledWith(
    operation === 'remove' ? 'Failed to reset context menus:' : 'Failed to create context menu:',
    '测试菜单失败'
  );
  if (operation === 'remove') expect(mock.contextMenus.create).not.toHaveBeenCalled();
  delete failures[operation];
  onInstalled();
  await flushMenus();
  expect(state.unchecked).toEqual([]);
  expect([...state.menus.keys()]).toEqual(['askAI']);
});
