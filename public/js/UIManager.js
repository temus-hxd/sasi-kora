export class UIManager {
  constructor() {
    this.isLoading = false;
    this.knowledgeBaseThinkingTimeout = null;
    this.eventsThinkingTimeout = null;
  }

  // =====================================================
  // CLAUDE STATUS MANAGEMENT
  // =====================================================
  updateClaudeStatus(status, type = 'normal') {
    const statusIndicator = document.getElementById('claudeStatusIndicator');
    const statusText = document.getElementById('statusText');
    const statusDot = document.getElementById('statusDot');

    if (statusText) {
      statusText.textContent = status;
    }

    // Always hide status indicator
    if (statusIndicator) {
      statusIndicator.style.display = 'none';
    }

    // Update dot color and animation
    if (statusDot) {
      statusDot.className = 'status-dot';
      if (type === 'thinking') {
        statusDot.classList.add('thinking');
      } else if (type === 'knowledge-base') {
        statusDot.classList.add('knowledge-base');
      }
    }
  }

  // =====================================================
  // KNOWLEDGE BASE THINKING BUBBLE
  // =====================================================
  showKnowledgeBaseThinking(message = 'give me a moment while i check') {
    const kbThinking = document.getElementById('knowledgeBaseThinking');
    const kbText = kbThinking?.querySelector('.kb-thinking-text');

    if (kbText) {
      kbText.textContent = message;
    }

    if (kbThinking) {
      kbThinking.classList.add('visible');
    }

    // Update status indicator to knowledge base mode
    this.updateClaudeStatus('Searching...', 'knowledge-base');
  }

  hideKnowledgeBaseThinking(delay = 8000) {
    // Clear any existing timeout
    if (this.knowledgeBaseThinkingTimeout) {
      clearTimeout(this.knowledgeBaseThinkingTimeout);
    }

    // Set a timeout to hide the thinking bubble after the specified delay
    this.knowledgeBaseThinkingTimeout = setTimeout(() => {
      const kbThinking = document.getElementById('knowledgeBaseThinking');

      if (kbThinking) {
        kbThinking.classList.remove('visible');
      }

      this.knowledgeBaseThinkingTimeout = null;
    }, delay);
  }

  // Method to immediately hide the knowledge base thinking bubble
  hideKnowledgeBaseThinkingImmediate() {
    // Clear any existing timeout
    if (this.knowledgeBaseThinkingTimeout) {
      clearTimeout(this.knowledgeBaseThinkingTimeout);
      this.knowledgeBaseThinkingTimeout = null;
    }

    const kbThinking = document.getElementById('knowledgeBaseThinking');

    if (kbThinking) {
      kbThinking.classList.remove('visible');
    }
  }

  // Method to update the thinking bubble text
  updateKnowledgeBaseThinkingText(text) {
    const kbText = document.querySelector(
      '#knowledgeBaseThinking .kb-thinking-text'
    );
    if (kbText) {
      kbText.textContent = text;
    }
  }

  // =====================================================
  // GENERAL STATUS MANAGEMENT
  // =====================================================
  updateStatus(message) {
    const statusElement = document.getElementById('status');
    statusElement.textContent = message;
  }

  // =====================================================
  // LOADING SCREEN MANAGEMENT
  // =====================================================
  updateLoadingScreen(progress, text) {
    const loadingCounter = document.getElementById('loadingCounter');
    const loadingProgressBar = document.getElementById('loadingProgressBar');
    const loadingText = document.getElementById('loadingText');

    if (loadingCounter) loadingCounter.textContent = `${Math.round(progress)}%`;
    if (loadingProgressBar) loadingProgressBar.style.width = `${progress}%`;
    if (loadingText) loadingText.textContent = text;
  }

  hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }
  }

  // =====================================================
  // LOADING STATE MANAGEMENT
  // =====================================================
  setLoading(loading) {
    this.isLoading = loading;
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');

    sendBtn.disabled = loading;
    messageInput.disabled = loading;

    if (loading) {
      sendBtn.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
    } else {
      sendBtn.innerHTML =
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>';
    }
  }

  // =====================================================
  // GETTERS
  // =====================================================
  getIsLoading() {
    return this.isLoading;
  }

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================
  showError(message) {
    this.updateStatus(`❌ ${message}`);
    this.updateClaudeStatus('Error', 'error');
  }

  showSuccess(message) {
    this.updateStatus(`✅ ${message}`);
    this.updateClaudeStatus('Success', 'success');
  }

  showWarning(message) {
    this.updateStatus(`⚠️ ${message}`);
    this.updateClaudeStatus('Warning', 'warning');
  }

  // =====================================================
  // EVENTS THINKING BUBBLE
  // =====================================================
  showEventsThinking(message = 'let me check the calendar') {
    const eventsThinking = document.getElementById('eventsThinking');
    const eventsText = eventsThinking?.querySelector('.events-thinking-text');

    if (eventsText) {
      eventsText.textContent = message;
    }

    if (eventsThinking) {
      eventsThinking.classList.add('visible');
    }

    // Update status indicator to events mode
    this.updateClaudeStatus('Checking events...', 'knowledge-base');
  }

  hideEventsThinking(delay = 3000) {
    // Clear any existing timeout
    if (this.eventsThinkingTimeout) {
      clearTimeout(this.eventsThinkingTimeout);
    }

    // Set a timeout to hide the thinking bubble after the specified delay
    this.eventsThinkingTimeout = setTimeout(() => {
      const eventsThinking = document.getElementById('eventsThinking');

      if (eventsThinking) {
        eventsThinking.classList.remove('visible');
      }

      this.eventsThinkingTimeout = null;
    }, delay);
  }

  hideEventsThinkingImmediate() {
    // Clear any existing timeout
    if (this.eventsThinkingTimeout) {
      clearTimeout(this.eventsThinkingTimeout);
      this.eventsThinkingTimeout = null;
    }

    const eventsThinking = document.getElementById('eventsThinking');

    if (eventsThinking) {
      eventsThinking.classList.remove('visible');
    }
  }

  updateEventsThinkingText(text) {
    const eventsText = document.querySelector(
      '#eventsThinking .events-thinking-text'
    );
    if (eventsText) {
      eventsText.textContent = text;
    }
  }

  // =====================================================
  // KNOWLEDGE BASE UTILITIES
  // =====================================================
  setKnowledgeBaseMessage(message) {
    const kbText = document.querySelector(
      '#knowledgeBaseThinking .kb-thinking-text'
    );
    if (kbText) {
      kbText.textContent = message;
    }
  }
}
