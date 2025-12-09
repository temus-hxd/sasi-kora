/**
 * BrowserMemory - Client-side long-term memory using localStorage
 * Provides persistent conversation context across browser sessions
 */
const BrowserMemory = {
  storageKey: 'hr-chatbot-memory', // localStorage key
  maxMessages: 50, // Maximum stored messages
  initialized: false, // Initialization state

  /**
   * Initialize the memory system
   */
  init() {
    try {
      this.cleanupOldSessions();
      this.initialized = true;
      console.log('✅ Browser memory initialized');
    } catch (error) {
      console.warn('⚠️ Failed to initialize browser memory:', error);
    }
  },

  /**
   * Store a conversation message
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   */
  storeMessage(role, content) {
    if (!this.initialized) return;

    try {
      const memory = this.getMemory();
      const message = {
        role,
        content,
        timestamp: new Date().toISOString(),
        id: Date.now() + Math.random(),
      };

      memory.messages.push(message);
      memory.lastUpdated = new Date().toISOString();

      // Maintain message limit
      if (memory.messages.length > this.maxMessages) {
        memory.messages = memory.messages.slice(-this.maxMessages);
      }

      localStorage.setItem(this.storageKey, JSON.stringify(memory));
    } catch (error) {
      console.warn('⚠️ Failed to store message:', error);
    }
  },

  /**
   * Get formatted context for AI prompts
   * @returns {string} Formatted context string
   */
  getUserContext() {
    if (!this.initialized) return '';

    try {
      const memory = this.getMemory();
      const recentMessages = memory.messages.slice(-6); // Last 6 messages

      if (recentMessages.length === 0) return '';

      const contextLines = recentMessages.map(
        (msg) => `${msg.role}: ${msg.content}`
      );

      return `\n\nRecent conversation context:\n${contextLines.join('\n')}`;
    } catch (error) {
      console.warn('⚠️ Failed to get user context:', error);
      return '';
    }
  },

  /**
   * Get conversation history
   * @param {number} limit - Number of messages to return
   * @returns {Array} Array of message objects
   */
  getConversationHistory(limit = 20) {
    if (!this.initialized) return [];

    try {
      const memory = this.getMemory();
      return memory.messages.slice(-limit);
    } catch (error) {
      console.warn('⚠️ Failed to get conversation history:', error);
      return [];
    }
  },

  /**
   * Clear all stored conversation data
   */
  clearSession() {
    if (!this.initialized) return;

    try {
      localStorage.removeItem(this.storageKey);
      console.log('✅ Browser memory session cleared');
    } catch (error) {
      console.warn('⚠️ Failed to clear session:', error);
    }
  },

  /**
   * Archive completed session instead of deleting
   * Moves conversation to archived storage for later retrieval
   */
  archiveSession() {
    if (!this.initialized) return;

    try {
      const memory = this.getMemory();
      if (memory.messages.length === 0) {
        console.log('📦 No messages to archive');
        return;
      }

      // Create archived session with metadata
      const archivedSession = {
        ...memory,
        completedAt: new Date().toISOString(),
        archived: true,
        sessionId: memory.created || Date.now().toString(),
      };

      // Store in archived key (keep last 5 archived sessions)
      const archiveKey = 'hr-chatbot-memory-archived';
      let archivedSessions = [];

      try {
        const stored = localStorage.getItem(archiveKey);
        if (stored) {
          archivedSessions = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('⚠️ Failed to read archived sessions:', e);
      }

      // Add new archive and keep only last 5
      archivedSessions.push(archivedSession);
      archivedSessions = archivedSessions.slice(-5);

      localStorage.setItem(archiveKey, JSON.stringify(archivedSessions));
      console.log('📦 Session archived successfully');

      // Clear active session
      this.clearSession();
    } catch (error) {
      console.warn('⚠️ Failed to archive session:', error);
      // Fallback to regular clear
      this.clearSession();
    }
  },

  /**
   * Mark session as completed without deleting
   * Adds completion metadata to existing session
   */
  markSessionCompleted() {
    if (!this.initialized) return;

    try {
      const memory = this.getMemory();
      if (memory.messages.length === 0) {
        console.log('📝 No messages to mark as completed');
        return;
      }

      // Add completion metadata
      memory.completed = true;
      memory.completedAt = new Date().toISOString();
      memory.lastUpdated = new Date().toISOString();

      localStorage.setItem(this.storageKey, JSON.stringify(memory));
      console.log('✅ Session marked as completed');

      // Create new active session
      this.clearSession();
    } catch (error) {
      console.warn('⚠️ Failed to mark session as completed:', error);
    }
  },

  /**
   * Move session to sessionStorage (auto-clears on tab close)
   * Keeps it available for current session but clears on browser close
   */
  moveToSessionStorage() {
    if (!this.initialized) return;

    try {
      const memory = this.getMemory();
      if (memory.messages.length === 0) {
        console.log('📦 No messages to move');
        return;
      }

      // Copy to sessionStorage
      const sessionKey = 'hr-chatbot-memory-session';
      sessionStorage.setItem(sessionKey, JSON.stringify(memory));
      console.log('📦 Session moved to sessionStorage');

      // Clear localStorage
      this.clearSession();
    } catch (error) {
      console.warn('⚠️ Failed to move to sessionStorage:', error);
      // Fallback to regular clear
      this.clearSession();
    }
  },

  /**
   * Export conversation as JSON and download
   * Allows user to save conversation before clearing
   */
  exportSession() {
    if (!this.initialized) return null;

    try {
      const memory = this.getMemory();
      if (memory.messages.length === 0) {
        console.log('📝 No messages to export');
        return null;
      }

      const exportData = {
        ...memory,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `conversation-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('💾 Session exported successfully');
      return exportData;
    } catch (error) {
      console.warn('⚠️ Failed to export session:', error);
      return null;
    }
  },

  /**
   * Get completed/archived sessions
   * @returns {Array} Array of archived sessions
   */
  getArchivedSessions() {
    try {
      const archiveKey = 'hr-chatbot-memory-archived';
      const stored = localStorage.getItem(archiveKey);
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    } catch (error) {
      console.warn('⚠️ Failed to get archived sessions:', error);
      return [];
    }
  },

  /**
   * Get or create memory structure
   * @returns {Object} Memory object
   */
  getMemory() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('⚠️ Corrupted memory data, resetting:', error);
    }

    // Return default structure
    const defaultMemory = {
      messages: [],
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(defaultMemory));
    } catch (error) {
      console.warn('⚠️ Failed to initialize default memory:', error);
    }

    return defaultMemory;
  },

  /**
   * Remove conversations older than 7 days
   */
  cleanupOldSessions() {
    try {
      const memory = this.getMemory();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      if (memory.created && new Date(memory.created) < sevenDaysAgo) {
        localStorage.removeItem(this.storageKey);
        console.log('🧹 Cleaned up old memory session');
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup old sessions:', error);
    }
  },

  /**
   * Get memory usage statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    if (!this.initialized) return { messages: 0, size: 0 };

    try {
      const memory = this.getMemory();
      const dataString = JSON.stringify(memory);

      return {
        messages: memory.messages.length,
        size: dataString.length,
        created: memory.created,
        lastUpdated: memory.lastUpdated,
      };
    } catch (error) {
      console.warn('⚠️ Failed to get stats:', error);
      return { messages: 0, size: 0 };
    }
  },
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BrowserMemory;
}
