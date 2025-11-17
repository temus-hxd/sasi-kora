export class IdleTimerManager {
  constructor() {
    this.idleTimer = null;
    this.idleTimeoutMs = 8000; // 8 seconds default
    this.idleSpeechTimer = null;
    this.idleSpeechTimeoutMs = 15000; // 15 seconds for idle speech
    this.head = null;
    this.isLoaded = false;
    this.currentMoodRef = null;
    this.currentMood = 'neutral';
    this.chatManager = null;
    this.ttsManager = null;
    this.isSpeaking = false;
  }

  // =====================================================
  // DEPENDENCY INJECTION
  // =====================================================
  setDependencies(head, isLoadedRef, currentMoodRef, currentMoodVar, chatManager = null, ttsManager = null) {
    this.head = head;
    this.getIsLoaded = () => isLoadedRef;
    this.currentMoodRef = currentMoodRef;
    this.getCurrentMood = () => currentMoodVar;
    this.setCurrentMood = (mood) => {
      currentMoodVar = mood;
      if (this.currentMoodRef) {
        this.currentMoodRef.current = mood;
      }
    };
    this.chatManager = chatManager;
    this.ttsManager = ttsManager;
  }
  
  // Set speaking state (called by TTSManager)
  setSpeaking(isSpeaking) {
    this.isSpeaking = isSpeaking;
  }

  // =====================================================
  // IDLE TIMER MANAGEMENT
  // =====================================================
  startIdleTimer() {
    // Clear any existing timers
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    if (this.idleSpeechTimer) {
      clearTimeout(this.idleSpeechTimer);
    }
    
    // Set timer to revert to neutral
    this.idleTimer = setTimeout(() => {
      if (this.head && this.getIsLoaded() && this.currentMoodRef && this.currentMoodRef.current !== 'neutral') {
        console.log(`🕐 ${this.idleTimeoutMs/1000} seconds idle - reverting to neutral mood`);
        this.head.setMood('neutral');
        this.currentMoodRef.current = 'neutral';
        this.currentMood = 'neutral';
      }
    }, this.idleTimeoutMs);
    
    // Set timer for idle speech (15 seconds)
    this.idleSpeechTimer = setTimeout(() => {
      this.triggerIdleSpeech();
    }, this.idleSpeechTimeoutMs);
  }

  resetIdleTimer() {
    this.startIdleTimer();
  }
  
  // =====================================================
  // IDLE SPEECH PROMPTS
  // =====================================================
  async triggerIdleSpeech() {
    // Don't trigger if already speaking or if avatar/chat manager not ready
    if (this.isSpeaking || !this.chatManager || !this.ttsManager || !this.head || !this.getIsLoaded()) {
      console.log('⏸️ Skipping idle speech - already speaking or not ready');
      return;
    }
    
    // Idle speech prompts for Ah Meng (grumpy, old man)
    const idlePrompts = [
      "So are you just going to stare there and keep quiet?",
      "Wah, you just going to sit there ah?",
      "Hello? Anyone there?",
      "You still there or not?",
      "Eh, you sleeping is it?",
      "Don't tell me you forgot how to talk already.",
      "Wah, so quiet one. Nothing to say meh?",
      "You waiting for me to start talking first ah?",
      "Eh, you still there?",
      "So quiet... you okay or not?"
    ];
    
    // Pick a random prompt
    const randomPrompt = idlePrompts[Math.floor(Math.random() * idlePrompts.length)];
    
    console.log(`💬 Triggering idle speech: "${randomPrompt}"`);
    
    try {
      // Call emotion engine API with the idle prompt
      // Use empty history to get a fresh response
      const response = await fetch('/api/emotional-state/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: randomPrompt,
          conversation_id: this.chatManager.conversationId,
          history: this.chatManager.conversationHistory || [],
          emotion_state: this.chatManager.emotionState || null
        })
      });
      
      if (!response.ok) {
        console.warn('⚠️ Failed to get idle speech response');
        return;
      }
      
      const data = await response.json();
      
      // Update emotion state
      if (data.emotion_state) {
        this.chatManager.emotionState = data.emotion_state;
      }
      
      // Add to conversation history
      if (this.chatManager.conversationHistory) {
        this.chatManager.conversationHistory.push({
          role: 'user',
          content: randomPrompt,
          timestamp: new Date().toISOString()
        });
        this.chatManager.conversationHistory.push({
          role: 'assistant',
          content: data.response,
          timestamp: data.timestamp
        });
      }
      
      // Speak the response
      if (data.response && this.ttsManager) {
        const avatarEmoji = data.avatar_emoji || '🤔';
        
        // Show speech bubble (access via global or dependency)
        const speechBubbleManager = window.speechBubbleManager || (this.chatManager && this.chatManager.speechBubbleManager);
        if (speechBubbleManager) {
          speechBubbleManager.showSpeechBubble(data.response);
        }
        
        // Mark as speaking before starting TTS
        this.isSpeaking = true;
        
        // Speak the response
        await this.ttsManager.speakText(data.response);
        
        // Mark as not speaking after TTS completes
        this.isSpeaking = false;
        
        // Reset idle timer after speaking (so it doesn't immediately trigger again)
        this.resetIdleTimer();
        
        console.log('✅ Idle speech completed');
      }
    } catch (error) {
      console.error('❌ Error triggering idle speech:', error);
    }
  }

  // =====================================================
  // CONFIGURATION
  // =====================================================
  setIdleTimeout(milliseconds) {
    this.idleTimeoutMs = milliseconds;
  }

  getIdleTimeout() {
    return this.idleTimeoutMs;
  }

  // =====================================================
  // CLEANUP
  // =====================================================
  clearIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    if (this.idleSpeechTimer) {
      clearTimeout(this.idleSpeechTimer);
      this.idleSpeechTimer = null;
    }
  }
  
  // =====================================================
  // CONFIGURATION
  // =====================================================
  setIdleSpeechTimeout(milliseconds) {
    this.idleSpeechTimeoutMs = milliseconds;
  }
  
  getIdleSpeechTimeout() {
    return this.idleSpeechTimeoutMs;
  }

  // =====================================================
  // STATE GETTERS
  // =====================================================
  isTimerActive() {
    return this.idleTimer !== null;
  }
} 