export class TTSManager {
  constructor() {
    this.isInitialized = false;
    this.audioContext = null;
    this.configManager = null;
    this.speechBubbleManager = null;
    this.animationManager = null;
    this.uiManager = null;
    this.head = null;
    this.isLoaded = false;
    this.lastUserMessage = '';

    // Interruption support
    this.currentAudioSource = null;
    this.isSpeaking = false;
    this.currentFallbackTimeout = null;
    this.currentMonitorInterval = null;
    this.cleanupCurrentTimers = null;
  }

  // =====================================================
  // INITIALIZATION AND DEPENDENCIES
  // =====================================================
  setDependencies(
    head,
    isLoaded,
    configManager,
    speechBubbleManager,
    animationManager = null,
    uiManager = null
  ) {
    this.head = head;
    this.isLoaded = isLoaded;
    this.configManager = configManager;
    this.speechBubbleManager = speechBubbleManager;
    this.animationManager = animationManager;
    this.uiManager = uiManager;
    this.isInitialized = true;
  }

  setLastUserMessage(message) {
    this.lastUserMessage = message;
  }

  // =====================================================
  // TEXT PREPROCESSING
  // =====================================================
  cleanTextForTTS(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Filter out content inside <t></t> tags - only use content outside these tags
    // Remove properly closed <t>...</t> tags and their content
    let contentOutsideTags = text
      .replace(/<t>[\s\S]*?<\/t>/gi, '')
      // Also handle unclosed <t> tags (remove everything from <t> to end if no closing tag)
      .replace(/<t>[\s\S]*$/gi, '')
      // Remove standalone opening <t> tags without content
      .replace(/<t>\s*$/gi, '')
      .trim();

    // Remove all emoji ranges from the text
    let cleaned = contentOutsideTags
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Regional country flags
      .replace(/[\u{2600}-\u{26FF}]/gu, '') // Misc symbols
      .replace(/[\u{2700}-\u{27BF}]/gu, '') // Dingbats
      .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
      .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
      .replace(/[\u{2000}-\u{206F}]/gu, '') // General Punctuation (includes some emoji modifiers)
      .replace(/[\u{2190}-\u{21FF}]/gu, '') // Arrows
      .replace(/[\u{2B50}\u{2B55}]/gu, '') // Star and heavy large circle
      // Clean up extra whitespace
      .replace(/\s+/g, ' ')
      .trim();

    return cleaned;
  }

