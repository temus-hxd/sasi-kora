export class SpeechRecognitionManager {
  constructor() {
    this.isRecording = false;
    this.recognition = null;
    this.recordingTimeout = null;
    this.onResultCallback = null;
    this.isSupported = this.checkSupport();
  }

  // =====================================================
  // SETUP AND CONFIGURATION
  // =====================================================
  checkSupport() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  setOnResultCallback(callback) {
    this.onResultCallback = callback;
  }

  // =====================================================
  // SPEECH RECOGNITION INITIALIZATION
  // =====================================================
  initSpeechRecognition() {
    if (!this.isSupported) {
      console.warn('Speech recognition not supported in this browser');
      return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();
    
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = 'en-US';
    
    this.recognition.onstart = () => {
      console.log('🎤 Voice recognition started');
      this.updateMicButtonState(true);
    };
    
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
      
      // Call callback if provided, otherwise handle directly
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
      console.log('🎤 Voice recognition ended');
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
  startVoiceRecognition() {
    if (!this.recognition && !this.initSpeechRecognition()) {
      alert('Voice recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
      return false;
    }
    
    // Check if avatar is currently speaking - wait for speech to end instead of interrupting
    if (window.ttsManager && window.ttsManager.isSpeaking) {
      console.log('⏸️ Avatar is speaking - voice recognition will start after speech ends');
      // Wait for speech to end, then start
      const checkSpeaking = setInterval(() => {
        if (!window.ttsManager.isSpeaking) {
          clearInterval(checkSpeaking);
          console.log('✅ Avatar finished speaking, starting voice recognition');
          this.startVoiceRecognition();
        }
      }, 500);
      return false;
    }
    
    if (!this.isRecording) {
      try {
        this.recognition.start();
        this.isRecording = true;
        
        // Auto-stop after 10 seconds
        this.recordingTimeout = setTimeout(() => {
          this.stopVoiceRecognition();
        }, 10000);
        
        return true;
      } catch (error) {
        console.error('Error starting voice recognition:', error);
        this.stopVoiceRecognition();
        return false;
      }
    }
    return false;
  }

  stopVoiceRecognition() {
    if (this.recognition && this.isRecording) {
      this.recognition.stop();
    }
    this.isRecording = false;
    this.updateMicButtonState(false);
    
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }
  }

  toggleVoice() {
    // If avatar is speaking, don't allow toggling on (wait for speech to end)
    if (window.ttsManager && window.ttsManager.isSpeaking && !this.isRecording) {
      console.log('⏸️ Avatar is speaking - cannot start voice recognition. Wait for speech to end.');
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
      hasRecognition: this.recognition !== null
    };
  }

  // =====================================================
  // CLEANUP
  // =====================================================
  cleanup() {
    this.stopVoiceRecognition();
    if (this.recognition) {
      this.recognition = null;
    }
  }

  // =====================================================
  // CONFIGURATION
  // =====================================================
  setLanguage(language = 'en-US') {
    if (this.recognition) {
      this.recognition.lang = language;
    }
  }

  setTimeout(timeoutMs = 10000) {
    this.autoStopTimeout = timeoutMs;
  }
} 