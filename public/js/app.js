// Import modules
import { EmojiManager } from './EmojiManager.js';
import { VoiceStateManager } from './VoiceStateManager.js';
import { ConfigManager } from './ConfigManager.js';
import { UIManager } from './UIManager.js';
import { SpeechBubbleManager } from './SpeechBubbleManager.js';
import { SpeechRecognitionManager } from './SpeechRecognitionManager.js';
import { TTSManager } from './TTSManager.js';
import { WebSocketManager } from './WebSocketManager.js';
import { ChatManager } from './ChatManager.js';
import { AvatarManager } from './AvatarManager.js';

// =====================================================
// GLOBAL VARIABLES
// =====================================================
// Avatar variables moved to AvatarManager

// Manager instances
let emojiManager = null;
let voiceStateManager = null;
let configManager = null;
let uiManager = null;
let speechBubbleManager = null;
let speechRecognitionManager = null;
let ttsManager = null;
let webSocketManager = null;

// ================================
// CONFETTI APPRECIATION SYSTEM
// ================================
let confettiManager = null;
let chatManager = null;
let avatarManager = null;

// =====================================================
// PHASE 4: VOICE CONTROL VARIABLES
// =====================================================

// Configuration manager (moved to separate file)

// =====================================================
// IDLE TIMER MANAGER (moved to separate file)
// =====================================================

// =====================================================
// EMOJI MANAGER INITIALIZATION (moved to separate file)
// =====================================================

// =====================================================
// WEBSOCKET FUNCTIONS (moved to WebSocketManager)
// =====================================================

// handleClaudeResponse moved to ChatManager

// =====================================================
// INITIALIZATION FUNCTIONS (moved to AvatarManager)
// =====================================================
async function initializeApp() {
  // Initialize all managers first
  uiManager = new UIManager();
  speechBubbleManager = new SpeechBubbleManager();
  speechRecognitionManager = new SpeechRecognitionManager();
  ttsManager = new TTSManager();
  configManager = new ConfigManager();
  configManager.setUIManager(uiManager); // Allow ConfigManager to update UI on errors
  voiceStateManager = new VoiceStateManager();
  emojiManager = new EmojiManager();
  webSocketManager = new WebSocketManager();
  chatManager = new ChatManager();

  // ================================
  // BROWSER MEMORY SYSTEM
  // ================================
  if (typeof BrowserMemory !== 'undefined') {
    BrowserMemory.init();
    window.BrowserMemory = BrowserMemory; // Make globally accessible
    console.log(
      '🧠 BrowserMemory initialized - Persistent conversation memory ready!'
    );
  } else {
    console.warn('⚠️ BrowserMemory module not loaded');
  }

  // ================================
  // CONFETTI APPRECIATION SYSTEM
  // ================================
  if (window.CONFETTI_ENABLED && window.ConfettiManager) {
    confettiManager = new window.ConfettiManager();
    window.confettiManager = confettiManager; // Make globally accessible
  } else {
    console.log('🎊 ConfettiManager disabled or not loaded');
  }

  // Initialize AnimationManager (loaded as global script)
  let animationManager = null;
  if (window.AnimationManager) {
    animationManager = new window.AnimationManager();
  } else {
    console.warn('⚠️ AnimationManager not available on window');
  }

  // Initialize AvatarManager with all dependencies
  avatarManager = new AvatarManager();
  avatarManager.setDependencies({
    configManager,
    uiManager,
    voiceStateManager,
    emojiManager,
    speechBubbleManager,
    speechRecognitionManager,
    ttsManager,
    webSocketManager,
    chatManager,
    animationManager, // Pass AnimationManager to AvatarManager
  });

  // Initialize the avatar (this will initialize all other managers too)
  // Start avatar loading countdown immediately
  avatarManager.startAvatarLoadingCountdown();

  // Initialize avatar (will hide loading screen when ready)
  await avatarManager.initAvatar();

  // Make managers available globally for interruption after initialization
  window.ttsManager = ttsManager;
  window.chatManager = chatManager;
  window.configManager = configManager;
  window.speechRecognitionManager = speechRecognitionManager;
  window.speechBubbleManager = speechBubbleManager;

  // Voice recognition is OFF by default - user must press mic button to enable
  // This prevents the mic from interrupting the avatar's speech
  console.log('🎤 Voice recognition available - press mic button to enable');

  // Add global keyboard interruption
  document.addEventListener('keydown', (event) => {
    // Only interrupt on typing keys, not special keys
    if (
      ttsManager &&
      ttsManager.isSpeaking &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      event.key.length === 1
    ) {
      // Single character keys only
      console.log('⌨️ Keyboard interrupt detected');
      ttsManager.interruptSpeech();
    }
  });
}

