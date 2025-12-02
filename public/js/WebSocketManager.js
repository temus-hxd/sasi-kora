export class WebSocketManager {
  constructor() {
    this.ws = null;
    this.useWebSocket = true;
    this.reconnectTimeout = null;
    // Use current page's host and port for WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}`;
    this.isConnected = false;
    this.environment = this.detectEnvironment();

    if (this.environment.httpOnly) {
      this.useWebSocket = false;
      console.log('🌐 HTTP-only mode enabled:', this.environment.reason);
    }

    // Callback functions
    this.onStatusUpdate = null;
    this.onMessage = null;
    this.onClaudeResponse = null;
    this.onLoading = null;
    this.onKnowledgeBaseThinking = null;
    this.onEventsThinking = null;
  }

  // =====================================================
  // SETUP AND CONFIGURATION
  // =====================================================
  setURL(url) {
    this.url = url;
  }

  setCallbacks({
    onStatusUpdate,
    onMessage,
    onClaudeResponse,
    onLoading,
    onKnowledgeBaseThinking,
    onEventsThinking,
  }) {
    this.onStatusUpdate = onStatusUpdate;
    this.onMessage = onMessage;
    this.onClaudeResponse = onClaudeResponse;
    this.onLoading = onLoading;
    this.onKnowledgeBaseThinking = onKnowledgeBaseThinking;
    this.onEventsThinking = onEventsThinking;

    // Debug logging for Vercel
    console.log('🔌 WebSocket callbacks set:', {
      onStatusUpdate: !!onStatusUpdate,
      onMessage: !!onMessage,
      onClaudeResponse: !!onClaudeResponse,
      onLoading: !!onLoading,
      onKnowledgeBaseThinking: !!onKnowledgeBaseThinking,
      onEventsThinking: !!onEventsThinking,
    });
  }

  // =====================================================
  // WEBSOCKET INITIALIZATION
  // =====================================================
  initWebSocket() {
    if (!this.useWebSocket) {
      console.log('🌐 initWebSocket skipped (HTTP-only mode)');
      return;
    }
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.isConnected = true;
        if (this.onStatusUpdate) {
          this.onStatusUpdate('Connected', 'success');
        }
      };

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.isConnected = false;
        if (this.onStatusUpdate) {
          this.onStatusUpdate('Disconnected', 'error');
        }
        this.useWebSocket = false;

        // Try to reconnect after 3 seconds
        this.reconnectTimeout = setTimeout(() => {
          if (!this.useWebSocket) {
            this.initWebSocket();
          }
        }, 3000);
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnected = false;
        this.useWebSocket = false;
        if (this.onStatusUpdate) {
          this.onStatusUpdate('Error', 'error');
        }
      };
    } catch (error) {
      console.error('❌ WebSocket init error:', error);
      this.isConnected = false;
      this.useWebSocket = false;
      if (this.onStatusUpdate) {
        this.onStatusUpdate('HTTP Only', 'warning');
      }
    }
  }

  // =====================================================
  // MESSAGE HANDLING
  // =====================================================
  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'connected':
        this.isConnected = true;
        if (this.onStatusUpdate) {
          this.onStatusUpdate('Ready', 'success');
        }
        break;

      case 'typing':
        if (data.status && this.onStatusUpdate) {
          this.onStatusUpdate('Thinking...', 'thinking');
        }
        break;

      case 'knowledge_base_thinking':
        if (data.status) {
          // Show knowledge base thinking bubble
          if (this.onKnowledgeBaseThinking) {
            this.onKnowledgeBaseThinking(true, data.message);
          }

          // Trigger Checking 💡 animation simultaneously
          if (window.triggerExpression) {
            console.log(
              '💡 Triggering Checking animation for knowledge base search'
            );
            window.triggerExpression('💡');
          }
        } else {
          // Hide knowledge base thinking bubble
          if (this.onKnowledgeBaseThinking) {
            this.onKnowledgeBaseThinking(false);
          }
        }
        break;

      case 'events_thinking':
        if (data.status) {
          // Show events thinking bubble
          if (this.onEventsThinking) {
            this.onEventsThinking(true, data.message);
          }

          // Trigger Checking 💡 animation simultaneously
          if (window.triggerExpression) {
            console.log('💡 Triggering Checking animation for events search');
            window.triggerExpression('💡');
          }
        } else {
          // Hide events thinking bubble
          if (this.onEventsThinking) {
            this.onEventsThinking(false);
          }
        }
        break;

      case 'response':
        // Only hide knowledge base thinking with delay if it was actually used
        if (this.onKnowledgeBaseThinking && data.usedKnowledgeBase) {
          this.onKnowledgeBaseThinking(false, 'delayed');
        } else if (this.onKnowledgeBaseThinking) {
          // If no knowledge base was used, hide immediately
          this.onKnowledgeBaseThinking(false, 'immediate');
        }

        // Only hide events thinking with delay if it was actually used
        if (this.onEventsThinking && data.usedEvents) {
          this.onEventsThinking(false, 'delayed');
        } else if (this.onEventsThinking) {
          // If no events was used, hide immediately
          this.onEventsThinking(false, 'immediate');
        }

        if (this.onClaudeResponse) {
          this.onClaudeResponse(
            data.response,
            data.avatarEmoji,
            data.usedKnowledgeBase,
            data.usedEvents,
            data.timing
          );
        }

        // Store messages in browser memory
        if (typeof BrowserMemory !== 'undefined' && BrowserMemory.initialized) {
          try {
            BrowserMemory.storeMessage('user', data.originalMessage);
            BrowserMemory.storeMessage('assistant', data.response);
          } catch (error) {
            console.warn(
              '⚠️ Failed to store messages in browser memory:',
              error
            );
          }
        }
        if (this.onStatusUpdate) {
          this.onStatusUpdate('Ready', 'success');
        }
        if (this.onLoading) {
          this.onLoading(false);
        }
        break;

      case 'error':
        // Hide knowledge base thinking if shown
        if (this.onKnowledgeBaseThinking) {
          this.onKnowledgeBaseThinking(false);
        }

        // Hide events thinking if shown
        if (this.onEventsThinking) {
          this.onEventsThinking(false);
        }

        console.error('❌ Error: ' + data.error);
        if (this.onMessage) {
          this.onMessage('❌ Error: ' + data.error);
        }
        if (this.onStatusUpdate) {
          this.onStatusUpdate('Error', 'error');
        }
        if (this.onLoading) {
          this.onLoading(false);
        }
        break;
    }
  }

  // =====================================================
  // WEBSOCKET COMMUNICATION
  // =====================================================
  sendMessage(messageData) {
    if (this.isAvailable()) {
      try {
        this.ws.send(JSON.stringify(messageData));
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    }
    return false;
  }

  sendChatMessage(message, conversationId) {
    // Get memory context if available
    let memoryContext = '';
    if (typeof BrowserMemory !== 'undefined' && BrowserMemory.initialized) {
      try {
        memoryContext = BrowserMemory.getUserContext();
      } catch (error) {
        console.warn('⚠️ Failed to get memory context:', error);
      }
    }

    return this.sendMessage({
      type: 'chat',
      message: message,
      conversationId: conversationId,
      memoryContext: memoryContext,
    });
  }

  sendClearChat(conversationId) {
    return this.sendMessage({
      type: 'clear',
      conversationId: conversationId,
    });
  }

  // =====================================================
  // HTTP FALLBACK METHODS
  // =====================================================
  async sendChatHTTP(message, conversationId) {
    try {
      // Check if this might trigger knowledge base search (same logic as server)
      const libraryKeywords = [
        'library',
        'membership',
        'card',
        'hours',
        'services',
        'database',
        'fine',
        'borrow',
        'reserve',
        'renew',
        'print',
      ];
      const containsLibraryKeywords = libraryKeywords.some((keyword) =>
        message.toLowerCase().includes(keyword)
      );

      // Check if this might trigger events search
      const eventsKeywords = [
        'event',
        'events',
        'program',
        'programs',
        'programme',
        'programmes',
        'workshop',
        'workshops',
        'activity',
        'activities',
        'storytelling',
        'storytime',
        'reading program',
        'what happening',
        "what's happening",
        'upcoming',
        'schedule',
        'session',
        'sessions',
        'class',
        'classes',
        'calendar',
      ];
      const containsEventsKeywords = eventsKeywords.some((keyword) =>
        message.toLowerCase().includes(keyword)
      );

      // Show knowledge base thinking bubble if library keywords detected
      if (containsLibraryKeywords && this.onKnowledgeBaseThinking) {
        console.log(
          '🧠 HTTP: Detected library keywords, showing thinking bubble'
        );
        this.onKnowledgeBaseThinking(true, 'give me a moment while i check');

        // Trigger Checking 💡 animation simultaneously
        if (window.triggerExpression) {
          console.log(
            '💡 HTTP: Triggering Checking animation for knowledge base search'
          );
          window.triggerExpression('💡');
        }
      }

      // Show events thinking bubble if events keywords detected
      if (containsEventsKeywords && this.onEventsThinking) {
        console.log('📅 HTTP: Detected events keywords in message:', message);
        console.log('📅 HTTP: Showing events thinking bubble');
        this.onEventsThinking(true, 'let me check the calendar');

        // Trigger Checking 💡 animation simultaneously
        if (window.triggerExpression) {
          console.log(
            '💡 HTTP: Triggering Checking animation for events search'
          );
          window.triggerExpression('💡');
        }
      }

      // Get memory context if available
      let memoryContext = '';
      if (typeof BrowserMemory !== 'undefined' && BrowserMemory.initialized) {
        try {
          memoryContext = BrowserMemory.getUserContext();
        } catch (error) {
          console.warn('⚠️ Failed to get memory context:', error);
        }
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          conversationId: conversationId,
          memoryContext: memoryContext,
        }),
      });

      const data = await response.json();

      // Hide knowledge base thinking bubble after response (with delay if knowledge base was used)
      if (containsLibraryKeywords && this.onKnowledgeBaseThinking) {
        if (data.usedKnowledgeBase) {
          console.log('🧠 HTTP: Knowledge base was used, hiding with delay');
          this.onKnowledgeBaseThinking(false, 'delayed');
        } else {
          console.log('🧠 HTTP: Knowledge base not used, hiding immediately');
          this.onKnowledgeBaseThinking(false, 'immediate');
        }
      }

      // Hide events thinking bubble after response (with delay if events was used)
      if (containsEventsKeywords && this.onEventsThinking) {
        // Check if events was actually used (either from API flag or response content)
        const eventsWasUsed =
          data.usedEvents ||
          (data.response &&
            (data.response.toLowerCase().includes('event') ||
              data.response.toLowerCase().includes('program') ||
              data.response.toLowerCase().includes('workshop') ||
              data.response.toLowerCase().includes('activity')));

        if (eventsWasUsed) {
          console.log('📅 HTTP: Events was used, hiding with delay');
          this.onEventsThinking(false, 'delayed');
        } else {
          console.log('📅 HTTP: Events not used, hiding immediately');
          this.onEventsThinking(false, 'immediate');
        }
      }

      return data;
    } catch (error) {
      console.error('HTTP chat error:', error);
      // Hide thinking bubbles on error
      if (this.onKnowledgeBaseThinking) {
        this.onKnowledgeBaseThinking(false, 'immediate');
      }
      if (this.onEventsThinking) {
        this.onEventsThinking(false, 'immediate');
      }
      throw error;
    }
  }

  async clearChatHTTP(conversationId) {
    try {
      await fetch(`/api/conversation/${conversationId}`, {
        method: 'DELETE',
      });
      return true;
    } catch (error) {
      console.error('HTTP clear chat error:', error);
      throw error;
    }
  }

  // =====================================================
  // UNIFIED CHAT METHODS (WebSocket + HTTP Fallback)
  // =====================================================
  async sendChat(message, conversationId) {
    if (this.isAvailable()) {
      // WebSocket path
      return this.sendChatMessage(message, conversationId);
    } else {
      // HTTP fallback
      try {
        const data = await this.sendChatHTTP(message, conversationId);

        if (data.success && this.onClaudeResponse) {
          this.onClaudeResponse(
            data.response,
            data.avatarEmoji,
            data.usedKnowledgeBase,
            data.catalogueData,
            data.usedEvents,
            data.timing
          );

          // Store messages in browser memory after successful response
          if (
            typeof BrowserMemory !== 'undefined' &&
            BrowserMemory.initialized
          ) {
            try {
              BrowserMemory.storeMessage('user', message);
              BrowserMemory.storeMessage('assistant', data.response);
            } catch (error) {
              console.warn(
                '⚠️ Failed to store messages in browser memory:',
                error
              );
            }
          }
        } else if (!data.success) {
          console.error('❌ Error: ' + (data.error || 'Unknown error'));
          if (this.onMessage) {
            this.onMessage('❌ Error: ' + (data.error || 'Unknown error'));
          }
        }

        if (this.onStatusUpdate) {
          this.onStatusUpdate('Ready', 'success');
        }
        if (this.onLoading) {
          this.onLoading(false);
        }

        return true;
      } catch (error) {
        console.error('Error:', error);
        if (this.onMessage) {
          this.onMessage('❌ Connection error. Please try again.');
        }
        if (this.onStatusUpdate) {
          this.onStatusUpdate('Error', 'error');
        }
        if (this.onLoading) {
          this.onLoading(false);
        }
        return false;
      }
    }
  }

  async clearChat(conversationId) {
    if (this.isAvailable()) {
      return this.sendClearChat(conversationId);
    } else {
      try {
        await this.clearChatHTTP(conversationId);
        return true;
      } catch (error) {
        console.error('Failed to clear chat:', error);
        return false;
      }
    }
  }

  // =====================================================
  // STATUS AND GETTERS
  // =====================================================
  isAvailable() {
    return (
      this.useWebSocket && this.ws && this.ws.readyState === WebSocket.OPEN
    );
  }

  getConnectionState() {
    return {
      isConnected: this.isConnected,
      useWebSocket: this.useWebSocket,
      readyState: this.ws ? this.ws.readyState : -1,
      isAvailable: this.isAvailable(),
    };
  }

  getConnectionStatus() {
    if (this.isAvailable()) {
      return 'connected';
    } else if (this.useWebSocket) {
      return 'connecting';
    } else {
      return 'http-only';
    }
  }

  // =====================================================
  // CONNECTION MANAGEMENT
  // =====================================================
  connect() {
    if (!this.useWebSocket) {
      console.log('🌐 connect() skipped - HTTP-only mode');
      return;
    }
    this.initWebSocket();
  }

  reconnect() {
    this.disconnect();
    setTimeout(() => {
      this.useWebSocket = true;
      this.initWebSocket();
    }, 1000);
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.useWebSocket = false;
  }

  // =====================================================
  // ENVIRONMENT DETECTION
  // =====================================================
  detectEnvironment() {
    const hostname = window.location.hostname || '';
    const search = window.location.search || '';
    const forceHTTP = search.includes('httpOnly=1');
    const isVercel = hostname.includes('vercel.app');
    if (forceHTTP || isVercel) {
      return {
        httpOnly: true,
        reason: forceHTTP
          ? 'Forced via query parameter'
          : 'WebSockets unsupported on Vercel serverless',
      };
    }
    return { httpOnly: false, reason: '' };
  }

  disableWebSocket(reason = 'Manual override') {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        console.warn('⚠️ Error closing WebSocket:', error);
      }
      this.ws = null;
    }
    this.isConnected = false;
    this.useWebSocket = false;
    console.log('🌐 WebSocket disabled:', reason);
  }

  // =====================================================
  // CLEANUP
  // =====================================================
  cleanup() {
    this.disconnect();
    this.onStatusUpdate = null;
    this.onMessage = null;
    this.onClaudeResponse = null;
    this.onLoading = null;
    this.onKnowledgeBaseThinking = null;
    this.onEventsThinking = null;
  }
}
