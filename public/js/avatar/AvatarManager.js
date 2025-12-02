import { TalkingHead } from 'talkinghead';

export class AvatarManager {
  constructor() {
    this.head = null;
    this.isLoaded = false;
    this.currentMood = 'neutral';
    this.currentMoodRef = { current: 'neutral' };

    // Dependencies (set via dependency injection)
    this.configManager = null;
    this.uiManager = null;
    this.idleTimerManager = null;
    this.voiceStateManager = null;
    this.emojiManager = null;
    this.linkButtonManager = null;
    this.speechBubbleManager = null;
    this.speechRecognitionManager = null;
    this.ttsManager = null;
    this.webSocketManager = null;
    this.chatManager = null;
    this.animationManager = null;

    // Page visibility event handler bound to this instance
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  // =====================================================
  // SETUP AND CONFIGURATION
  // =====================================================
  setDependencies({
    configManager,
    uiManager,
    idleTimerManager,
    voiceStateManager,
    emojiManager,
    linkButtonManager,
    speechBubbleManager,
    speechRecognitionManager,
    ttsManager,
    webSocketManager,
    chatManager,
    animationManager,
  }) {
    this.configManager = configManager;
    this.uiManager = uiManager;
    this.idleTimerManager = idleTimerManager;
    this.voiceStateManager = voiceStateManager;
    this.emojiManager = emojiManager;
    this.linkButtonManager = linkButtonManager;
    this.speechBubbleManager = speechBubbleManager;
    this.speechRecognitionManager = speechRecognitionManager;
    this.ttsManager = ttsManager;
    this.webSocketManager = webSocketManager;
    this.chatManager = chatManager;
    this.animationManager = animationManager;
  }

  // =====================================================
  // AVATAR INITIALIZATION
  // =====================================================
  async initAvatar() {
    this.uiManager?.updateLoadingScreen(
      0,
      'Initializing TalkingHead system...'
    );

    try {
      // Initialize ConfigManager and load configuration first
      // Load with saved language preference
      const savedLanguage = localStorage.getItem('app_language') || 'en';
      const configLoaded = await this.configManager?.loadConfig(savedLanguage);
      if (!configLoaded) {
        console.error(
          '❌ Failed to load configuration - check /api/config endpoint'
        );
        this.uiManager?.updateLoadingScreen(
          0,
          'Error: Failed to load configuration. Check browser console.'
        );
        // Don't proceed if config fails - avatar needs URL and voice ID
        return;
      }

      const nodeAvatar = document.getElementById('avatar');

      this.uiManager?.updateLoadingScreen(
        10,
        'Setting up avatar configuration...'
      );

      this.head = new TalkingHead(nodeAvatar, {
        ttsEndpoint: '/api/dummy-tts',
        lipsyncModules: ['en'],
        cameraView: 'upper',
        cameraY: 0.15,
        modelFPS: 120, // Increased for high refresh rate displays
        avatarMood: 'neutral',
        avatarIdleEyeContact: 0.3,
        avatarIdleHeadMove: 0.25, // Reduced from 0.6 to 0.25 for less "huffing puffing"
        avatarSpeakingEyeContact: 1.0, // Maximum eye contact when speaking - always look at user
        avatarSpeakingHeadMove: 0.8,
        modelMovementFactor: 1.0,
        // Audio-driven lip sync settings for ElevenLabs
        lipsyncLang: 'en',
        avatarMouthOpenClamp: 0.6, // Moderate mouth opening (0.0-1.0, default ~0.8) - increased for better visibility
        avatarMouthSmooth: 12, // Very high smoothing for slow, smooth mouth movements (higher = smoother/slower)
        avatarVisemeThreshold: 0.2, // Higher threshold to filter out minor movements
      });

      this.uiManager?.updateLoadingScreen(
        25,
        'Loading ReadyPlayerMe avatar...'
      );

      await this.head.showAvatar(
        {
          url: this.configManager?.getAvatarUrl(),
          body: 'F',
          avatarMood: 'neutral',
          lipsyncLang: 'en',
        },
        (progress) => {
          if (progress.lengthComputable) {
            const percent = Math.round(
              (progress.loaded / progress.total) * 100
            );
            const loadingPercent = 25 + percent * 0.65; // 25% to 90%
            this.uiManager?.updateLoadingScreen(
              loadingPercent,
              `Loading avatar model... ${percent}%`
            );
          }
        }
      );

      this.uiManager?.updateLoadingScreen(95, 'Finalizing setup...');

      // Zero all lights
      if (this.head.scene) {
        this.zeroAllLights(this.head.scene);
      }

      // Simulate final loading steps
      await new Promise((resolve) => setTimeout(resolve, 500));

      this.uiManager?.updateLoadingScreen(100, 'Ready!');

      // Wait a moment before hiding
      await new Promise((resolve) => setTimeout(resolve, 800));

      this.isLoaded = true;
      this.uiManager?.hideLoadingScreen();

      // Initialize other managers with avatar dependencies
      await this.initializeOtherManagers();

      // Set up page visibility handling
      this.setupPageVisibilityHandling();
    } catch (error) {
      console.error('❌ Avatar initialization error:', error);
      this.uiManager?.updateLoadingScreen(
        0,
        'Error loading avatar: ' + error.message
      );
      this.uiManager?.updateClaudeStatus('Avatar Error', 'error');

      // Hide loading screen even on error
      setTimeout(() => this.uiManager?.hideLoadingScreen(), 2000);
    }
  }

  // =====================================================
  // MANAGER INITIALIZATION
  // =====================================================
  async initializeOtherManagers() {
    // Initialize managers that depend on avatar
    this.idleTimerManager?.setDependencies(
      this.head,
      this.isLoaded,
      this.currentMoodRef,
      this.currentMood
    );

    this.voiceStateManager?.setUpdateStatusFunction(
      this.uiManager?.updateStatus.bind(this.uiManager)
    );

    this.emojiManager?.setDependencies(this.head, this.currentMoodRef, () =>
      this.idleTimerManager?.resetIdleTimer()
    );

    // Initialize AnimationManager with TalkingHead instance
    if (this.animationManager && this.head) {
      this.animationManager.initialize(this.head);
      await this.animationManager.preloadAnimations();
      console.log('🎭 AnimationManager initialized with avatar');
    }

    // Initialize TTS manager with dependencies
    this.ttsManager?.setDependencies(
      this.head,
      this.isLoaded,
      this.configManager,
      this.voiceStateManager,
      this.idleTimerManager,
      this.speechBubbleManager,
      this.animationManager,
      this.uiManager
    );

    // Initialize ChatManager with all dependencies including avatar
    this.chatManager?.setDependencies({
      webSocketManager: this.webSocketManager,
      uiManager: this.uiManager,
      idleTimerManager: this.idleTimerManager,
      ttsManager: this.ttsManager,
      emojiManager: this.emojiManager,
      linkButtonManager: this.linkButtonManager,
      head: this.head,
      isLoaded: this.isLoaded,
      animationManager: this.animationManager, // Pass AnimationManager to ChatManager
    });

    // Set up WebSocket callbacks including ChatManager's response handler
    this.webSocketManager?.setCallbacks({
      onStatusUpdate: (status, type) =>
        this.uiManager?.updateClaudeStatus(status, type),
      onMessage: (message) => this.uiManager?.updateStatus(message),
      onClaudeResponse: (
        response,
        avatarEmoji,
        usedKnowledgeBase,
        usedEvents,
        timing
      ) => {
        this.chatManager?.handleClaudeResponse(
          response,
          avatarEmoji,
          usedKnowledgeBase,
          usedEvents,
          timing
        );
        if (usedKnowledgeBase) {
          console.log('🧠 Response included knowledge base information');
        }
        if (usedEvents) {
          console.log('📅 Response included events information');
        }
      },
      onLoading: (loading) => this.uiManager?.setLoading(loading),
      onKnowledgeBaseThinking: (show, message) => {
        if (show) {
          this.uiManager?.showKnowledgeBaseThinking(message);
        } else {
          // Check if this is a delayed hide request
          if (message === 'delayed') {
            this.uiManager?.hideKnowledgeBaseThinking(8000); // 8 second delay
          } else {
            this.uiManager?.hideKnowledgeBaseThinkingImmediate();
          }
        }
      },
      onEventsThinking: (show, message) => {
        if (show) {
          this.uiManager?.showEventsThinking(message);
        } else {
          // Check if this is a delayed hide request
          if (message === 'delayed') {
            this.uiManager?.hideEventsThinking(3000); // 3 second delay
          } else {
            this.uiManager?.hideEventsThinkingImmediate();
          }
        }
      },
    });

    // Connect WebSocket (skip on serverless/HTTP-only mode)
    if (
      this.webSocketManager?.environment?.httpOnly ||
      !this.webSocketManager?.useWebSocket
    ) {
      this.webSocketManager?.disableWebSocket(
        'Serverless environment detected - using HTTP-only mode'
      );
    } else {
      this.webSocketManager?.connect();
    }

    // Initialize ChatManager
    this.chatManager?.init();

    // Start idle timer for mood management
    this.idleTimerManager?.startIdleTimer();

    // Initialize voice state
    this.voiceStateManager?.getVoiceState();
  }

  // =====================================================
  // AVATAR CONTROL FUNCTIONS
  // =====================================================
  triggerExpression(emoji) {
    if (this.head && this.isLoaded && this.emojiManager) {
      if (this.emojiManager.hasEmojiAction(emoji)) {
        this.emojiManager.triggerEmojiAction(emoji);
      } else {
        this.head.speakEmoji(emoji);
      }
      this.uiManager?.updateStatus(`Avatar expression: ${emoji}`);

      // Show a brief speech bubble for expressions
      this.speechBubbleManager?.showTimedSpeechBubble(`*${emoji}*`, 2000);
    }
  }

  changeView(view) {
    if (this.head && this.isLoaded) {
      this.head.setView(view);
      this.uiManager?.updateStatus(`🎥 Avatar view: ${view}`);
      document
        .querySelectorAll('.section:last-of-type .btn')
        .forEach((btn) => btn.classList.remove('active'));
      if (event && event.target) {
        event.target.classList.add('active');
      }
    }
  }

  resetAvatar() {
    if (this.head && this.isLoaded) {
      this.head.setMood('neutral');
      this.head.setView('upper');
      this.head.stopGesture();
      this.currentMood = 'neutral';
      this.currentMoodRef.current = 'neutral';
      this.uiManager?.updateStatus('🔄 Avatar reset');
    }
  }

  // =====================================================
  // AVATAR STATE MANAGEMENT
  // =====================================================
  setMood(mood) {
    if (this.head && this.isLoaded) {
      this.head.setMood(mood);
      this.currentMood = mood;
      this.currentMoodRef.current = mood;
    }
  }

  getMood() {
    return this.currentMood;
  }

  setView(view) {
    if (this.head && this.isLoaded) {
      this.head.setView(view);
    }
  }

  speak(text) {
    if (this.head && this.isLoaded) {
      this.head.speak({ text });
    }
  }

  speakEmoji(emoji) {
    if (this.head && this.isLoaded) {
      this.head.speakEmoji(emoji);
    }
  }

  stopGesture() {
    if (this.head && this.isLoaded) {
      this.head.stopGesture();
    }
  }

  // =====================================================
  // LIGHTING MANAGEMENT
  // =====================================================
  zeroAllLights(scene) {
    console.log('🌑 ZEROING ALL LIGHTS');

    scene.traverse((child) => {
      if (child.isLight && child.intensity !== undefined) {
        const original = child.intensity;
        child.intensity = 0; // Completely off
        console.log(`💡 ${child.type}: ${original} → 0`);
      }
    });

    console.log('🌑 ALL LIGHTS ZEROED');
  }

  // =====================================================
  // PAGE VISIBILITY HANDLING
  // =====================================================
  setupPageVisibilityHandling() {
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  handleVisibilityChange() {
    if (this.head) {
      if (document.visibilityState === 'visible') {
        this.head.start();
      } else {
        this.head.stop();
      }
    }
  }

  // =====================================================
  // GETTERS
  // =====================================================
  getHead() {
    return this.head;
  }

  getIsLoaded() {
    return this.isLoaded;
  }

  getCurrentMoodRef() {
    return this.currentMoodRef;
  }

  getCurrentMood() {
    return this.currentMood;
  }

  isAvatarReady() {
    return this.head && this.isLoaded;
  }

  // =====================================================
  // AVATAR ACTIONS
  // =====================================================
  startAvatar() {
    if (this.head) {
      this.head.start();
    }
  }

  stopAvatar() {
    if (this.head) {
      this.head.stop();
    }
  }

  // =====================================================
  // AUTOMATIC GREETING
  // =====================================================
  sendAutomaticGreeting() {
    if (this.chatManager && this.webSocketManager) {
      // Send the greeting message automatically
      const greetingMessage = 'Hi there Nigel! Anything I can help you with?';

      // Use the TTS system to speak the greeting directly
      if (this.ttsManager && this.head && this.isLoaded) {
        this.ttsManager.speakText(greetingMessage);

        // Also show it in the speech bubble
        if (this.speechBubbleManager) {
          this.speechBubbleManager.showTimedSpeechBubble(greetingMessage, 4000);
        }

        // Add to chat history if needed
        if (window.BrowserMemory) {
          window.BrowserMemory.storeMessage('assistant', greetingMessage);
        }

        console.log('🤝 Automatic greeting sent:', greetingMessage);
      }
    }
  }

  // =====================================================
  // CLEANUP
  // =====================================================
  cleanup() {
    // Remove page visibility handler
    document.removeEventListener(
      'visibilitychange',
      this.handleVisibilityChange
    );

    // Stop avatar
    this.stopAvatar();

    // Clean up avatar instance
    if (this.head) {
      // Note: TalkingHead may have its own cleanup methods
      this.head = null;
    }

    // Reset state
    this.isLoaded = false;
    this.currentMood = 'neutral';
    this.currentMoodRef.current = 'neutral';

    // Reset dependencies
    this.configManager = null;
    this.uiManager = null;
    this.idleTimerManager = null;
    this.voiceStateManager = null;
    this.emojiManager = null;
    this.speechBubbleManager = null;
    this.speechRecognitionManager = null;
    this.ttsManager = null;
    this.webSocketManager = null;
    this.chatManager = null;
    this.animationManager = null;
  }
}
