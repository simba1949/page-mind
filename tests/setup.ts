// Test setup file
import { jest } from '@jest/globals';

// Mock Chrome extension API
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn()
  },
  scripting: {
    executeScript: jest.fn()
  },
  sidePanel: {
    setPanelBehavior: jest.fn(),
    open: jest.fn(),
    setOptions: jest.fn()
  },
  action: {
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  contextMenus: {
    create: jest.fn(),
    removeAll: jest.fn(),
    onClicked: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  }
};

// Set up global Chrome mock
(global as any).chrome = mockChrome;

// Mock crypto API for Node.js environment
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      generateKey: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn(),
      importKey: jest.fn(),
      exportKey: jest.fn()
    },
    getRandomValues: jest.fn()
  }
});

// Mock TextEncoder/TextDecoder for Node.js
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock btoa/atob for Node.js
global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
