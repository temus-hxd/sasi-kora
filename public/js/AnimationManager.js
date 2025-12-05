/**
 * AnimationManager - Handles ReadyPlayerMe animation integration
 * Manages animation loading, context-aware triggers, and smooth transitions
 */
class AnimationManager {
  constructor() {
    this.animations = new Map();
    this.currentAnimation = null;
    this.isLoading = false;
    this.head = null; // Will be set by AvatarManager

    // Animation library configuration
    this.animationConfig = {
      talking: {
        file: '/animations/F_Talking_Variations_001.fbx',
        duration: 5000, // 5 seconds
        loop: true,
        triggers: ['speaking', 'conversation', 'chat'],
      },
      idle: {
        file: '/animations/F_Standing_Idle_Variations_001.fbx',
        duration: 8000, // 8 seconds
        loop: true,
        triggers: ['idle', 'waiting', 'default'],
      },
      dance: {
        file: '/animations/F_Dances_001.fbx',
        duration: 10000, // 10 seconds
        loop: false,
        triggers: ['dance', 'music', 'celebration', 'party', 'fun'],
      },
    };
  }

  /**
   * Initialize the animation manager with TalkingHead instance
   */
  initialize(talkingHeadInstance) {
    this.head = talkingHeadInstance;
    // Start with idle animation
    this.triggerAnimation('idle');
  }

  /**
   * Load an animation from FBX file
   */
  async loadAnimation(animationName) {
    if (this.animations.has(animationName)) {
      return this.animations.get(animationName);
    }

    const config = this.animationConfig[animationName];
    if (!config) {
      console.warn(`🎭 Animation "${animationName}" not found in config`);
      return null;
    }

    try {
      this.isLoading = true;

      // For now, we'll use TalkingHead's built-in animation system
      // In future, we can implement FBX loading with Three.js FBXLoader
      const animationData = {
        name: animationName,
        config: config,
        loaded: true,
      };

      this.animations.set(animationName, animationData);

      return animationData;
    } catch (error) {
      console.error(`❌ Failed to load animation "${animationName}":`, error);
      return null;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Trigger an animation based on context
   */
  async triggerAnimation(animationName, force = false) {
    if (!this.head) {
      console.warn('🎭 TalkingHead not initialized');
      return;
    }

    // Don't interrupt current animation unless forced
    if (this.currentAnimation === animationName && !force) {
      return;
    }

    const animation = await this.loadAnimation(animationName);
    if (!animation) {
      console.warn(`🎭 Could not trigger animation: ${animationName}`);
      return;
    }

    try {
      this.currentAnimation = animationName;

      // Map our animations to TalkingHead poses/moods
      switch (animationName) {
        case 'talking':
          this.head.setMood('happy');
          this.head.speakText(''); // Trigger speaking animation
          break;

        case 'dance':
          this.head.setMood('excited');
          // Could trigger a sequence of poses for dance effect
          this.danceSequence();
          break;

        case 'idle':
        default:
          this.head.setMood('neutral');
          break;
      }

      // Auto-return to idle after animation duration (if not looping)
      if (!animation.config.loop) {
        setTimeout(() => {
          if (this.currentAnimation === animationName) {
            this.triggerAnimation('idle');
          }
        }, animation.config.duration);
      }
    } catch (error) {
      console.error(`❌ Error triggering animation "${animationName}":`, error);
    }
  }

  /**
   * Analyze text content and trigger appropriate animation
   */
  analyzeAndTrigger(text) {
    if (!text) return;

    const lowerText = text.toLowerCase();

    // Check for dance emojis first
    if (
      text.includes('💃') ||
      text.includes('🕺') ||
      text.includes('🎵') ||
      text.includes('🎉')
    ) {
      this.triggerAnimation('dance');
      return;
    }

    // Check for dance/music keywords
    if (
      lowerText.includes('dance') ||
      lowerText.includes('dancing') ||
      lowerText.includes('music') ||
      lowerText.includes('party') ||
      lowerText.includes('celebration') ||
      lowerText.includes('boogie') ||
      lowerText.includes('shuffle') ||
      lowerText.includes('moves') ||
      lowerText.includes('shimmy') ||
      lowerText.includes('bust out')
    ) {
      this.triggerAnimation('dance');
      return;
    }

    // Check for greeting keywords
    if (
      lowerText.includes('hello') ||
      lowerText.includes('hi') ||
      lowerText.includes('welcome') ||
      lowerText.includes('greet')
    ) {
      this.triggerAnimation('talking');
      return;
    }

    // Default to talking animation for responses
    if (text.length > 20) {
      this.triggerAnimation('talking');
    }
  }

  /**
   * Create a dance sequence using available poses
   */
  danceSequence() {
    if (!this.head) return;

    // Set excited mood for dancing
    this.head.setMood('excited');

    const poses = ['hip', 'side', 'turn', 'bend', 'straight'];
    let currentPose = 0;

    // Start with first pose
    this.head.setPose(poses[currentPose]);

    const danceInterval = setInterval(() => {
      if (this.currentAnimation !== 'dance') {
        clearInterval(danceInterval);
        return;
      }

      // Move to next pose
      currentPose = (currentPose + 1) % poses.length;
      this.head.setPose(poses[currentPose]);
    }, 800); // Change pose every 800ms for more dynamic movement

    // Stop dance sequence after animation duration
    setTimeout(() => {
      clearInterval(danceInterval);
      this.head.setPose('straight'); // Return to normal pose
      this.head.setMood('neutral'); // Return to neutral mood
    }, this.animationConfig.dance.duration);
  }

  /**
   * Handle TTS start event
   */
  onSpeechStart() {
    this.triggerAnimation('talking');
  }

  /**
   * Handle TTS end event
   */
  onSpeechEnd() {
    // Return to idle after a short delay
    setTimeout(() => {
      if (this.currentAnimation === 'talking') {
        this.triggerAnimation('idle');
      }
    }, 1000);
  }

  /**
   * Get current animation status
   */
  getStatus() {
    return {
      currentAnimation: this.currentAnimation,
      isLoading: this.isLoading,
      loadedAnimations: Array.from(this.animations.keys()),
    };
  }

  /**
   * Preload all animations
   */
  async preloadAnimations() {
    const animationNames = Object.keys(this.animationConfig);
    const loadPromises = animationNames.map((name) => this.loadAnimation(name));

    await Promise.all(loadPromises);
  }
}

// Export for use in other modules
window.AnimationManager = AnimationManager;