  // =====================================================
  // AUDIO PROCESSING
  // =====================================================
  async base64ToAudioBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }

    const audioBuffer = await this.audioContext.decodeAudioData(bytes.buffer);
    return audioBuffer;
  }

  // Boost audio buffer volume for better audibility
  boostAudioVolume(audioBuffer, gainMultiplier = 2.0) {
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }

    // Create a new buffer with the same properties
    const numberOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;
    const newBuffer = this.audioContext.createBuffer(
      numberOfChannels,
      length,
      sampleRate
    );

    // Copy and amplify each channel
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = newBuffer.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        // Apply gain multiplier and prevent clipping
        const amplified = inputData[i] * gainMultiplier;
        outputData[i] = Math.max(-1, Math.min(1, amplified)); // Clamp to [-1, 1]
      }
    }

    return newBuffer;
  }

  // =====================================================
  // TTS API COMMUNICATION
  // =====================================================
  async callTTSAPI(cleanText, useStreaming = false) {
    const ttsProvider = this.configManager
      ? this.configManager.getTTSProvider()
      : 'elevenlabs';

    // Get voiceId from config (loaded from server/.env)
    const voiceId = this.configManager ? this.configManager.getVoiceId() : null;

    // Ensure voiceId is loaded from server (.env)
    if (!voiceId) {
      console.error(
        '❌ Voice ID not loaded from server (.env). Please ensure ConfigManager.loadConfig() has been called.'
      );
      throw new Error(
        'Voice ID not configured. Please check your .env file and server configuration.'
      );
    }

    // ElevenLabs provider
    if (ttsProvider === 'elevenlabs') {
      const endpoint = '/api/elevenlabs/tts';
      const requestBody = {
        text: cleanText,
        voiceId: voiceId, // From server (.env) - no hardcoded fallback
        stream: true, // Enable streaming for faster response
        modelId: 'eleven_multilingual_v2', // Multilingual model for Chinese/English mix
        speed: 0.8, // Adjusted speed for Uncle Teo (70-year-old man)
        style: 0.0, // Less energetic (0.0 = calm, 1.0 = very energetic)
      };

      try {
        const apiStartTime = Date.now();

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'ElevenLabs TTS API call failed');
        }

        // Mark as streaming if server indicates it
        data.streaming = requestBody.stream || false;
        return data;
      } catch (error) {
        console.error('❌ ElevenLabs TTS error:', error);
        throw error;
      }
    }

    // Amazon Polly provider (fallback/legacy)
    else {
      // Prefer enhanced endpoint with real speech marks for better accuracy
      // Only use streaming as fallback for performance when needed
      const endpoint = useStreaming ? '/api/tts-stream' : '/api/tts-enhanced';
      const requestBody = {
        text: cleanText,
        voice: this.configManager ? this.configManager.getVoiceId() : null,
        sessionId: 'default-session',
        userMessage: this.lastUserMessage || '',
      };

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        const data = await response.json();

        // Enhanced error handling and fallback logic
        if (!data.success) {
          if (!useStreaming) {
            console.warn(
              '🎤 Enhanced TTS failed, falling back to streaming TTS'
            );
            return this.callTTSAPI(cleanText, true);
          } else {
            throw new Error(data.error || 'TTS API call failed');
          }
        }

        // Log timing accuracy info
        if (data.lipSync) {
          const timingType = data.streaming ? 'estimated' : 'precise';
          const syncInfo = data.lipSync.isSynchronized
            ? 'synchronized'
            : 'basic';
        } else {
        }

        return data;
      } catch (error) {
        // Only fallback to streaming if we weren't already using it
        if (!useStreaming) {
          console.warn(
            '🎤 Enhanced TTS error, falling back to streaming TTS:',
            error.message
          );
          return this.callTTSAPI(cleanText, true);
        }
        throw error;
      }
    }
  }

  // =====================================================
  // AUDIO OBJECT CREATION
  // =====================================================
  async createAudioObject(data) {
    // OPTIMIZATION: Decode audio immediately (this is the bottleneck)
    const decodeStartTime = Date.now();

    // OPTIMIZATION: Pre-warm audio context if not ready
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }

    // OPTIMIZATION: Resume audio context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    let audioBuffer = await this.base64ToAudioBuffer(data.audio);

    // Boost volume for better audibility (2x gain = +6dB)
    audioBuffer = this.boostAudioVolume(audioBuffer, 2.0);

    // Get ACTUAL audio duration from decoded buffer (most accurate)
    const actualAudioDuration = audioBuffer.duration; // in seconds
    const serverEstimatedDuration = data.duration || actualAudioDuration; // server's estimate

    // Check if we have server-generated visemes (preferred) or need audio-driven
    // Handle case where lipSync might be missing or undefined
    const lipSync = data.lipSync || {};
    const hasServerVisemes =
      lipSync.visemes &&
      Array.isArray(lipSync.visemes) &&
      lipSync.visemes.length > 0;
    const isAudioDriven =
      (data.audioDriven && !hasServerVisemes) ||
      (data.provider === 'elevenlabs' && !hasServerVisemes) ||
      !data.lipSync;

    if (hasServerVisemes) {
      // CRITICAL FIX: Rescale visemes to match ACTUAL audio duration
      // Server duration estimate may be inaccurate, causing visemes to finish too early
      const durationScaleFactor = actualAudioDuration / serverEstimatedDuration;

      if (Math.abs(durationScaleFactor - 1.0) > 0.05) {
        // Only scale if difference > 5%
        // Scale all viseme timings to match actual audio duration
        const scaledVtimes = (lipSync.visemeTimes || []).map(
          (t) => t * durationScaleFactor
        );
        const scaledVdurations = (lipSync.visemeDurations || []).map(
          (d) => d * durationScaleFactor
        );
        const scaledWtimes = (lipSync.wordTimes || []).map(
          (t) => t * durationScaleFactor
        );
        const scaledWdurations = (lipSync.wordDurations || []).map(
          (d) => d * durationScaleFactor
        );

        return {
          audio: audioBuffer,
          words: lipSync.words || [],
          wtimes: scaledWtimes,
          wdurations: scaledWdurations,
          visemes: lipSync.visemes,
          vtimes: scaledVtimes,
          vdurations: scaledVdurations,
          actualDuration: actualAudioDuration, // Store for fallback timers
        };
      }

      // Use server-generated visemes for better control (no scaling needed)
      return {
        audio: audioBuffer,
        words: lipSync.words || [],
        wtimes: lipSync.wordTimes || [],
        wdurations: lipSync.wordDurations || [],
        visemes: lipSync.visemes,
        vtimes: lipSync.visemeTimes || [],
        vdurations: lipSync.visemeDurations || [],
        actualDuration: actualAudioDuration, // Store for fallback timers
      };
    } else if (isAudioDriven || !data.lipSync) {
      // Fallback: let TalkingHead analyze audio (less ideal)
      // Handle case where lipSync is missing or undefined
      return {
        audio: audioBuffer,
        words: lipSync.words || [],
        wtimes: lipSync.wordTimes || [],
        wdurations: lipSync.wordDurations || [],
        // NO viseme properties - TalkingHead will generate from audio
      };
    } else {
      return {
        audio: audioBuffer,
        words: lipSync.words || [],
        wtimes: lipSync.wordTimes || [],
        wdurations: lipSync.wordDurations || [],
        visemes: lipSync.visemes || [],
        vtimes: lipSync.visemeTimes || [],
        vdurations: lipSync.visemeDurations || [],
      };
    }
  }

  // =====================================================
  // SPEECH PLAYBACK WITH LIP-SYNC
  // =====================================================
  playSpeechWithLipSync(audioObject, cleanText, data) {
    if (!this.head || !this.isLoaded) {
      console.warn('Head or avatar not ready for speech');
      return;
    }

    // CRITICAL: Ensure AudioContext is resumed before playback
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }

    // Force resume AudioContext - this is critical for audio playback
    if (this.audioContext.state === 'suspended') {
      this.audioContext
        .resume()
        .then(() => {
          this.actuallyPlayAudio(audioObject, cleanText, data);
        })
        .catch((error) => {
          console.error(
            '❌ CRITICAL: Failed to resume audio context in playSpeechWithLipSync:',
            error
          );
          // Try to create new context
          try {
            this.audioContext.close();
          } catch (closeError) {
            // Ignore
          }
          this.audioContext = new (
            window.AudioContext || window.webkitAudioContext
          )();
          this.actuallyPlayAudio(audioObject, cleanText, data);
        });
      return;
    }

    // AudioContext is already running, proceed with playback
    this.actuallyPlayAudio(audioObject, cleanText, data);
  }

  actuallyPlayAudio(audioObject, cleanText, data) {
    if (!this.head || !this.isLoaded) {
      console.warn('Head or avatar not ready for speech');
      return;
    }

    // Use ACTUAL audio duration from decoded buffer (most accurate)
    // This ensures fallback timers match the real audio length
    const actualAudioDuration =
      audioObject.actualDuration ||
      audioObject.audio?.duration ||
      data.duration ||
      0;
    if (
      actualAudioDuration &&
      data.duration &&
      Math.abs(actualAudioDuration - data.duration) > 0.1
    ) {
      data.duration = actualAudioDuration; // Update for fallback timers
    }

    // Mark as speaking
    this.isSpeaking = true;

    // Hide knowledge base thinking bubble immediately when TTS starts
    if (this.uiManager) {
      this.uiManager.hideKnowledgeBaseThinkingImmediate();
    }

    // Trigger talking animation when speech starts
    if (this.animationManager) {
      this.animationManager.onSpeechStart();
    }

    // Stop voice recognition when TTS starts (prevent input from capturing avatar speech)
    if (
      window.speechRecognitionManager &&
      window.speechRecognitionManager.isRecording
    ) {
      window.speechRecognitionManager.stopVoiceRecognition();
    }

    // Show speech bubble with timing data
    if (this.speechBubbleManager) {
      const lipSync = data.lipSync || {};
      if (lipSync.wordTimes && lipSync.words) {
        this.speechBubbleManager.showChunkedSpeechBubble(
          cleanText,
          lipSync.wordTimes,
          lipSync.words
        );
      } else {
        this.speechBubbleManager.showSpeechBubble(cleanText);
      }
    }

    if (!data.streaming) {
      console.warn(
        '⚠️ Streaming is disabled - audio will wait for full buffer'
      );
    }

    // Record start time for monitoring
    const speechStartTime = Date.now();

    // Primary method: Use TalkingHead's onComplete callback (most reliable)
    // For audio-driven lip sync, TalkingHead will analyze the audio automatically
    const speakOptions = {
      lipsyncLang: 'en',
      onComplete: () => {
        // Mark as not speaking
        this.isSpeaking = false;
        this.currentAudioSource = null;

        // Clean up our monitoring timers
        if (this.cleanupCurrentTimers) {
          this.cleanupCurrentTimers();
        }

        // Restart voice recognition after TTS ends (if it was enabled)
        if (
          window.speechRecognitionManager &&
          window.speechRecognitionManager.isSupported &&
          !window.speechRecognitionManager.isRecording
        ) {
          setTimeout(() => {
            window.speechRecognitionManager.startVoiceRecognition();
          }, 500); // Small delay to ensure TTS is fully stopped
        }

        // Trigger animation when speech ends
        if (this.animationManager) {
          this.animationManager.onSpeechEnd();
        }

        // Clear any existing timeout and hide bubble immediately when speech actually ends
        if (this.speechBubbleManager) {
          this.speechBubbleManager.clearAllTimers();
          this.speechBubbleManager.hideSpeechBubble();
        }
      },
      onError: (error) => {
        console.error('🎤 Speech error:', error);

        // Mark as not speaking
        this.isSpeaking = false;
        this.currentAudioSource = null;

        // Clean up our monitoring timers
        if (this.cleanupCurrentTimers) {
          this.cleanupCurrentTimers();
        }

        // Restart voice recognition after TTS error (if it was enabled)
        if (
          window.speechRecognitionManager &&
          window.speechRecognitionManager.isSupported &&
          !window.speechRecognitionManager.isRecording
        ) {
          setTimeout(() => {
            window.speechRecognitionManager.startVoiceRecognition();
          }, 500);
        }

        // Trigger animation end on error too
        if (this.animationManager) {
          this.animationManager.onSpeechEnd();
        }

        // Hide bubble on speech error too
        if (this.speechBubbleManager) {
          this.speechBubbleManager.clearAllTimers();
          this.speechBubbleManager.hideSpeechBubble();
        }
      },
    };

    // CRITICAL: Verify AudioContext state before calling speakAudio
    if (this.audioContext && this.audioContext.state === 'suspended') {
      console.error(
        '❌ CRITICAL: AudioContext is suspended - audio will not play!'
      );
      this.audioContext
        .resume()
        .then(() => {
          this.head.speakAudio(audioObject, speakOptions);
        })
        .catch((error) => {
          console.error('❌ Failed to resume AudioContext:', error);
          // Still try to play - might work in some browsers
          try {
            this.head.speakAudio(audioObject, speakOptions);
          } catch (playError) {
            console.error('❌ speakAudio failed:', playError);
            // Trigger error callback
            if (speakOptions.onError) {
              speakOptions.onError(playError);
            }
          }
        });
    } else {
      // AudioContext is running, proceed normally
      try {
        this.head.speakAudio(audioObject, speakOptions);
      } catch (error) {
        console.error('❌ speakAudio threw error:', error);
        if (speakOptions.onError) {
          speakOptions.onError(error);
        }
      }
    }

    // Setup fallback timers with improved monitoring
    this.setupFallbackTimers(data.duration, speechStartTime);
  }

  // =====================================================
  // FALLBACK TIMER MANAGEMENT
  // =====================================================
  setupFallbackTimers(duration, speechStartTime) {
    const speechDuration = duration * 1000; // Convert to milliseconds

    // Fallback method: Timeout based on estimated duration (in case onComplete fails)
    const fallbackTimeout = setTimeout(() => {
      // Mark as not speaking
      this.isSpeaking = false;
      this.currentAudioSource = null;

      // Restart voice recognition after TTS ends (if it was enabled)
      if (
        window.speechRecognitionManager &&
        window.speechRecognitionManager.isSupported &&
        !window.speechRecognitionManager.isRecording
      ) {
        setTimeout(() => {
          window.speechRecognitionManager.startVoiceRecognition();
        }, 500);
      }

      if (this.speechBubbleManager) {
        this.speechBubbleManager.clearAllTimers();
        this.speechBubbleManager.hideSpeechBubble();
      }
    }, speechDuration + 1000); // Add 1 second buffer for safety

    // Enhanced monitoring method with better timing checks
    const startTime = speechStartTime;
    let monitoringActive = true;

    const monitorInterval = setInterval(() => {
      if (!monitoringActive) {
        clearInterval(monitorInterval);
        return;
      }

      const elapsed = Date.now() - startTime;

      // Check if we've exceeded expected duration significantly
      if (elapsed > speechDuration + 3000) {
        console.warn(
          `⚠️ Speech duration exceeded expectation by ${
            elapsed - speechDuration
          }ms`
        );
        clearInterval(monitorInterval);
        clearTimeout(fallbackTimeout);
        monitoringActive = false;

        if (this.speechBubbleManager) {
          this.speechBubbleManager.clearAllTimers();
          this.speechBubbleManager.hideSpeechBubble();
        }
      }
    }, 1000); // Check every second

    // Store references for cleanup
    this.currentFallbackTimeout = fallbackTimeout;
    this.currentMonitorInterval = monitorInterval;

    // Cleanup function to be called when speech actually completes
    this.cleanupCurrentTimers = () => {
      monitoringActive = false;
      if (this.currentFallbackTimeout) {
        clearTimeout(this.currentFallbackTimeout);
        this.currentFallbackTimeout = null;
      }
      if (this.currentMonitorInterval) {
        clearInterval(this.currentMonitorInterval);
        this.currentMonitorInterval = null;
      }
    };
  }

  // =====================================================
  // SPEECH INTERRUPTION
  // =====================================================
  interruptSpeech() {
    if (!this.isSpeaking) {
      return false;
    }

    // Stop TalkingHead speech if possible
    if (this.head && this.head.stopSpeaking) {
      this.head.stopSpeaking();
    }

    // Stop current audio source if playing
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
      } catch (error) {
        console.warn('⚠️ Could not stop audio source:', error);
      }
      this.currentAudioSource = null;
    }

    // Clean up timers
    if (this.cleanupCurrentTimers) {
      this.cleanupCurrentTimers();
    }

    // Clear speech bubble immediately
    if (this.speechBubbleManager) {
      this.speechBubbleManager.clearAllTimers();
      this.speechBubbleManager.hideSpeechBubble();
    }

    // Trigger animation end
    if (this.animationManager) {
      this.animationManager.onSpeechEnd();
    }

    // Reset speaking state
    this.isSpeaking = false;

    return true;
  }

  // =====================================================
  // MAIN SPEAK TEXT FUNCTION
  // =====================================================
  async speakText(text) {
    if (!this.head || !this.isLoaded) {
      console.warn('Avatar not ready for speech');
      return false;
    }

    // Clean text for TTS
    const cleanText = this.cleanTextForTTS(text);

    // Don't speak if only emojis or thinking tags were in the text
    if (!cleanText || cleanText.length === 0) {
      console.warn('⚠️ No clean text to speak after cleaning:', {
        originalLength: text?.length || 0,
        originalPreview: text?.substring(0, 100) || 'N/A',
        cleanedLength: cleanText?.length || 0,
        cleanedPreview: cleanText || 'N/A',
      });
      return false;
    }

    try {
      const ttsStartTime = Date.now();

      // CRITICAL: Initialize and resume AudioContext BEFORE API call
      if (!this.audioContext) {
        this.audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }

      // CRITICAL: Resume AudioContext on user interaction (required by browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
        } catch (error) {
          console.error('❌ CRITICAL: Failed to resume audio context:', error);
          // Try to create a new context
          try {
            this.audioContext.close();
          } catch (closeError) {
            // Ignore close errors
          }
          this.audioContext = new (
            window.AudioContext || window.webkitAudioContext
          )();
        }
      }

      // Call TTS API
      const data = await this.callTTSAPI(cleanText);

      if (data.success) {
        // CRITICAL: Double-check AudioContext state before creating audio object
        if (this.audioContext.state === 'suspended') {
          console.warn('⚠️ AudioContext suspended after API call, resuming...');
          try {
            await this.audioContext.resume();
          } catch (error) {
            console.error(
              '❌ Failed to resume audio context after API call:',
              error
            );
          }
        }

        // OPTIMIZATION: Create audio object and start playback ASAP
        const audioObject = await this.createAudioObject(data);

        // Verify audio object is valid
        if (!audioObject || !audioObject.audio) {
          console.error('❌ Invalid audio object - cannot play');
          throw new Error('Invalid audio object');
        }

        // Play speech with lip-sync
        this.playSpeechWithLipSync(audioObject, cleanText, data);

        return true;
      } else {
        console.error('TTS API call failed:', data.error);
        return false;
      }
    } catch (error) {
      console.error('Speech error:', error);
      if (this.speechBubbleManager) {
        this.speechBubbleManager.hideSpeechBubble(); // Hide bubble on error
      }
      return false;
    }
  }

  // =====================================================
  // UTILITY FUNCTIONS
  // =====================================================
  // Note: base64ToAudioBuffer is already defined above in AUDIO PROCESSING section

  // =====================================================
  // STATUS AND GETTERS
  // =====================================================
  getIsInitialized() {
    return this.isInitialized;
  }

  getAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }
    return this.audioContext;
  }

  // Pre-warm AudioContext (will be suspended until user interaction)
  preWarmAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();
    }
    return this.audioContext;
  }

  // =====================================================
  // CONFIGURATION
  // =====================================================
  setVoice(voiceId) {
    if (this.configManager) {
      this.configManager.setVoiceId(voiceId);
    }
  }

  getVoice() {
    return this.configManager ? this.configManager.getVoiceId() : null;
  }

  // =====================================================
  // CLEANUP
  // =====================================================
  cleanup() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isInitialized = false;
  }
}
