export class ChatManager {
  constructor() {
    this.conversationId = this.getOrCreateConversationId();
    this.autoSpeak = true;
    this.lastUserMessage = '';
    this.conversationHistory = [];
    this.emotionState = null; // Store emotion state for stateless serverless

    // Dependencies (set via dependency injection)
    this.webSocketManager = null; // Not used, but kept for compatibility
    this.uiManager = null;
    this.ttsManager = null;
    this.emojiManager = null;
    this.animationManager = null;

    // Avatar dependencies
    this.head = null;
    this.isLoaded = null;
  }

  // =====================================================
  // SETUP AND CONFIGURATION
  // =====================================================
  setDependencies({
    webSocketManager,
    uiManager,
    ttsManager,
    emojiManager,
    head,
    isLoaded,
    animationManager,
  }) {
    this.webSocketManager = webSocketManager;
    this.uiManager = uiManager;
    this.ttsManager = ttsManager;
    this.emojiManager = emojiManager;
    this.head = head;
    this.isLoaded = isLoaded;
    this.animationManager = animationManager;
  }

  // =====================================================
  // CHAT MESSAGE HANDLING
  // =====================================================
  async sendMessage() {
    if (this.uiManager?.getIsLoading()) return;

    // Interrupt current speech if speaking
    if (this.ttsManager) {
      this.ttsManager.interruptSpeech();
    }

    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();

    if (!message) return;

    // Store user message for voice control context
    this.lastUserMessage = message;

    // ================================
    // CONFETTI APPRECIATION DETECTION
    // ================================
    // Check if user message contains appreciation and trigger confetti
    if (window.confettiManager && window.CONFETTI_ENABLED) {
      window.confettiManager.detectAppreciation(message);
    }

    // Update TTS manager with the last user message
    if (this.ttsManager) {
      this.ttsManager.setLastUserMessage(message);
    }

    // Add user message to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    // Save user message to BrowserMemory for persistent storage
    if (typeof BrowserMemory !== 'undefined' && BrowserMemory.initialized) {
      try {
        BrowserMemory.storeMessage('user', message);
      } catch (error) {
        console.warn(
          '⚠️ Failed to store user message in browser memory:',
          error
        );
      }
    }

    messageInput.value = '';
    this.uiManager?.setLoading(true);

    this.uiManager?.updateClaudeStatus('Thinking...', 'thinking');

    try {
      // Use Emotion Engine API (REST) instead of WebSocket
      await this.sendToEmotionEngine(message);
    } catch (error) {
      console.error('Error:', error);
      this.uiManager?.updateStatus('❌ Connection error. Please try again.');
      this.uiManager?.updateClaudeStatus('Error', 'error');
      this.uiManager?.setLoading(false);
    }

    messageInput.focus();
  }

