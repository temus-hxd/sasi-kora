export class VoiceStateManager {
  constructor() {
    this.sessionId = 'user-' + Date.now();
    this.currentVoiceState = {
      current_volume_db: 10, // Default to maximum volume for better audibility
      current_speed_rate: 100,
      senior_mode_active: false,
    };
  }

  // =====================================================
  // VOICE STATE MANAGEMENT
  // =====================================================
  async getVoiceState() {
    try {
      const response = await fetch(`/api/voice-state/${this.sessionId}`);
      const data = await response.json();
      if (data.success) {
        this.currentVoiceState = data.voiceState;
      }
      return this.currentVoiceState;
    } catch (error) {
      console.error('Error getting voice state:', error);
      return this.currentVoiceState;
    }
  }

  async resetVoiceSettings() {
    try {
      const response = await fetch(`/api/voice-reset/${this.sessionId}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        this.currentVoiceState = data.voiceState;
        this.updateStatus('🔄 Voice settings reset to defaults');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error resetting voice settings:', error);
      return false;
    }
  }

  // =====================================================
  // GETTERS
  // =====================================================
  getSessionId() {
    return this.sessionId;
  }

  getCurrentVoiceState() {
    return this.currentVoiceState;
  }

  // =====================================================
  // DEPENDENCY INJECTION
  // =====================================================
  setUpdateStatusFunction(updateStatusFn) {
    this.updateStatus = updateStatusFn;
  }

  // Default status function if none provided
  updateStatus(message) {
    console.log('VoiceStateManager:', message);
  }
}
