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
  async loadConfig(language = null) {
    try {
      // Get language from parameter or localStorage
      const lang = language || this.getLanguage() || 'en';

      console.log(
        `📡 Loading configuration from /api/config (language: ${lang})...`
      );
      const response = await fetch(`/api/config?lang=${lang}`);

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
      this.config.language = serverConfig.language || lang;
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
  // LANGUAGE MANAGEMENT
  // =====================================================
  getLanguage() {
    return localStorage.getItem('app_language') || 'en';
  }

  setLanguage(language) {
    localStorage.setItem('app_language', language);
    this.config.language = language;
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
    const currentLanguage = this.getLanguage();
    this.config = {
      avatarUrl: null, // Will be loaded from server (.env)
      voiceId: null, // Will be loaded from server (.env)
      ttsProvider: 'elevenlabs',
      language: currentLanguage,
    };
    this.loadConfig(currentLanguage); // Reload from server with current language
  }
}
