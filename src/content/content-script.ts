import { ExtensionMessage, ContentResponse } from '../types';

/**
 * Content script for interacting with web pages
 */
class ContentScript {
  constructor() {
    this.initialize();
  }

  /**
   * Initialize content script
   */
  private initialize(): void {
    this.setupMessageListeners();
    this.setupSelectionTracking();
  }

  /**
   * Set up message listeners for communication with background script
   */
  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener((
      message: ExtensionMessage,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: ContentResponse) => void
    ) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ContentResponse) => void
  ): void {
    if (sender.id !== chrome.runtime.id) {
      sendResponse({ success: false, error: 'Unauthorized message' });
      return;
    }

    switch (message.type) {
      case 'GET_PAGE_CONTENT':
        const pageContent = this.extractPageContent();
        sendResponse({ success: true, data: pageContent });
        break;

      case 'GET_SELECTION':
        const selection = this.getSelectionContent();
        sendResponse({ success: true, data: selection });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  }

  /**
   * Set up selection change tracking
   */
  private setupSelectionTracking(): void {
    let selectionTimeout: NodeJS.Timeout;

    document.addEventListener('selectionchange', () => {
      clearTimeout(selectionTimeout);
      selectionTimeout = setTimeout(() => {
        this.updateSelectionContext();
      }, 500);
    });
  }

  /**
   * Update selection context for the side panel
   */
  private updateSelectionContext(): void {
    const selection = this.getSelectionContent();

    // Send selection update to background script
    chrome.runtime.sendMessage({
      type: 'SELECTION_CHANGED',
      payload: selection
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }

  /**
   * Extract main content from the current page
   */
  private extractPageContent(): any {
    const title = document.title;
    const safeUrl = new URL(window.location.href);
    safeUrl.search = '';
    safeUrl.hash = '';

    // Try to get main content area using common selectors
    const contentSelectors = [
      'article',
      'main',
      '.content',
      '.post-content',
      '.article-content',
      '#content',
      '.main-content'
    ];

    let mainContent: Element | null = null;

    for (const selector of contentSelectors) {
      mainContent = document.querySelector(selector);
      if (mainContent) break;
    }

    // Fallback to body if no main content found
    if (!mainContent) {
      mainContent = document.body;
    }

    // Clone the content to avoid modifying the original page
    const contentClone = mainContent.cloneNode(true) as Element;

    // Remove unnecessary elements
    const elementsToRemove = contentClone.querySelectorAll(
      'script, style, nav, footer, header, aside, .navigation, .sidebar, .menu, .advertisement, .ads'
    );
    elementsToRemove.forEach(el => el.remove());

    // Extract text content
    const content = contentClone.textContent || '';

    // Clean up whitespace and limit length
    const cleanContent = content
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 8000);

    return {
      title: title.substring(0, 300),
      url: safeUrl.toString(),
      content: cleanContent,
      type: 'full_page'
    };
  }

  /**
   * Get selected text content
   */
  private getSelectionContent(): any {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';

    if (!selectedText) {
      return null;
    }

    return {
      title: document.title.substring(0, 300),
      url: (() => {
        const safeUrl = new URL(window.location.href);
        safeUrl.search = '';
        safeUrl.hash = '';
        return safeUrl.toString();
      })(),
      content: selectedText.substring(0, 8000),
      type: 'selection'
    };
  }
}

// Initialize content script
new ContentScript();
