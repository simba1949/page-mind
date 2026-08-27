/**
 * Chrome API mock implementing only the namespaces the code under test
 * touches. `installChromeMock` assigns it to the global with a single
 * documented cast — the full `typeof chrome` declares 60+ namespaces.
 */
export interface ChromeMock {
  storage: {
    local: { get: jest.Mock; set: jest.Mock; remove: jest.Mock };
    session: { get: jest.Mock; set: jest.Mock; remove: jest.Mock };
  };
  runtime: {
    sendMessage: jest.Mock;
    onMessage: { addListener: jest.Mock; removeListener: jest.Mock };
  };
  tabs: { query: jest.Mock; get: jest.Mock; sendMessage: jest.Mock };
  scripting: { executeScript: jest.Mock };
  permissions: { contains: jest.Mock; request: jest.Mock };
  sidePanel: { setPanelBehavior: jest.Mock; open: jest.Mock };
  action: { onClicked: { addListener: jest.Mock } };
  contextMenus: { create: jest.Mock; onClicked: { addListener: jest.Mock } };
  windows: { onFocusChanged: { addListener: jest.Mock } };
}

export function createChromeMock(): ChromeMock {
  return {
    storage: {
      local: { get: jest.fn(), set: jest.fn(), remove: jest.fn() },
      session: { get: jest.fn().mockResolvedValue({}), set: jest.fn(), remove: jest.fn() }
    },
    runtime: {
      sendMessage: jest.fn(),
      onMessage: { addListener: jest.fn(), removeListener: jest.fn() }
    },
    tabs: { query: jest.fn(), get: jest.fn(), sendMessage: jest.fn() },
    scripting: { executeScript: jest.fn() },
    permissions: { contains: jest.fn(), request: jest.fn() },
    sidePanel: { setPanelBehavior: jest.fn(), open: jest.fn() },
    action: { onClicked: { addListener: jest.fn() } },
    contextMenus: { create: jest.fn(), onClicked: { addListener: jest.fn() } },
    windows: { onFocusChanged: { addListener: jest.fn() } }
  };
}

export function installChromeMock(): ChromeMock {
  const mock = createChromeMock();
  // Partial mock by design — cast through unknown once, here, with a reason.
  (globalThis as { chrome: unknown }).chrome = mock as unknown as typeof chrome;
  return mock;
}

/** Replace global.fetch with a typed mock and return it. */
export function installFetchMock(): jest.Mock {
  const fetchMock = jest.fn();
  (globalThis as { fetch?: unknown }).fetch = fetchMock;
  return fetchMock;
}
