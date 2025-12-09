export class EmojiManager {
  constructor() {
    this.head = null;
    this.currentMood = 'neutral';
  }

  setDependencies(head, currentMoodRef, resetIdleTimerFn) {
    this.head = head;
    this.getCurrentMood = () => currentMoodRef.current;
    this.setCurrentMood = (mood) => (currentMoodRef.current = mood);
    // resetIdleTimerFn parameter kept for compatibility but not used
  }

  // Emoji to avatar action mapping
  emojiToAction = {
    // Basic Expressions
    '😊': () => {
      this.head.speakEmoji('😊');
      this.head.setMood('happy');
      this.setCurrentMood('happy');
    },
    '😢': () => {
      this.head.speakEmoji('😢');
      this.head.setMood('sad');
      this.setCurrentMood('sad');
    },
    '😠': () => {
      this.head.speakEmoji('😠');
      this.head.setMood('angry');
      this.setCurrentMood('angry');
    },
    '😴': () => {
      this.head.speakEmoji('😴');
      this.head.setMood('sleep');
      this.setCurrentMood('sleep');
    },
    '😍': () => {
      this.head.speakEmoji('😍');
      this.head.setMood('love');
      this.setCurrentMood('love');
    },
    '😱': () => {
      this.head.speakEmoji('😱');
      this.head.setMood('fear');
      this.setCurrentMood('fear');
    },
    '🤔': () => {
      this.head.speakEmoji('🤔');
      this.head.setMood('neutral');
      this.setCurrentMood('neutral');
    },
    '😐': () => {
      this.head.speakEmoji('😐');
      this.head.setMood('neutral');
      this.setCurrentMood('neutral');
    },

    // Advanced Emotions
    '🥺': () => {
      this.head.speakEmoji('🥺');
      this.head.setMood('sad');
      this.setCurrentMood('sad');
    },
    '😤': () => {
      this.head.speakEmoji('😤');
      this.head.setMood('angry');
      this.setCurrentMood('angry');
    },
    '🤗': () => {
      this.head.speakEmoji('🤗');
      this.head.setMood('happy');
      this.setCurrentMood('happy');
    },
    '🙄': () => {
      this.head.speakEmoji('🙄');
      this.head.setMood('neutral');
      this.setCurrentMood('neutral');
    },
    '😏': () => {
      this.head.speakEmoji('😏');
      this.head.setMood('happy');
      this.setCurrentMood('happy');
    },
    '🤨': () => {
      this.head.speakEmoji('🤨');
      this.head.setMood('neutral');
      this.setCurrentMood('neutral');
    },
    '😵': () => {
      this.head.speakEmoji('😵');
      this.head.setMood('neutral');
      this.setCurrentMood('neutral');
    },
    '🤩': () => {
      this.head.speakEmoji('🤩');
      this.head.setMood('happy');
      this.setCurrentMood('happy');
    },
    '👍': () => {
      this.head.speakEmoji('👍');
    },
    '👎': () => {
      this.head.speakEmoji('👎');
    },
    '🤝': () => {
      this.head.speakEmoji('🤝');
    },
    '🤷': () => {
      this.head.speakEmoji('🤷');
    },
    '👏': () => {
      this.head.speakEmoji('👏');
    },
    '🤦': () => {
      this.head.speakEmoji('🤦');
      this.head.setMood('sad');
      this.setCurrentMood('sad');
    },
    '💪': () => {
      this.head.speakEmoji('💪');
      this.head.setMood('happy');
      this.setCurrentMood('happy');
    },

    // Special States
    '🧠': () => {
      this.head.speakEmoji('🤔');
      this.head.setMood('neutral');
      this.setCurrentMood('neutral');
      this.head.lookAtCamera(2000);
    },
    '💡': () => {
      this.head.speakEmoji('😊');
      this.head.setMood('happy');
      this.setCurrentMood('happy');
    },
    '🔥': () => {
      this.head.speakEmoji('😄');
      this.head.setMood('happy');
      this.setCurrentMood('happy');
    },
    '⚡': () => {
      this.head.speakEmoji('😲');
      this.head.setMood('happy');
      this.setCurrentMood('happy');
      this.head.lookAtCamera(1000);
    },
    '🎯': () => {
      this.head.speakEmoji('🤔');
      this.head.lookAtCamera(2000);
    },
    '🚀': () => {
      this.head.speakEmoji('🤩');
      this.head.setMood('happy');
      this.setCurrentMood('happy');
    },
    '💎': () => {
      this.head.speakEmoji('😍');
      this.head.setMood('love');
      this.setCurrentMood('love');
      this.head.makeEyeContact(2000);
    },
    '🌟': () => {
      this.head.speakEmoji('🤩');
      this.head.setMood('happy');
      this.setCurrentMood('happy');
    },
    // Dance animations
    '💃': () => this.triggerDanceSequence(),
    '🕺': () => this.triggerDanceSequence(),
    '🎵': () => this.triggerDanceSequence(),
    '🎉': () => this.triggerDanceSequence(),
  };

  triggerEmojiAction(emoji) {
    if (this.emojiToAction[emoji] && this.head) {
      console.log('🎭 Triggering avatar action for:', emoji);
      this.emojiToAction[emoji]();
      return true;
    }
    return false;
  }

  hasEmojiAction(emoji) {
    return !!this.emojiToAction[emoji];
  }

  triggerDanceSequence() {
    if (!this.head) {
      console.error('🎭 No TalkingHead instance available for dance');
      return;
    }

    console.log('🎭 Starting REAL dance sequence in EmojiManager!');
    console.log('🎭 Current URL:', window.location.href);
    console.log(
      '🎭 TalkingHead methods available:',
      Object.getOwnPropertyNames(Object.getPrototypeOf(this.head))
    );

    // Set happy mood and speak emoji
    this.head.speakEmoji('💃');
    this.head.setMood('happy');
    this.setCurrentMood('happy');

    // Test multiple animation file paths for Vercel compatibility
    const animationPaths = [
      '/animations/F_Dances_001.fbx',
      './animations/F_Dances_001.fbx',
      'animations/F_Dances_001.fbx',
      `${window.location.origin}/animations/F_Dances_001.fbx`,
    ];

    let animationLoaded = false;

    const tryLoadAnimation = (pathIndex = 0) => {
      if (pathIndex >= animationPaths.length) {
        console.warn(
          '🎭 All animation paths failed, using fallback dance sequence'
        );
        this.fallbackDanceSequence();
        return;
      }

      const currentPath = animationPaths[pathIndex];
      console.log(
        `🎭 Trying animation path ${pathIndex + 1}/${animationPaths.length}: ${currentPath}`
      );

      try {
        // Check if playAnimation method exists
        if (typeof this.head.playAnimation !== 'function') {
          console.warn('🎭 playAnimation method not available, using fallback');
          this.fallbackDanceSequence();
          return;
        }

        // Try to play the animation
        const result = this.head.playAnimation(currentPath, null, 8, 0, 0.01);
        console.log('🎭 playAnimation call result:', result);

        if (result !== false) {
          console.log(
            '🎭 Animation loaded successfully with path:',
            currentPath
          );
          animationLoaded = true;

          // Add some celebratory gestures during the dance
        } else {
          console.log(
            `🎭 Animation path ${currentPath} failed, trying next...`
          );
          setTimeout(() => tryLoadAnimation(pathIndex + 1), 100);
        }
      } catch (error) {
        console.warn(`🎭 Animation path ${currentPath} threw error:`, error);
        setTimeout(() => tryLoadAnimation(pathIndex + 1), 100);
      }
    };

    // Start trying animation paths
    tryLoadAnimation();

    // Fallback timeout - if no animation loads in 2 seconds, use gesture sequence
    setTimeout(() => {
      if (!animationLoaded) {
        console.log(
          '🎭 Animation timeout reached, using fallback dance sequence'
        );
        this.fallbackDanceSequence();
      }
    }, 2000);

    // Stop dance after 8 seconds
    setTimeout(() => {
      console.log('🎭 Dance sequence ending');
      if (this.head) {
        if (typeof this.head.stopAnimation === 'function') {
          this.head.stopAnimation();
        }
        if (typeof this.head.stopGesture === 'function') {
          this.head.stopGesture(500);
        }
        this.head.setMood('happy');
        this.setCurrentMood('happy');
      }
    }, 8000);
  }

  fallbackDanceSequence() {
    console.log('🎭 Starting fallback dance sequence');

    // Enhanced gesture sequence with better timing and variety
    const danceSteps = [
      { gesture: 'handup', duration: 1.5, mirror: false },
      { gesture: 'side', duration: 1.2, mirror: false },
      { gesture: 'thumbup', duration: 1.0, mirror: true },
      { gesture: 'handup', duration: 1.3, mirror: true },
      { gesture: 'ok', duration: 1.0, mirror: false },
      { gesture: 'shrug', duration: 1.2, mirror: false },
      { gesture: 'thumbup', duration: 1.0, mirror: false },
    ];

    let stepIndex = 0;

    const executeStep = () => {
      if (stepIndex < danceSteps.length) {
        const step = danceSteps[stepIndex];
        console.log(
          `🎭 Dance step ${stepIndex + 1}: ${step.gesture} (${step.mirror ? 'right' : 'left'} hand)`
        );

        stepIndex++;
        setTimeout(executeStep, step.duration * 1000);
      }
    };

    executeStep();
  }
}
