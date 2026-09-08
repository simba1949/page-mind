import { createChromeMock } from './helpers/chrome';

function backgroundMock() {
  const mock = createChromeMock();
  mock.sidePanel.setPanelBehavior.mockResolvedValue(undefined);
  mock.sidePanel.open.mockResolvedValue(undefined);
  mock.storage.local.set.mockResolvedValue(undefined);
  mock.runtime.sendMessage.mockResolvedValue(undefined);
  return {
    ...mock,
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
    .toBeLessThan(mock.storage.local.set.mock.invocationCallOrder[0]);
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
