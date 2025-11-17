export class IdleTimerManager {
  constructor() {
    this.idleTimer = null;
    this.idleTimeoutMs = 8000; // 8 seconds default
    this.head = null;
    this.isLoaded = false;
    this.currentMoodRef = null;
    this.currentMood = 'neutral';
  }

  // =====================================================
  // DEPENDENCY INJECTION
  // =====================================================
  setDependencies(head, isLoadedRef, currentMoodRef, currentMoodVar) {
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
  }

  // =====================================================
  // IDLE TIMER MANAGEMENT
  // =====================================================
  startIdleTimer() {
    // Clear any existing timer
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
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
  }

  resetIdleTimer() {
    this.startIdleTimer();
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
  }

  // =====================================================
  // STATE GETTERS
  // =====================================================
  isTimerActive() {
    return this.idleTimer !== null;
  }
} 