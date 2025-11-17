/**
 * BrowserMemory - Client-side long-term memory using localStorage
 * Provides persistent conversation context across browser sessions
 */
const BrowserMemory = {
    storageKey: 'hr-chatbot-memory',    // localStorage key
    maxMessages: 50,                    // Maximum stored messages
    initialized: false,                 // Initialization state

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
                id: Date.now() + Math.random()
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

            const contextLines = recentMessages.map(msg => 
                `${msg.role}: ${msg.content}`
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
            lastUpdated: new Date().toISOString()
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
                lastUpdated: memory.lastUpdated
            };
        } catch (error) {
            console.warn('⚠️ Failed to get stats:', error);
            return { messages: 0, size: 0 };
        }
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BrowserMemory;
}

