export class ConfigManager {
  constructor() {
    // Default configuration - will be loaded from server (.env) via loadConfig()
    // No hardcoded values - all must come from .env
    this.config = {
      avatarUrl: null, // Must be loaded from server (.env)
      voiceId: null, // Must be loaded from server (.env)
      ttsProvider: 'elevenlabs', // 'polly' or 'elevenlabs'
    };
    this.uiManager = null; // Will be set if UIManager is available
  }

  setUIManager(uiManager) {
    this.uiManager = uiManager;
  }

  // =====================================================
  // CONFIGURATION LOADING
  // =====================================================
  async loadConfig() {
    try {
      console.log('📡 Loading configuration from /api/config...');
      const response = await fetch('/api/config');

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Config API error (${response.status}):`, errorText);
        throw new Error(
          `Config API returned ${response.status}: ${errorText.substring(0, 100)}`
        );
      }

      const serverConfig = await response.json();

      if (!serverConfig.avatarUrl || !serverConfig.voiceId) {
        console.error('❌ Config missing required fields:', serverConfig);
        throw new Error('Configuration missing avatarUrl or voiceId');
      }

      this.config.avatarUrl = serverConfig.avatarUrl;
      this.config.voiceId = serverConfig.voiceId;
      console.log('✅ Configuration loaded:', {
        avatarUrl: this.config.avatarUrl?.substring(0, 50) + '...',
        voiceId: this.config.voiceId,
      });
      return true;
    } catch (error) {
      console.error('❌ Failed to load config from server:', error);
      console.error('   Error details:', error.message);
      if (this.uiManager) {
        this.uiManager.updateLoadingScreen(
          0,
          `Config Error: ${error.message.substring(0, 50)}`
        );
      }
      return false;
    }
  }

  // =====================================================
  // GETTERS
  // =====================================================
  getConfig() {
    return { ...this.config }; // Return a copy to prevent direct mutations
  }

  getAvatarUrl() {
    return this.config.avatarUrl;
  }

  getVoiceId() {
    return this.config.voiceId;
  }

  getTTSProvider() {
    return this.config.ttsProvider || 'elevenlabs';
  }

  // =====================================================
  // SETTERS
  // =====================================================
  setAvatarUrl(url) {
    this.config.avatarUrl = url;
  }

  setVoiceId(voiceId) {
    this.config.voiceId = voiceId;
  }

  setTTSProvider(provider) {
    if (provider === 'polly' || provider === 'elevenlabs') {
      this.config.ttsProvider = provider;
      console.log(`🎤 TTS Provider switched to: ${provider}`);
    } else {
      console.warn(`⚠️ Invalid TTS provider: ${provider}`);
    }
  }

  setConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  // =====================================================
  // VALIDATION
  // =====================================================
  isValidConfig() {
    return (
      this.config.avatarUrl &&
      typeof this.config.avatarUrl === 'string' &&
      this.config.voiceId &&
      typeof this.config.voiceId === 'string'
    );
  }

  // =====================================================
  // RESET TO DEFAULTS
  // =====================================================
  resetToDefaults() {
    // Reset and reload from server (.env) - no hardcoded values
    this.config = {
      avatarUrl: null, // Will be loaded from server (.env)
      voiceId: null, // Will be loaded from server (.env)
      ttsProvider: 'elevenlabs',
    };
    console.log('🔄 Configuration reset - reloading from server...');
    this.loadConfig(); // Reload from server
  }
}
