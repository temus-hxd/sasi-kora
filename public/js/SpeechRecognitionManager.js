export class SpeechRecognitionManager {
  constructor() {
    this.isRecording = false;
    this.recognition = null; // Keep for compatibility, but will be Gladia session
    this.recordingTimeout = null;
    this.onResultCallback = null;
    this.isSupported = this.checkSupport();

    // Gladia-specific properties
    this.audioStream = null;
    this.mediaRecorder = null;
    this.gladiaWebSocket = null;
    this.gladiaSessionId = null;
    this.audioContext = null;
    this.processor = null;
    this.interimTranscript = '';
    this.finalTranscript = '';
    this.languages = ['en', 'zh']; // English, Chinese
    this.codeSwitching = true;
  }

  // =====================================================
  // SETUP AND CONFIGURATION
  // =====================================================
  checkSupport() {
    // Check for both browser SpeechRecognition (fallback) and MediaRecorder (for Gladia)
    const hasBrowserSTT =
      'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
    const hasMediaRecorder = 'MediaRecorder' in window;
    const hasGetUserMedia =
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

    // Prefer Gladia (MediaRecorder), fallback to browser STT
    return (hasMediaRecorder && hasGetUserMedia) || hasBrowserSTT;
  }

  setOnResultCallback(callback) {
    this.onResultCallback = callback;
  }

  // =====================================================
  // GLADIA INITIALIZATION
  // =====================================================
  async initGladiaSession() {
    try {
      // Get session from backend
      const response = await fetch('/api/gladia/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          languages: this.languages,
          codeSwitching: this.codeSwitching,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          '❌ [GLADIA] Session creation failed:',
          response.status,
          errorText
        );
        throw new Error(`Failed to create Gladia session: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        console.error('❌ [GLADIA] Session creation error:', data.error);
        throw new Error(data.error || 'Failed to create Gladia session');
      }

      this.gladiaSessionId = data.sessionId;
      const websocketUrl = data.websocketUrl;

      // Connect to Gladia WebSocket
      return new Promise((resolve, reject) => {
        this.gladiaWebSocket = new WebSocket(websocketUrl);

        this.gladiaWebSocket.onopen = () => {
          resolve(true);
        };

        this.gladiaWebSocket.onmessage = (event) => {
          this.handleGladiaMessage(event);
        };

        this.gladiaWebSocket.onerror = (error) => {
          console.error('❌ [GLADIA] WebSocket error:', error);
          reject(error);
        };

        this.gladiaWebSocket.onclose = (event) => {
          // Clear WebSocket reference so we create a new one next time
          this.gladiaWebSocket = null;
          this.gladiaSessionId = null;

          if (this.isRecording) {
            // Unexpected close - stop recording
            console.warn(
              '⚠️ [GLADIA] WebSocket closed unexpectedly during recording'
            );
            this.isRecording = false;
            this.updateMicButtonState(false);
          }
        };
      });
    } catch (error) {
      console.error('❌ Failed to initialize Gladia session:', error);
      throw error;
    }
  }

  handleGladiaMessage(event) {
    try {
      // Handle binary data (audio acknowledgments) - ignore
      if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
        return;
      }

      // Parse JSON message
      const message =
        typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

      // Extract transcript data based on message format
      let transcript = '';
      let isFinal = false;

      if (message.type === 'transcript' && message.data) {
        // Standard Gladia format
        transcript = message.data.utterance?.text || '';
        isFinal = message.data.is_final || false;
      } else if (message.type === 'transcription' || message.transcript) {
        // Alternative message format
        transcript = message.transcript || message.text || '';
        isFinal = message.is_final || message.final || false;
      } else {
        // Unknown message type - ignore
        return;
      }

      // Process transcript result
      if (isFinal) {
        this.finalTranscript = transcript;
        this.interimTranscript = '';
        this.processTranscript(this.finalTranscript, '');
      } else {
        this.interimTranscript = transcript;
        this.processTranscript('', this.interimTranscript);
      }
    } catch (error) {
      // Not JSON or parsing error - might be binary data, ignore
      if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
        return;
      }
    }
  }

  /**
   * Process transcript result (final or interim)
   * @private
   */
  processTranscript(finalTranscript, interimTranscript) {
    if (this.onResultCallback) {
      this.onResultCallback(finalTranscript, interimTranscript);
    } else {
      this.handleResult(finalTranscript, interimTranscript);
    }
  }

  async startAudioCapture() {
    try {
      // Get microphone access
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create AudioContext for processing
      this.audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )({
        sampleRate: 16000,
      });

      const source = this.audioContext.createMediaStreamSource(
        this.audioStream
      );

      // Create ScriptProcessorNode to capture audio chunks
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      let audioChunkCount = 0;
      this.processor.onaudioprocess = (event) => {
        if (
          this.isRecording &&
          this.gladiaWebSocket &&
          this.gladiaWebSocket.readyState === WebSocket.OPEN
        ) {
          const audioData = event.inputBuffer.getChannelData(0);

          // Convert Float32Array to Int16Array (PCM format)
          const int16Array = new Int16Array(audioData.length);
          for (let i = 0; i < audioData.length; i++) {
            // Clamp and convert to 16-bit integer (multiply by 32767 for full range)
            const s = Math.max(-1, Math.min(1, audioData[i]));
            int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          // Send audio chunk to Gladia as binary data
          // WebSocket.send() accepts ArrayBuffer, which int16Array.buffer provides
          if (this.gladiaWebSocket.readyState === WebSocket.OPEN) {
            this.gladiaWebSocket.send(int16Array.buffer);
          } else {
            console.warn(
              '⚠️ [GLADIA] WebSocket not open, cannot send audio chunk'
            );
          }
        }
      };

      source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      return true;
    } catch (error) {
      console.error('❌ Failed to start audio capture:', error);
      throw error;
    }
  }

  stopAudioCapture(closeWebSocket = false) {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }

    // Only close WebSocket if explicitly requested (e.g., on cleanup)
    // Keep it open for continuous recognition sessions
    if (closeWebSocket && this.gladiaWebSocket) {
      this.gladiaWebSocket.close();
      this.gladiaWebSocket = null;
      this.gladiaSessionId = null;
    }
  }

  // =====================================================
  // SPEECH RECOGNITION INITIALIZATION (Gladia)
  // =====================================================
  async initSpeechRecognition() {
    if (!this.isSupported) {
      console.warn('Speech recognition not supported in this browser');
      this.updateMicButtonState(false);
      return false;
    }

    // Try Gladia first, fallback to browser STT
    const hasMediaRecorder = 'MediaRecorder' in window;
    const hasGetUserMedia =
      navigator.mediaDevices && navigator.mediaDevices.getUserMedia;

    if (hasMediaRecorder && hasGetUserMedia) {
      // Use Gladia
      try {
        await this.initGladiaSession();
        this.recognition = { type: 'gladia' }; // Mark as Gladia session
        this.updateMicButtonState(false);
        return true;
      } catch (error) {
        console.warn(
          '⚠️ Gladia initialization failed, falling back to browser STT:',
          error
        );
        // Fall through to browser STT fallback
      }
    }

    // Fallback to browser SpeechRecognition
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('❌ No speech recognition available');
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.updateMicButtonState(true);
    };

    this.updateMicButtonState(false);

    this.recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (this.onResultCallback) {
        this.onResultCallback(finalTranscript, interimTranscript);
      } else {
        this.handleResult(finalTranscript, interimTranscript);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('🎤 Voice recognition error:', event.error);
      this.stopVoiceRecognition();
    };

    this.recognition.onend = () => {
      this.stopVoiceRecognition();
    };

    return true;
  }

  // =====================================================
  // DEFAULT RESULT HANDLER
  // =====================================================
  handleResult(finalTranscript, interimTranscript) {
    // Update input field with current transcript
    const messageInput = document.getElementById('messageInput');
    if (finalTranscript) {
      messageInput.value = finalTranscript.trim();
      this.stopVoiceRecognition();
      // Auto-send after a short delay
      setTimeout(() => {
        if (messageInput.value.trim()) {
          // Trigger send message event
          if (window.sendMessage) {
            window.sendMessage();
          }
        }
      }, 500);
    } else if (interimTranscript) {
      messageInput.value = interimTranscript.trim();
    }
  }

  // =====================================================
  // VOICE RECOGNITION CONTROLS
  // =====================================================
  async startVoiceRecognition() {
    // Check if avatar is currently speaking - wait for speech to end instead of interrupting
    if (window.ttsManager && window.ttsManager.isSpeaking) {
      // Wait for speech to end, then start
      const checkSpeaking = setInterval(() => {
        if (!window.ttsManager.isSpeaking) {
          clearInterval(checkSpeaking);
          this.startVoiceRecognition();
        }
      }, 500);
      return false;
    }

    if (this.isRecording) {
      return false;
    }

    // Check if we have an open Gladia WebSocket connection
    if (
      this.recognition &&
      this.recognition.type === 'gladia' &&
      this.gladiaWebSocket
    ) {
      const wsState = this.gladiaWebSocket.readyState;

      // If WebSocket is closed, we need to create a new session
      if (wsState === WebSocket.CLOSED || wsState === WebSocket.CLOSING) {
        this.gladiaWebSocket = null;
        this.gladiaSessionId = null;
        this.recognition = null; // Force re-initialization
      }
    }

    // Initialize if needed
    if (!this.recognition) {
      const initialized = await this.initSpeechRecognition();
      if (!initialized) {
        alert(
          'Voice recognition is not supported in your browser. Please use Chrome, Edge, or Safari.'
        );
        return false;
      }
    }

    try {
      // Check if using Gladia or browser STT
      if (this.recognition && this.recognition.type === 'gladia') {
        // Check if WebSocket is still open
        if (
          !this.gladiaWebSocket ||
          this.gladiaWebSocket.readyState !== WebSocket.OPEN
        ) {
          // WebSocket is not open, need to create new session
          await this.initGladiaSession();
        }

        // Start audio capture (will reuse existing WebSocket if open)
        await this.startAudioCapture();
        this.isRecording = true;
        this.updateMicButtonState(true);
      } else {
        // Browser STT fallback
        this.recognition.start();
        this.isRecording = true;
        this.updateMicButtonState(true);
      }

      // Auto-stop after 10 seconds
      this.recordingTimeout = setTimeout(() => {
        this.stopVoiceRecognition();
      }, 10000);

      return true;
    } catch (error) {
      console.error('❌ [GLADIA] Error starting voice recognition:', error);
      this.stopVoiceRecognition();
      return false;
    }
  }

  stopVoiceRecognition(closeWebSocket = false) {
    if (this.isRecording) {
      // Check if using Gladia or browser STT
      if (this.recognition && this.recognition.type === 'gladia') {
        // Gladia path - stop audio capture but keep WebSocket open for reuse
        this.stopAudioCapture(closeWebSocket);
      } else if (
        this.recognition &&
        typeof this.recognition.stop === 'function'
      ) {
        // Browser STT fallback
        this.recognition.stop();
      }
    }

    this.isRecording = false;
    this.updateMicButtonState(false);
    this.interimTranscript = '';
    this.finalTranscript = '';

    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }
  }

  toggleVoice() {
    // If avatar is speaking, don't allow toggling on (wait for speech to end)
    if (
      window.ttsManager &&
      window.ttsManager.isSpeaking &&
      !this.isRecording
    ) {
      return;
    }

    if (this.isRecording) {
      this.stopVoiceRecognition();
    } else {
      this.startVoiceRecognition();
    }
  }

  // =====================================================
  // UI UPDATES
  // =====================================================
  updateMicButtonState(recording) {
    const micBtn = document.getElementById('micBtn');
    const micIcon = micBtn.querySelector('svg');

    if (!micBtn || !micIcon) return;

    if (recording) {
      micBtn.classList.add('recording');
      micBtn.title = 'Stop voice input';
      // Change to stop icon
      micIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" rx="2"/>';
    } else {
      micBtn.classList.remove('recording');
      micBtn.title = 'Voice input';
      // Change back to microphone icon
      micIcon.innerHTML = `
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      `;
    }
  }

  // =====================================================
  // GETTERS AND STATUS
  // =====================================================
  getIsRecording() {
    return this.isRecording;
  }

  getIsSupported() {
    return this.isSupported;
  }

  getRecognitionState() {
    return {
      isRecording: this.isRecording,
      isSupported: this.isSupported,
      hasRecognition: this.recognition !== null,
      provider: this.recognition?.type === 'gladia' ? 'gladia' : 'browser',
      languages: this.languages,
      codeSwitching: this.codeSwitching,
    };
  }

  // =====================================================
  // CLEANUP
  // =====================================================
  cleanup() {
    // Close WebSocket on cleanup
    this.stopVoiceRecognition(true);
    if (this.recognition) {
      this.recognition = null;
    }
  }

  // =====================================================
  // CONFIGURATION
  // =====================================================
  setLanguage(language = 'en-US') {
    // For Gladia, convert language code format
    if (language.startsWith('en')) {
      this.languages = ['en', 'zh'];
    } else if (language.startsWith('zh')) {
      this.languages = ['zh', 'en'];
    } else {
      this.languages = [language.split('-')[0], 'en'];
    }

    // Browser STT fallback
    if (this.recognition && typeof this.recognition.lang !== 'undefined') {
      this.recognition.lang = language;
    }
  }

  // Set languages for multilingual support (Gladia)
  setLanguages(languages = ['en', 'zh']) {
    this.languages = languages;
  }

  // Enable/disable code-switching (Gladia)
  setCodeSwitching(enabled = true) {
    this.codeSwitching = enabled;
  }

  setTimeout(timeoutMs = 10000) {
    this.autoStopTimeout = timeoutMs;
  }
}