// =====================================================
// CHAT FUNCTIONS (moved to ChatManager)
// =====================================================

// Loading management (moved to UIManager)

// =====================================================
// SPEECH BUBBLE FUNCTIONS (moved to SpeechBubbleManager)
// =====================================================

// Speech bubble functions moved to SpeechBubbleManager

// All speech bubble functions moved to SpeechBubbleManager

// =====================================================
// STATUS AND UI FUNCTIONS (moved to UIManager)
// =====================================================

// =====================================================
// UTILITY FUNCTIONS (chat functions moved to ChatManager)
// =====================================================

// =====================================================
// TEXT-TO-SPEECH FUNCTIONS (moved to TTSManager)
// =====================================================

// =====================================================
// VOICE STATE MANAGER (moved to separate file)
// =====================================================

// =====================================================
// AVATAR CONTROL FUNCTIONS (moved to AvatarManager)
// =====================================================

// =====================================================
// VOICE RECOGNITION FUNCTIONS (moved to SpeechRecognitionManager)
// =====================================================

// =====================================================
// BOOK COVER MANAGER (moved to separate file)
// =====================================================

// =====================================================
// GLOBAL EXPORTS AND INITIALIZATION
// =====================================================

// Make functions available globally
window.sendMessage = () => chatManager?.sendMessage();
window.handleKeyPress = (event) => chatManager?.handleKeyPress(event);
window.clearChat = () => chatManager?.clearChat();
window.reloadPrompt = () => chatManager?.reloadPrompt();
window.toggleAutoSpeak = () => chatManager?.toggleAutoSpeak();
window.toggleVoice = () => speechRecognitionManager?.toggleVoice();
window.triggerExpression = (emoji) => avatarManager?.triggerExpression(emoji);
window.changeView = (view) => avatarManager?.changeView(view);
window.resetAvatar = () => avatarManager?.resetAvatar();
window.resetVoiceSettings = () => voiceStateManager?.resetVoiceSettings();

// ================================
// CONFETTI CONSOLE HELPERS
// ================================
window.testConfetti = () => confettiManager?.test();
window.toggleConfetti = () => {
  if (confettiManager) {
    const isActive = !confettiManager.isActive;
    confettiManager.setActive(isActive);
    return `Confetti ${isActive ? 'ENABLED' : 'DISABLED'}`;
  }
  return 'Confetti manager not available';
};

// =====================================================
// LANGUAGE TOGGLE HANDLER
// =====================================================
function initializeLanguageToggle() {
  // Load saved language preference
  const savedLanguage = localStorage.getItem('app_language') || 'en';
  updateLanguageToggleUI(savedLanguage);
}

// Global function called from onclick handlers
window.setLanguage = function (language) {
  console.log(`🌐 Switching language to: ${language}`);

  // Get previous language to detect language switch
  const previousLanguage = localStorage.getItem('app_language') || 'en';

  // Save language preference
  localStorage.setItem('app_language', language);

  // Update UI
  updateLanguageToggleUI(language);

  // If switching to Chinese, clear conversation history and browser memory
  if (language === 'cn' && previousLanguage !== 'cn') {
    console.log('🔄 Switching to Chinese - clearing conversation history and browser memory');
    if (window.chatManager) {
      window.chatManager.clearConversationHistory();
    }
  }

  // Reload config with new language (to get correct voice ID)
  if (window.configManager) {
    window.configManager.setLanguage(language);
    window.configManager.loadConfig(language).then(() => {
      console.log(`✅ Config reloaded for language: ${language}`);
    });
  }
};

function updateLanguageToggleUI(language) {
  const languageEN = document.getElementById('languageEN');
  const languageCN = document.getElementById('languageCN');

  if (!languageEN || !languageCN) {
    return;
  }

  if (language === 'cn') {
    languageEN.classList.remove('active');
    languageCN.classList.add('active');
  } else {
    languageEN.classList.add('active');
    languageCN.classList.remove('active');
  }
}

// Initialize everything when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeLanguageToggle();
  initializeApp();
});
