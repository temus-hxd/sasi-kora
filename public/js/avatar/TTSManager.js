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
    // Remove thinking tags <t>...</t> - these are for audit/debugging only, not for TTS
    // Remove emojis from text before sending to TTS (comprehensive emoji removal)
    const cleanText = text
      // Remove thinking tags <t>...</t> (including multiline content)
      .replace(/<t>[\s\S]*?<\/t>/gi, '') // Remove <t>...</t> tags and their content
      // Remove all emoji ranges
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

    return cleanText;
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
        speed: 0.5, // Much slower for Ah Meng (76-year-old) - was 0.75, now 0.5 for elderly character
        style: 0.0, // Less energetic (0.0 = calm, 1.0 = very energetic)
      };

      try {
        console.log(
          `🎤 Calling ElevenLabs TTS API (streaming) for "${cleanText.substring(0, 50)}..."`
        );
        const apiStartTime = Date.now();

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        // OPTIMIZATION: Start processing as soon as we get response headers
        const firstByteTime = Date.now() - apiStartTime;
        console.log(`⚡ First byte received in ${firstByteTime}ms`);

        const data = await response.json();
        const totalApiTime = Date.now() - apiStartTime;
        console.log(`⚡ Full API response received in ${totalApiTime}ms`);

        if (!data.success) {
          throw new Error(data.error || 'ElevenLabs TTS API call failed');
        }

        // Mark as streaming if server indicates it
        data.streaming = requestBody.stream || false;
        console.log(
          `🎵 ElevenLabs Response: ${data.streaming ? 'STREAMING' : 'standard'}, ${data.duration}s duration`
        );
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
        console.log(
          `🎤 Calling Polly TTS API: ${endpoint} for "${cleanText.substring(0, 50)}..."`
        );

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
          console.log(
            `🎵 TTS Response: ${timingType} timing, ${syncInfo} lip sync, ${data.duration}s duration`
          );
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
    // CRITICAL: Must resume after user interaction (click, keypress, etc.)
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('⚡ Audio context resumed');
      } catch (error) {
        console.warn('⚠️ Failed to resume audio context:', error);
        // Try again on next user interaction
      }
    }

    let audioBuffer = await this.base64ToAudioBuffer(data.audio);
    const decodeTime = Date.now() - decodeStartTime;
    console.log(`⚡ Audio decoded in ${decodeTime}ms`);

    // Boost volume for better audibility (2x gain = +6dB)
    const boostStartTime = Date.now();
    audioBuffer = this.boostAudioVolume(audioBuffer, 2.0);
    const boostTime = Date.now() - boostStartTime;
    console.log(`⚡ Audio boosted in ${boostTime}ms (2x gain = +6dB)`);

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
      const uniqueVisemes = [...new Set(data.lipSync.visemes)];
      console.log(
        '🎤 Using server-generated phonetic visemes (better control, smoother lip sync)'
      );
      console.log(
        `💋 Viseme variety: ${uniqueVisemes.length} unique visemes [${uniqueVisemes.join(', ')}]`
      );
      console.log(
        `💋 Total visemes: ${data.lipSync.visemes.length}, First 5: [${data.lipSync.visemes.slice(0, 5).join(', ')}]`
      );

      // CRITICAL FIX: Rescale visemes to match ACTUAL audio duration
      // Server duration estimate may be inaccurate, causing visemes to finish too early
      const durationScaleFactor = actualAudioDuration / serverEstimatedDuration;

      if (Math.abs(durationScaleFactor - 1.0) > 0.05) {
        // Only scale if difference > 5%
        console.log(`⏱️ Duration mismatch detected! Rescaling visemes:`);
        console.log(
          `   Server estimate: ${serverEstimatedDuration.toFixed(3)}s`
        );
        console.log(`   Actual duration: ${actualAudioDuration.toFixed(3)}s`);
        console.log(`   Scale factor: ${durationScaleFactor.toFixed(3)}x`);

        // Scale all viseme timings to match actual audio duration
        const scaledVtimes = data.lipSync.visemeTimes.map(
          (t) => t * durationScaleFactor
        );
        const scaledVdurations = data.lipSync.visemeDurations.map(
          (d) => d * durationScaleFactor
        );
        const scaledWtimes = data.lipSync.wordTimes.map(
          (t) => t * durationScaleFactor
        );
        const scaledWdurations = data.lipSync.wordDurations.map(
          (d) => d * durationScaleFactor
        );

        return {
          audio: audioBuffer,
          words: data.lipSync.words || [],
          wtimes: scaledWtimes,
          wdurations: scaledWdurations,
          visemes: data.lipSync.visemes,
          vtimes: scaledVtimes,
          vdurations: scaledVdurations,
          actualDuration: actualAudioDuration, // Store for fallback timers
        };
      } else {
        console.log(
          `⏱️ Duration match: ${actualAudioDuration.toFixed(3)}s (server: ${serverEstimatedDuration.toFixed(3)}s)`
        );
      }

      // Use server-generated visemes for better control (no scaling needed)
      return {
        audio: audioBuffer,
        words: data.lipSync.words || [],
        wtimes: data.lipSync.wordTimes || [],
        wdurations: data.lipSync.wordDurations || [],
        visemes: data.lipSync.visemes,
        vtimes: data.lipSync.visemeTimes,
        vdurations: data.lipSync.visemeDurations,
        actualDuration: actualAudioDuration, // Store for fallback timers
      };
    } else if (isAudioDriven || !data.lipSync) {
      console.log(
        '🎤 Using audio-driven lip sync (TalkingHead will analyze audio)'
      );
      // Fallback: let TalkingHead analyze audio (less ideal)
      // Handle case where lipSync is missing or undefined
      const lipSync = data.lipSync || {};
      return {
        audio: audioBuffer,
        words: lipSync.words || [],
        wtimes: lipSync.wordTimes || [],
        wdurations: lipSync.wordDurations || [],
        // NO viseme properties - TalkingHead will generate from audio
      };
    } else {
      console.log('🎤 Using viseme-based lip sync (Polly data)');
      const lipSync = data.lipSync || {};
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
      console.log(
        `⏱️ Using actual audio duration: ${actualAudioDuration.toFixed(3)}s (was ${data.duration.toFixed(3)}s)`
      );
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

    // Show speech bubble with timing data
    if (this.speechBubbleManager) {
      this.speechBubbleManager.showChunkedSpeechBubble(
        cleanText,
        data.lipSync.wordTimes,
        data.lipSync.words
      );
    }

    // Enhanced speech data logging for debugging
    const speechInfo = {
      duration: data.duration,
      wordCount: data.lipSync.words.length,
      visemeCount: data.lipSync.visemes?.length || 0,
      hasOnComplete: typeof this.head.speakAudio === 'function',
      streaming: data.streaming || false, // Should be true if streaming enabled
      synchronized: data.lipSync.isSynchronized || false,
      timingType: data.streaming ? 'estimated' : 'precise',
      speedRate: data.lipSync.speedRate || 100,
      actualAudioDuration: data.duration,
      estimatedDuration: data.lipSync.estimatedDuration,
    };

    console.log('🎤 Speech playback starting:', speechInfo);
    if (!data.streaming) {
      console.warn(
        '⚠️ Streaming is disabled - audio will wait for full buffer'
      );
    }

    // Log lip sync timing details
    if (data.lipSync.wordTimes && data.lipSync.wordTimes.length > 0) {
      const firstWordTime = data.lipSync.wordTimes[0];
      const lastWordTime =
        data.lipSync.wordTimes[data.lipSync.wordTimes.length - 1];
      const lastWordDuration =
        data.lipSync.wordDurations[data.lipSync.wordDurations.length - 1] ||
        500;
      const totalLipSyncTime = lastWordTime + lastWordDuration;

      console.log('💋 Lip sync timing:', {
        firstWord: `"${data.lipSync.words[0]}" at ${firstWordTime}ms`,
        lastWord: `"${data.lipSync.words[data.lipSync.words.length - 1]}" at ${lastWordTime}ms`,
        totalLipSyncDuration: `${totalLipSyncTime}ms (${totalLipSyncTime / 1000}s)`,
        audioDuration: `${data.duration * 1000}ms (${data.duration}s)`,
        timingDiff: `${Math.abs(totalLipSyncTime - data.duration * 1000)}ms`,
      });
    }

    // Record start time for monitoring
    const speechStartTime = Date.now();

    // Debug: Log what we're sending to TalkingHead
    console.log('🎤 TalkingHead Input Debug:', {
      hasVisemes: !!audioObject.visemes,
      visemeCount: audioObject.visemes?.length || 0,
      hasVtimes: !!audioObject.vtimes,
      hasVdurations: !!audioObject.vdurations,
      first5Visemes: audioObject.visemes?.slice(0, 5) || 'N/A',
      first5Times: audioObject.vtimes?.slice(0, 5) || 'N/A',
      first5Durations: audioObject.vdurations?.slice(0, 5) || 'N/A',
      uniqueVisemes: audioObject.visemes
        ? [...new Set(audioObject.visemes)].slice(0, 10)
        : 'N/A',
      wordCount: audioObject.words?.length || 0,
      audioBufferLength: audioObject.audio?.length || 0,
    });

    // Primary method: Use TalkingHead's onComplete callback (most reliable)
    // For audio-driven lip sync, TalkingHead will analyze the audio automatically
    const speakOptions = {
      lipsyncLang: 'en',
      onComplete: () => {
        const actualDuration = Date.now() - speechStartTime;
        console.log(
          `🎤 Speech completed via onComplete callback after ${actualDuration}ms (expected: ${data.duration * 1000}ms)`
        );

        // Mark as not speaking
        this.isSpeaking = false;
        this.currentAudioSource = null;

        // Clean up our monitoring timers
        if (this.cleanupCurrentTimers) {
          this.cleanupCurrentTimers();
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

    this.head.speakAudio(audioObject, speakOptions);

    // Setup fallback timers with improved monitoring
    this.setupFallbackTimers(data.duration, speechStartTime);
  }

  // =====================================================
  // FALLBACK TIMER MANAGEMENT
  // =====================================================
  setupFallbackTimers(duration, speechStartTime) {
    const speechDuration = duration * 1000; // Convert to milliseconds

    // Fallback method: Timeout based on estimated duration (in case onComplete fails)
    console.log(`🎤 Setting timeout fallback for ${speechDuration + 1000}ms`);
    const fallbackTimeout = setTimeout(() => {
      const elapsed = Date.now() - speechStartTime;
      console.log(
        `🎤 Speech completed via timeout fallback after ${elapsed}ms (expected: ${speechDuration}ms)`
      );

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
      const progressPercent = ((elapsed / speechDuration) * 100).toFixed(1);

      // Log progress every 2 seconds or at key milestones
      if (elapsed % 2000 < 1000 || progressPercent >= 90) {
        console.log(
          `🎤 Speech monitor: ${elapsed}ms elapsed (${progressPercent}% of ${speechDuration}ms)`
        );
      }

      // Check if we've exceeded expected duration significantly
      if (elapsed > speechDuration + 3000) {
        console.warn(
          `⚠️ Speech duration exceeded expectation by ${elapsed - speechDuration}ms`
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
      console.log('🔇 No speech to interrupt');
      return false;
    }

    console.log('🛑 Interrupting current speech');

    // Stop TalkingHead speech if possible
    if (this.head && this.head.stopSpeaking) {
      this.head.stopSpeaking();
    }

    // Stop current audio source if playing
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        console.log('🔇 Audio source stopped');
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

    console.log('✅ Speech interrupted successfully');
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

    // Don't speak if only emojis were in the text
    if (!cleanText) {
      console.warn('No clean text to speak after emoji removal');
      return false;
    }

    try {
      // OPTIMIZATION: Track timing to identify bottlenecks
      const ttsStartTime = Date.now();
      console.log(`⚡ TTS request started at ${new Date().toISOString()}`);

      // OPTIMIZATION: Pre-warm audio context BEFORE API call (parallel to network request)
      if (!this.audioContext) {
        this.audioContext = new (
          window.AudioContext || window.webkitAudioContext
        )();
      }
      // CRITICAL: Resume AudioContext on user interaction (required by browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
          console.log('⚡ Audio context resumed for TTS');
        } catch (error) {
          console.warn('⚠️ Failed to resume audio context:', error);
          // Will retry on next user interaction
        }
      }

      // Call TTS API
      const data = await this.callTTSAPI(cleanText);
      const apiTime = Date.now() - ttsStartTime;
      console.log(`⚡ TTS API response received in ${apiTime}ms`);
      console.log(
        `⏱️ [TIMING] ElevenLabs API call took ${apiTime}ms (${(apiTime / 1000).toFixed(2)}s)`
      );

      if (data.success) {
        // OPTIMIZATION: Create audio object and start playback ASAP
        const audioObject = await this.createAudioObject(data);
        const totalTime = Date.now() - ttsStartTime;
        console.log(
          `⚡ Audio ready and starting playback in ${totalTime}ms total`
        );
        console.log(
          `⚡ Breakdown: API=${apiTime}ms, Processing=${totalTime - apiTime}ms`
        );
        console.log(
          `⏱️ [TIMING] TTS processing breakdown: API=${apiTime}ms, Audio decode=${totalTime - apiTime}ms`
        );

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