  async sendToEmotionEngine(message) {
    // Prepare history for API (remove timestamp field, exclude current message)
    const historyForAPI = this.conversationHistory.slice(0, -1).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Get language preference
    const language = localStorage.getItem('app_language') || 'en';

    // Call emotion engine API
    const response = await fetch('/api/emotional-state/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: message,
        conversation_id: this.conversationId,
        history: historyForAPI,
        emotion_state: this.emotionState || null,
        language: language,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }

    const data = await response.json();

    // Store emotion state
    if (data.emotion_state) {
      this.emotionState = data.emotion_state;
    }

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: data.response,
      timestamp: data.timestamp,
    });

    // Save assistant response to BrowserMemory for persistent storage
    if (typeof BrowserMemory !== 'undefined' && BrowserMemory.initialized) {
      try {
        BrowserMemory.storeMessage('assistant', data.response);
      } catch (error) {
        console.warn(
          '⚠️ Failed to store assistant message in browser memory:',
          error
        );
      }
    }

    // Handle response like WebSocket would
    const avatarEmoji = data.avatar_emoji || '😐';
    this.handleClaudeResponse(data.response, avatarEmoji, false, false, null);

    // Re-enable input after response is handled
    this.uiManager?.setLoading(false);
  }

  handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // =====================================================
  // CLAUDE RESPONSE PROCESSING
  // =====================================================
  handleClaudeResponse(
    response,
    avatarEmoji,
    usedKnowledgeBase,
    usedEvents,
    timing
  ) {
    const responseReceivedTime = Date.now();
    console.log('🎭 ChatManager.handleClaudeResponse called with:', {
      response: response + '...',
      avatarEmoji,
      usedKnowledgeBase,
      usedEvents: usedEvents || false,
      hasAnimationManager: !!this.animationManager,
      timing: timing || 'N/A',
    });

    // 🚀 PRIORITY 1: START TTS IMMEDIATELY FOR FASTEST RESPONSE
    if (this.autoSpeak && this.head && this.isLoaded && this.ttsManager) {
      // Track TTS timing (speakText returns a boolean, so we track it differently)
      // The actual TTS timing is logged inside TTSManager
      const ttsResult = this.ttsManager.speakText(response);
      if (!ttsResult) {
        console.warn('⚠️ TTS failed to start. Response preview:', {
          responseLength: response?.length || 0,
          responsePreview: response?.substring(0, 150) || 'N/A',
          hasTTags: response?.includes('<t>') || false,
        });
      }
    }

    // PRIORITY 2: Visual processing can happen in parallel while TTS is generating

    // Update knowledge base thinking text if it was used
    if (usedKnowledgeBase && this.uiManager) {
      this.uiManager.updateKnowledgeBaseThinkingText('Preparing response...');
    }

    // Trigger context-aware animation based on response content (parallel to TTS)
    // Filter out <t></t> tags to match what the avatar is actually saying
    if (this.animationManager) {
      const filteredResponse = response
        .replace(/<t>[\s\S]*?<\/t>/gi, '')
        .replace(/<t>[\s\S]*$/gi, '')
        .trim();
      this.animationManager.analyzeAndTrigger(filteredResponse);
    } else {
      console.warn('🎭 AnimationManager not available in ChatManager');
    }

    // Trigger avatar action based on emoji (parallel to TTS)
    if (
      avatarEmoji &&
      this.emojiManager &&
      this.emojiManager.hasEmojiAction(avatarEmoji) &&
      this.head &&
      this.isLoaded
    ) {
      this.emojiManager.triggerEmojiAction(avatarEmoji);
    }
  }

  // =====================================================
  // CONVERSATION MANAGEMENT
  // =====================================================
  getOrCreateConversationId() {
    // Try to get existing conversation ID from localStorage
    let conversationId = localStorage.getItem('chatbot_conversation_id');

    if (!conversationId) {
      // Create new conversation ID if none exists
      conversationId = 'claude-' + Date.now();
      localStorage.setItem('chatbot_conversation_id', conversationId);
      console.log('🆔 Created new conversation ID:', conversationId);
    } else {
      console.log('🆔 Using existing conversation ID:', conversationId);
    }

    return conversationId;
  }

  async clearChat() {
    try {
      await this.webSocketManager?.clearChat(this.conversationId);

      // Clear browser memory
      if (typeof BrowserMemory !== 'undefined' && BrowserMemory.initialized) {
        try {
          BrowserMemory.clearSession();
          console.log('🧠 Browser memory cleared');
        } catch (error) {
          console.warn('⚠️ Failed to clear browser memory session:', error);
        }
      }

      this.uiManager?.updateStatus(
        '👋 Chat cleared! Claude is ready for a new conversation.'
      );

      // Create new conversation ID and save it
      this.conversationId = 'claude-' + Date.now();
      localStorage.setItem('chatbot_conversation_id', this.conversationId);
      console.log('🆔 Chat cleared, new conversation ID:', this.conversationId);
    } catch (error) {
      console.error('Failed to clear chat:', error);
    }
  }

  /**
   * Clear conversation history and browser memory (used when switching languages)
   */
  clearConversationHistory() {
    // Clear conversation history
    this.conversationHistory = [];
    console.log('🗑️ Conversation history cleared');

    // Clear browser memory
    if (typeof BrowserMemory !== 'undefined' && BrowserMemory.initialized) {
      try {
        BrowserMemory.clearSession();
        console.log('🧠 Browser memory cleared');
      } catch (error) {
        console.warn('⚠️ Failed to clear browser memory session:', error);
      }
    }

    // Create new conversation ID and save it
    this.conversationId = 'claude-' + Date.now();
    localStorage.setItem('chatbot_conversation_id', this.conversationId);
    console.log('🆔 New conversation ID created:', this.conversationId);

    // Reset emotion state
    this.emotionState = null;
  }

  async reloadPrompt() {
    try {
      const response = await fetch('/api/reload-prompt', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        this.uiManager?.updateClaudeStatus('Prompt Reloaded', 'success');
        this.uiManager?.updateStatus('🔄 System prompt reloaded successfully!');
      } else {
        this.uiManager?.updateClaudeStatus('Reload Failed', 'error');
      }
    } catch (error) {
      console.error('Failed to reload prompt:', error);
      this.uiManager?.updateClaudeStatus('Reload Error', 'error');
    }
  }

  // =====================================================
  // AUTO-SPEAK MANAGEMENT
  // =====================================================
  toggleAutoSpeak() {
    this.autoSpeak = !this.autoSpeak;
    this.uiManager?.updateClaudeStatus(
      this.autoSpeak ? 'Auto-Speak ON' : 'Auto-Speak OFF',
      'success'
    );

    setTimeout(() => {
      this.uiManager?.updateClaudeStatus('Ready', 'success');
    }, 2000);
  }

  setAutoSpeak(enabled) {
    this.autoSpeak = enabled;
  }

  getAutoSpeak() {
    return this.autoSpeak;
  }

  // =====================================================
  // GETTERS AND SETTERS
  // =====================================================
  getConversationId() {
    return this.conversationId;
  }

  setConversationId(id) {
    this.conversationId = id;
  }

  getLastUserMessage() {
    return this.lastUserMessage;
  }

  setLastUserMessage(message) {
    this.lastUserMessage = message;
  }

  // =====================================================
  // INITIALIZATION AND SETUP
  // =====================================================
  init() {
    // Focus on input when initialized
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.focus();
    }
  }

  // =====================================================
  // INPUT HANDLING
  // =====================================================
  setupKeyboardHandlers() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.addEventListener('keypress', (event) => {
        this.handleKeyPress(event);
      });
    }
  }

  focusInput() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.focus();
    }
  }

  // =====================================================
  // UTILITY METHODS
  // =====================================================
  getConnectionStatus() {
    return this.webSocketManager?.getConnectionStatus() || 'unknown';
  }

  isConnected() {
    return this.webSocketManager?.isAvailable() || false;
  }

  // =====================================================
  // CLEANUP
  // =====================================================
  cleanup() {
    // Clean up event listeners if needed
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      // Remove event listeners
      messageInput.removeEventListener('keypress', this.handleKeyPress);
    }

    // Reset dependencies
    this.webSocketManager = null;
    this.uiManager = null;
    this.ttsManager = null;
    this.emojiManager = null;
    this.head = null;
    this.isLoaded = null;
    this.animationManager = null;
  }
}
