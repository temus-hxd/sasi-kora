/**
 * Emotion Chat Manager
 * Handles chat with emotion engine API (REST instead of WebSocket)
 */

export class EmotionChatManager {
  constructor() {
    this.conversationId = 'default-' + Date.now();
    this.conversationHistory = [];
    this.emotionState = null;

    // Dependencies
    this.ttsManager = null;
    this.emojiManager = null;
    this.speechBubbleManager = null;
    this.uiManager = null;
    this.head = null;
  }

  setDependencies({
    ttsManager,
    emojiManager,
    speechBubbleManager,
    uiManager,
    head,
  }) {
    this.ttsManager = ttsManager;
    this.emojiManager = emojiManager;
    this.speechBubbleManager = speechBubbleManager;
    this.uiManager = uiManager;
    this.head = head;
  }

  async sendMessage(message) {
    if (!message || !message.trim()) return;

    // Interrupt current speech if speaking
    if (this.ttsManager) {
      this.ttsManager.interruptSpeech();
    }

    // Update TTS manager with the last user message
    if (this.ttsManager) {
      this.ttsManager.setLastUserMessage(message);
    }

    this.uiManager?.updateClaudeStatus('Thinking...', 'thinking');
    this.uiManager?.setLoading(true);

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    });

    try {
      // Prepare history for API (remove timestamp field)
      const historyForAPI = this.conversationHistory
        .slice(0, -1)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

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
          emotion_state: this.emotionState,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
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

      // Handle response
      await this.handleEmotionResponse(data);
    } catch (error) {
      console.error('Error sending message:', error);
      this.uiManager?.updateStatus('❌ Error: ' + error.message);
      this.uiManager?.updateClaudeStatus('Error', 'error');
      this.uiManager?.setLoading(false);
    }
  }

  async handleEmotionResponse(data) {
    const response = data.response;
    const avatarEmoji = data.avatar_emoji || '😐';
    const agentType = data.agent_type || 'normal';

    // Update UI status
    this.uiManager?.updateClaudeStatus('Ready', 'success');
    this.uiManager?.setLoading(false);

    // Show speech bubble
    if (this.speechBubbleManager) {
      // Remove thinking tags and emojis for speech bubble
      const cleanText = response
        .replace(/<t>[\s\S]*?<\/t>/gi, '')
        .replace(
          /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]/gu,
          ''
        )
        .trim();
      this.speechBubbleManager.showSpeechBubble(cleanText);
    }

    // Trigger avatar emoji expression
    if (this.emojiManager && avatarEmoji) {
      this.emojiManager.triggerEmojiAction(avatarEmoji);
    }

    // Generate TTS
    if (this.ttsManager && this.head) {
      try {
        await this.ttsManager.speakText(response);
      } catch (ttsError) {
        console.error('TTS error:', ttsError);
      }
    }
  }

  handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const messageInput = document.getElementById('messageInput');
      if (messageInput) {
        this.sendMessage(messageInput.value.trim());
      }
    }
  }

  clearChat() {
    this.conversationHistory = [];
    this.conversationId = 'default-' + Date.now();
    this.emotionState = null;
    // Call reset API
    fetch('/api/emotional-state/reset', { method: 'POST' }).catch(
      console.error
    );
  }
}
