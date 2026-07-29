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
    // Listen for tab switches
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        await chrome.runtime.sendMessage({
          type: 'TAB_CHANGED',
          tabId: activeInfo.tabId
        });
      } catch (error) {
        // Side panel might not be open, ignore
      }
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
    // Query for active tab, filtering out the side panel and other non-web tabs
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    let tab = tabs.find(t => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));

    // If no web tab is active, get the last active web tab in the window
    if (!tab) {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      tab = allTabs.reverse().find(t => t.url && (t.url.startsWith('http://') || t.url.startsWith('https://')));
    }

    if (!tab || !tab.id) {
      throw new Error('No active web tab found');
    }

    const results = await chrome.scripting.executeScript({
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
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id) {
      throw new Error('No active tab found');
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
    if (tabId) {
      await chrome.sidePanel.open({ tabId });
    }
  }
}

// Initialize background service
new BackgroundService();
