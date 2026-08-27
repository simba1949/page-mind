// Self-contained service worker without imports
// Storage functionality inlined for service worker compatibility

/**
 * Simple storage service for background script
 */
class BackgroundStorageService {
  /**
   * Save data to chrome storage
   */
  static async save(key: string, data: any): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: data });
    } catch (error) {
      console.error('Storage save error:', error);
      throw error;
    }
  }

  /**
   * Load data from chrome storage
   */
  static async load(key: string): Promise<any> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key];
    } catch (error) {
      console.error('Storage load error:', error);
      return null;
    }
  }

  /**
   * Remove data from chrome storage
   */
  static async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error('Storage remove error:', error);
      throw error;
    }
  }
}

/**
 * Background service worker for handling extension events
 */
class BackgroundService {
  constructor() {
    this.initialize();
  }

  /**
   * Initialize the background service
   */
  private initialize(): void {
    // Set up event listeners
    this.setupMessageListeners();
    this.setupSidePanel();
    this.setupContextMenu();
    this.setupTabListener();
  }

  /**
   * Set up tab switch listener - notify side panel to refresh
   */
  private setupTabListener(): void {
    // Notify the side panel that the page it should reference changed.
    // url/title are included when the extension can see them (site access
    // granted); the panel uses them for instant feedback.
    const notifyTabChanged = async (tabId: number): Promise<void> => {
      try {
        let url = '';
        let title = '';
        try {
          const tab = await chrome.tabs.get(tabId);
          url = tab.url || '';
          title = tab.title || '';
        } catch {
          // Tab already gone — still notify so the panel clears its state.
        }
        await chrome.runtime.sendMessage({ type: 'TAB_CHANGED', tabId, url, title });
      } catch (error) {
        // Side panel might not be open, ignore
      }
    };

    // Listen for tab switches within a window
    chrome.tabs.onActivated.addListener((activeInfo) => {
      void notifyTabChanged(activeInfo.tabId);
    });

    // Window focus changes: tabs.onActivated does NOT fire when the user
    // merely focuses another window, so without this the side panel kept
    // referencing the previously focused window's page.
    chrome.windows.onFocusChanged.addListener((windowId) => {
      // WINDOW_ID_NONE means Chrome itself lost focus — keep last state.
      if (windowId === chrome.windows.WINDOW_ID_NONE) return;
      void (async () => {
        try {
          const [tab] = await chrome.tabs.query({ active: true, windowId });
          await notifyTabChanged(tab?.id ?? -1);
        } catch (error) {
          // ignore
        }
      })();
    });

    // Listen for page refresh/navigation (full page load)
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.active) {
        try {
          await chrome.runtime.sendMessage({
            type: 'PAGE_REFRESHED',
            tabId: tabId
          });
        } catch (error) {
          // Side panel might not be open, ignore
        }
      }
    });

    // Listen for SPA navigation (History API changes)
    chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
      if (details.frameId === 0) { // Only main frame
        try {
          await chrome.runtime.sendMessage({
            type: 'PAGE_REFRESHED',
            tabId: details.tabId
          });
        } catch (error) {
          // Side panel might not be open, ignore
        }
      }
    });
  }

  /**
   * Set up message listeners for communication with content scripts and side panel
   */
  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: any) => void
    ) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  /**
   * Handle incoming messages
   */
  private async handleMessage(
    message: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void
  ): Promise<void> {
    try {
      if (sender.id !== chrome.runtime.id || !message || typeof message.type !== 'string') {
        sendResponse({ success: false, error: 'Unauthorized message' });
        return;
      }

      switch (message.type) {
        case 'GET_PAGE_CONTENT':
          const pageContent = await this.getPageContent();
          sendResponse({ success: true, data: pageContent });
          break;

        case 'GET_ACTIVE_TAB': {
          // Cheap probe (no scripting): lets the side panel check whether a
          // captured page context still belongs to the tab it's looking at.
          const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
          sendResponse({
            success: true,
            data: { tabId: tab?.id ?? -1, url: tab?.url || '' }
          });
          break;
        }

        case 'GET_SELECTION':
          const selection = await this.getSelectionContent();
          sendResponse({ success: true, data: selection });
          break;

        case 'OPEN_SIDEPANEL':
          await this.openSidePanel(sender.tab?.id);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background service error:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get page content from the active tab
   */
  private async getPageContent(): Promise<any> {
    // Always read the tab the user is actually looking at. Do not filter by
    // tab.url — the field is hidden without site-access permission, which
    // made this report "no web tab" even on normal pages — and do not fall
    // back to some other http tab in the window: that captured pages the
    // user was not viewing. Pages that cannot be injected (chrome://, Web
    // Store, PDF viewer) simply yield no content below.
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) {
      return null;
    }

    let results;
    try {
      results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Extract main content from the page - WITHOUT modifying the DOM
        const title = document.title;
        const safeUrl = new URL(window.location.href);
        safeUrl.search = '';
        safeUrl.hash = '';

        // Try to get main content area (priority order for better content extraction)
        const mainContent =
          document.querySelector('article') ||
          document.querySelector('main') ||
          document.querySelector('[role="main"]') ||
          document.querySelector('.post-content') ||
          document.querySelector('.article-content') ||
          document.querySelector('.entry-content') ||
          document.querySelector('.content') ||
          document.body;

        // Clone the content to avoid modifying the original page
        const clonedContent = mainContent.cloneNode(true) as HTMLElement;

        // Remove non-content elements from the clone (not the original page)
        const elementsToRemove = clonedContent.querySelectorAll(
          'script, style, link, meta, noscript, iframe, svg, ' +
          'nav, footer, header, aside, ' +
          '[role="navigation"], [role="banner"], [role="complementary"], [role="search"], ' +
          '.advertisement, .ads, .social-share, .comments, .sidebar, ' +
          '.nav, .navigation, .menu, .footer, .header, .widget, ' +
          '.related-posts, .recommended, .popup, .modal, .overlay'
        );
        elementsToRemove.forEach(el => el.remove());

        // Extract text content from the clone
        let content = clonedContent.innerText || clonedContent.textContent || '';

        // Clean up the content (denoise)
        content = content
          .replace(/\s+/g, ' ')           // Collapse whitespace
          .replace(/\n\s*\n/g, '\n')      // Remove empty lines
          .replace(/[^\S\n]+/g, ' ')      // Collapse non-newline whitespace
          .trim();

        // Remove very short lines that are likely noise (less than 3 chars)
        const lines = content.split('\n').filter(line => line.trim().length >= 3);
        content = lines.join('\n');

        return {
          title: title.substring(0, 300),
          url: safeUrl.toString(),
          content: content.substring(0, 8000)
        };
      }
      });
    } catch {
      // Non-injectable page (chrome://, Chrome Web Store, PDF viewer…) —
      // nothing to read, not an error.
      return null;
    }

    if (results && results[0] && results[0].result) {
      const { title, url, content } = results[0].result;
      return {
        type: 'full_page',
        url,
        title,
        content
      };
    }

    return null;
  }

  /**
   * Get selected text content from the active tab
   */
  private async getSelectionContent(): Promise<any> {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

    // No readable tab to inspect — not an error, just nothing selected.
    if (!tab?.id) {
      return null;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim() || '';

        return {
          title: document.title.substring(0, 300),
          url: (() => {
            const safeUrl = new URL(window.location.href);
            safeUrl.search = '';
            safeUrl.hash = '';
            return safeUrl.toString();
          })(),
          content: selectedText.substring(0, 8000)
        };
      }
    });

    if (results && results[0] && results[0].result) {
      const { title, url, content } = results[0].result;

      if (!content) {
        return null;
      }

      return {
        type: 'selection',
        url,
        title,
        content
      };
    }

    return null;
  }

  /**
   * Set up side panel behavior
   */
  private setupSidePanel(): void {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

    // Open side panel when user clicks the extension icon
    chrome.action.onClicked.addListener(async (tab) => {
      if (tab.id) {
        await this.openSidePanel(tab.id);
      }
    });
  }

  /**
   * Set up right-click context menu
   */
  private setupContextMenu(): void {
    chrome.runtime.onInstalled.addListener(() => {
      chrome.contextMenus.create({
        id: 'askAI',
        title: '页问',
        contexts: ['selection']
      });
    });

    // Handle context menu click
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'askAI' && info.selectionText) {
        const contextData = {
          type: 'selection',
          url: (() => {
            try {
              const safeUrl = new URL(info.pageUrl || '');
              safeUrl.search = '';
              safeUrl.hash = '';
              return safeUrl.toString();
            } catch {
              return '';
            }
          })(),
          title: (tab?.title || '').substring(0, 300),
          content: info.selectionText.substring(0, 8000)
        };

        // Open side panel FIRST (must be in user gesture context)
        if (tab?.id) {
          this.openSidePanel(tab.id);
        }

        // Delay required: openSidePanel must be called synchronously within the
        // click handler (user gesture), but the storage write + messaging can
        // happen asynchronously after the panel opens.
        setTimeout(async () => {
          try {
            // Store the selected text temporarily
            await BackgroundStorageService.save('contextSelection', contextData);

            // Send message to side panel to notify new context
            await chrome.runtime.sendMessage({
              type: 'CONTEXT_FROM_MENU',
              data: contextData
            });
          } catch (error) {
            console.error('Failed to save/send context:', error);
          }
        }, 100);
      }
    });
  }

  /**
   * Open side panel for a specific tab
   */
  private async openSidePanel(tabId?: number): Promise<void> {
    // tab.id can be TAB_ID_NONE (-1) for prerendered/special tabs; those
    // pass the truthiness guard, so exclude them explicitly. The open()
    // call itself can still reject (panel already open, gesture lost), and
    // an unhandled rejection there crashes the worker's console.
    if (tabId && tabId !== chrome.tabs.TAB_ID_NONE) {
      try {
        await chrome.sidePanel.open({ tabId });
      } catch (error) {
        console.error('Failed to open side panel:', error);
      }
    }
  }
}

// Initialize background service
new BackgroundService();
