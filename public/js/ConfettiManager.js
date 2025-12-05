/**
 * ================================
 * CONFETTI APPRECIATION MANAGER
 * ================================
 * Triggers confetti when user shows appreciation like "Thanks", "I love you", "You look good"
 * Easy to comment out and find for all 3 systems
 */

class ConfettiManager {
  constructor() {
    this.container = document.getElementById('confettiContainer');
    this.isActive = true; // Set to false to disable confetti
    this.appreciationKeywords = [
      // Gratitude
      'thank',
      'thanks',
      'grateful',
      'appreciate',
      'blessing',
      // Love & Affection
      'love',
      'adore',
      'heart',
      'sweet',
      'wonderful',
      'amazing',
      // Compliments
      'beautiful',
      'gorgeous',
      'pretty',
      'handsome',
      'good looking',
      'stunning',
      'awesome',
      'fantastic',
      'incredible',
      'brilliant',
      'perfect',
      // Positive emotions
      'happy',
      'joy',
      'smile',
      'excellent',
      'outstanding',
      'superb',
    ];
  }

  /**
   * ================================
   * APPRECIATION DETECTION
   * ================================
   * Analyzes user input for appreciation keywords
   */
  detectAppreciation(userText) {
    if (!this.isActive || !userText) return false;

    const lowerText = userText.toLowerCase();
    const detected = this.appreciationKeywords.some((keyword) =>
      lowerText.includes(keyword)
    );

    if (detected) {
      console.log(`🎊 Appreciation detected in: "${userText}"`);
      // this.triggerConfetti();
    }

    return detected;
  }

  // /**
  //  * ================================
  //  * CONFETTI TRIGGER SYSTEM
  //  * ================================
  //  * Creates and animates falling hearts
  //  */
  // triggerConfetti() {
  //   if (!this.isActive) return;

  //   console.log('🎊 Triggering appreciation confetti!');

  //   // Clear any existing confetti
  //   this.clearConfetti();

  //   // Create 10 hearts with staggered timing
  //   for (let i = 0; i < 10; i++) {
  //     setTimeout(() => {
  //       this.createHeart();
  //     }, i * 100); // 100ms delay between each heart
  //   }

  //   // Auto-clear after animation completes
  //   setTimeout(() => {
  //     this.clearConfetti();
  //   }, 5000); // 5 seconds (animation is 4s + buffer)
  // }

  /**
   * ================================
   * HEART CREATION SYSTEM
   * ================================
   * Generates individual animated hearts
   */
  createHeart() {
    const heart = document.createElement('div');
    heart.className = 'heart';
    heart.innerHTML = '❤️'; // Heart emoji

    // Random horizontal position
    const leftPosition = Math.random() * 95; // 0-95%
    heart.style.left = `${leftPosition}%`;

    // Slight size variation
    const size = 1.5 + Math.random() * 1; // 1.5em to 2.5em
    heart.style.fontSize = `${size}em`;

    // Add to container
    this.container.appendChild(heart);

    // Remove heart after animation
    setTimeout(() => {
      if (heart.parentNode) {
        heart.parentNode.removeChild(heart);
      }
    }, 4500);
  }

  /**
   * ================================
   * CONFETTI CONTROL METHODS
   * ================================
   */

  // Clear all active confetti
  clearConfetti() {
    if (this.container) {
      this.container.innerHTML = '';
    }
  }

  // Enable/disable confetti system
  setActive(isActive) {
    this.isActive = isActive;
    console.log(`🎊 ConfettiManager ${isActive ? 'ENABLED' : 'DISABLED'}`);

    if (!isActive) {
      this.clearConfetti();
    }
  }

  // Test confetti (for debugging)
  test() {
    console.log('🎊 Testing confetti system...');
    // this.triggerConfetti();
  }

  // Add custom appreciation keyword
  addKeyword(keyword) {
    if (!this.appreciationKeywords.includes(keyword.toLowerCase())) {
      this.appreciationKeywords.push(keyword.toLowerCase());
      console.log(`🎊 Added appreciation keyword: "${keyword}"`);
    }
  }

  // Remove appreciation keyword
  removeKeyword(keyword) {
    const index = this.appreciationKeywords.indexOf(keyword.toLowerCase());
    if (index > -1) {
      this.appreciationKeywords.splice(index, 1);
      console.log(`🎊 Removed appreciation keyword: "${keyword}"`);
    }
  }
}

/**
 * ================================
 * EASY DISABLE/ENABLE SECTION
 * ================================
 * To disable confetti system completely:
 * 1. Set CONFETTI_ENABLED = false below
 * 2. Or comment out the ConfettiManager initialization in app.js
 */
const CONFETTI_ENABLED = true; // Change to false to disable

// Export for use in other modules
window.ConfettiManager = ConfettiManager;
window.CONFETTI_ENABLED = CONFETTI_ENABLED;
