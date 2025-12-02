export class SpeechBubbleManager {
  constructor() {
    this.currentSpeechText = '';
    this.speechBubbleTimeout = null;
    this.currentChunks = [];
    this.currentChunkIndex = 0;
    this.chunkTimers = [];
  }

  // =====================================================
  // TEXT CHUNKING
  // =====================================================
  createTextChunks(text, maxWordsPerChunk = 16) {
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const chunks = [];

    for (let sentence of sentences) {
      const words = sentence.trim().split(/\s+/);

      if (words.length <= maxWordsPerChunk) {
        // If sentence fits in one chunk, add it
        chunks.push(sentence.trim());
      } else {
        // Split long sentences into smaller chunks with some overlap for better context
        for (let i = 0; i < words.length; i += maxWordsPerChunk - 2) {
          const endIndex = Math.min(i + maxWordsPerChunk, words.length);
          const chunk = words.slice(i, endIndex).join(' ');
          chunks.push(chunk);

          // If we've reached the end, break to avoid empty chunks
          if (endIndex >= words.length) break;
        }
      }
    }

    return chunks.filter((chunk) => chunk.length > 0);
  }

  // =====================================================
  // BASIC SPEECH BUBBLE FUNCTIONS
  // =====================================================
  showSpeechBubble(text) {
    const speechBubble = document.getElementById('speechBubble');
    const speechBubbleText = document.getElementById('speechBubbleText');
    const speechBubbleContent = document.querySelector(
      '.speech-bubble-content'
    );
    const arrow1 = document.querySelector('.speech-bubble-tail');
    const arrow2 = document.querySelector('.speech-bubble-tail-inner');

    this.currentSpeechText = text;

    // Generate random arrow position based on text content (korav4 style)
    const textHash = text.split('').reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    const arrowPositions = ['25%', '50%', '75%']; // left, center, right
    const randomArrowPosition =
      arrowPositions[Math.abs(textHash) % arrowPositions.length];

    // Update arrow positions
    arrow1.style.left = randomArrowPosition;
    arrow2.style.left = randomArrowPosition;

    // Apply smart text sizing and line limiting
    this.applySpeechBubbleSizing(text, speechBubbleText, speechBubbleContent);

    speechBubble.style.display = 'block';

    // Clear any existing timeout
    if (this.speechBubbleTimeout) {
      clearTimeout(this.speechBubbleTimeout);
    }
  }

  // =====================================================
  // TEXT SIZING AND LINE LIMITING
  // =====================================================
  applySpeechBubbleSizing(text, textElement, contentElement) {
    // Set the text first
    textElement.textContent = text;

    // Calculate text metrics
    const wordCount = text.split(/\s+/).length;
    const charCount = text.length;

    // Reset classes
    contentElement.classList.remove(
      'speech-bubble-small',
      'speech-bubble-compact'
    );

    // Apply sizing based on content length
    if (wordCount > 20 || charCount > 100) {
      // Long text: use smaller font and limit to 3 lines
      contentElement.classList.add('speech-bubble-small');
      this.limitToThreeLines(text, textElement);
    } else if (wordCount > 12 || charCount > 60) {
      // Medium text: use compact styling
      contentElement.classList.add('speech-bubble-compact');
    }
    // Short text: use default styling (no additional classes)
  }

  limitToThreeLines(originalText, textElement) {
    // Start with the full text
    let text = originalText;
    textElement.textContent = text;

    // Check if we need to truncate
    const maxHeight = 78; // Approximate height for 3 lines (26px per line)

    if (textElement.scrollHeight > maxHeight) {
      // Binary search for the right text length
      let left = 0;
      let right = text.length;
      let bestFit = text;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const truncated = text.substring(0, mid) + '...';
        textElement.textContent = truncated;

        if (textElement.scrollHeight <= maxHeight) {
          bestFit = truncated;
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      // Apply the best fit - make sure we end properly
      textElement.textContent = bestFit;

      // Log truncation for debugging
      if (bestFit !== originalText) {
        console.log(
          `💬 Speech bubble text truncated: ${originalText.length} -> ${bestFit.length} chars`
        );
      }
    }
  }

  hideSpeechBubble() {
    const speechBubble = document.getElementById('speechBubble');
    speechBubble.style.display = 'none';
    this.currentSpeechText = '';
    this.currentChunks = [];
    this.currentChunkIndex = 0;

    // Clear chunk timers
    this.chunkTimers.forEach((timer) => clearTimeout(timer));
    this.chunkTimers = [];
  }

  updateSpeechBubble(text) {
    if (this.currentSpeechText) {
      this.showSpeechBubble(text);
    }
  }

  // =====================================================
  // CHUNKED SPEECH BUBBLE FUNCTIONS
  // =====================================================
  showChunkedSpeechBubble(fullText, wordTimes, words) {
    // Clear any existing chunk timers
    this.chunkTimers.forEach((timer) => clearTimeout(timer));
    this.chunkTimers = [];

    // Create chunks from the full text
    this.currentChunks = this.createTextChunks(fullText);
    this.currentChunkIndex = 0;

    if (this.currentChunks.length === 0) {
      this.showSpeechBubble(fullText);
      return;
    }

    // Show first chunk immediately
    this.showSpeechBubble(this.currentChunks[0]);

    if (this.currentChunks.length > 1) {
      // Calculate timing for chunk transitions with improved synchronization
      let cumulativeWordCount = 0;

      for (let i = 1; i < this.currentChunks.length; i++) {
        // Count words in previous chunks to find our position in the word array
        const prevChunkWords = this.currentChunks[i - 1].split(/\s+/).length;
        cumulativeWordCount += prevChunkWords;

        // Find the timing for this word position
        const wordIndex = Math.min(cumulativeWordCount, wordTimes.length - 1);
        let timing = wordTimes[wordIndex] || cumulativeWordCount * 500; // 500ms per word fallback

        // Ensure minimum duration between chunks (2.5 seconds)
        const minTiming = i * 2500;
        timing = Math.max(timing, minTiming);

        console.log(
          `Chunk ${i}: Will show at ${timing}ms (word index: ${wordIndex})`
        );

        const timer = setTimeout(() => {
          if (this.currentChunkIndex < this.currentChunks.length - 1) {
            this.currentChunkIndex++;
            console.log(
              `Showing chunk ${this.currentChunkIndex}: "${this.currentChunks[this.currentChunkIndex]}"`
            );
            this.showSpeechBubble(this.currentChunks[this.currentChunkIndex]);
          }
        }, timing);

        this.chunkTimers.push(timer);
      }
    }
  }

  // =====================================================
  // TIMED SPEECH BUBBLE FUNCTIONS
  // =====================================================
  showTimedSpeechBubble(text, duration = 2000) {
    this.showSpeechBubble(text);
    this.speechBubbleTimeout = setTimeout(() => {
      this.hideSpeechBubble();
    }, duration);
  }

  // =====================================================
  // CLEANUP FUNCTIONS
  // =====================================================
  clearAllTimers() {
    if (this.speechBubbleTimeout) {
      clearTimeout(this.speechBubbleTimeout);
      this.speechBubbleTimeout = null;
    }

    this.chunkTimers.forEach((timer) => clearTimeout(timer));
    this.chunkTimers = [];
  }

  // =====================================================
  // GETTERS
  // =====================================================
  getCurrentSpeechText() {
    return this.currentSpeechText;
  }

  isShowing() {
    return this.currentSpeechText !== '';
  }

  getCurrentChunkInfo() {
    return {
      chunks: this.currentChunks,
      currentIndex: this.currentChunkIndex,
      totalChunks: this.currentChunks.length,
    };
  }
}
