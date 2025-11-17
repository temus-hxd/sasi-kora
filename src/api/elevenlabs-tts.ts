/**
 * ElevenLabs TTS API Routes
 * Handles text-to-speech conversion with lip-sync data
 */

import { Router } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = process.env.VOICE_ID || process.env.ELEVENLABS_VOICE_ID;

/**
 * Clean text for TTS (remove emojis, thinking tags)
 */
function cleanTextForTTS(text: string): string {
  return text
    // Remove thinking tags <t>...</t>
    .replace(/<t>[\s\S]*?<\/t>/gi, '')
    // Remove emojis
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate phonetic visemes for lip sync
 * Ported from original Python/JS implementation
 */
function generatePhoneticVisemes(text: string, audioDuration: number) {
  const words = text.split(' ').filter(word => word.length > 0);
  
  if (words.length === 0) {
    return {
      words: [],
      wordTimes: [],
      wordDurations: [],
      visemes: [],
      visemeTimes: [],
      visemeDurations: [],
      audioDriven: false,
      duration: audioDuration
    };
  }
  
  // Phoneme to viseme mapping (ReadyPlayerMe TalkingHead compatible)
  const phonemeToViseme: Record<string, string> = {
    // Bilabials (lips together)
    'p': 'PP', 'b': 'PP', 'm': 'PP',
    // Labiodentals (lip to teeth)
    'f': 'FF', 'v': 'FF',
    // Dentals/Alveolars
    't': 'DD', 'd': 'DD', 'n': 'DD', 'l': 'DD', 'th': 'TH',
    // Sibilants
    's': 'SS', 'z': 'SS', 'sh': 'SS', 'ch': 'SS', 'zh': 'SS',
    // Liquids
    'r': 'RR',
    // Velars
    'k': 'kk', 'g': 'kk', 'ng': 'kk',
    // Vowels (mouth shapes)
    'aa': 'aa', 'ah': 'aa', 'aw': 'aa',
    'eh': 'E', 'ey': 'E',
    'ih': 'I', 'iy': 'I', 'ee': 'I',
    'ow': 'O', 'oh': 'O',
    'uh': 'U', 'uw': 'U', 'oo': 'U',
    // Silence
    'sil': 'sil', 'sp': 'sil'
  };
  
  // Enhanced phonetic analysis with better vowel detection
  function getPhonemesForWord(word: string): string[] {
    const lower = word.toLowerCase().trim();
    if (!lower) return ['sil'];
    
    const phonemes: string[] = [];
    
    // Vowel patterns that require significant mouth opening
    const vowelPatterns = [
      { pattern: /[aeiouy]{2,}/g, priority: 3 }, // Long vowels
      { pattern: /[aeiouy]/g, priority: 2 },     // Single vowels
    ];
    
    // Find all vowel positions
    const vowelMatches: Array<{ vowel: string; index: number; priority: number }> = [];
    vowelPatterns.forEach(({ pattern, priority }) => {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      while ((match = regex.exec(lower)) !== null) {
        vowelMatches.push({
          vowel: match[0],
          index: match.index,
          priority: priority,
        });
      }
    });
    
    // Sort by priority and position
    vowelMatches.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.index - b.index;
    });
    
    // Extract primary vowel sounds
    vowelMatches.forEach(({ vowel }) => {
      if (vowel.length >= 2) {
        if (vowel.match(/aa|ah|aw|au/)) phonemes.push('aa');
        else if (vowel.match(/ee|ea|ey|ei/)) phonemes.push('iy');
        else if (vowel.match(/oo|ou|ow/)) phonemes.push('uw');
        else if (vowel.match(/ie|ye/)) phonemes.push('iy');
        else phonemes.push('aa');
      } else {
        if (vowel === 'a') phonemes.push('aa');
        else if (vowel === 'e') phonemes.push('eh');
        else if (vowel === 'i' || vowel === 'y') phonemes.push('ih');
        else if (vowel === 'o') phonemes.push('ow');
        else if (vowel === 'u') phonemes.push('uh');
      }
    });
    
    // Extract consonant sounds
    if (lower.match(/^th/)) phonemes.unshift('TH');
    else if (lower.match(/^sh/)) phonemes.unshift('SS');
    else if (lower.match(/^ch/)) phonemes.unshift('SS');
    else if (lower.match(/^ph/)) phonemes.unshift('FF');
    else {
      const firstChar = lower.charAt(0);
      if (firstChar.match(/[pb]/)) phonemes.unshift('PP');
      else if (firstChar.match(/[fv]/)) phonemes.unshift('FF');
      else if (firstChar.match(/[td]/)) phonemes.unshift('DD');
      else if (firstChar.match(/[sz]/)) phonemes.unshift('SS');
      else if (firstChar.match(/[kg]/)) phonemes.unshift('kk');
      else if (firstChar === 'r') phonemes.unshift('RR');
      else if (firstChar === 'l') phonemes.unshift('DD');
      else if (firstChar === 'm') phonemes.unshift('PP');
      else if (firstChar === 'n') phonemes.unshift('DD');
    }
    
    // Check ending consonants
    if (lower.match(/ng$/)) phonemes.push('kk');
    else if (lower.match(/th$/)) phonemes.push('TH');
    else if (lower.match(/sh$/)) phonemes.push('SS');
    else if (lower.match(/ch$/)) phonemes.push('SS');
    
    // Default to open mouth if no vowels found
    if (phonemes.length === 0 || !phonemes.some(p => ['aa', 'E', 'I', 'O', 'U'].includes(phonemeToViseme[p] || ''))) {
      if (lower.match(/[h]/)) phonemes.push('aa');
      else if (lower.match(/[w]/)) phonemes.push('U');
      else phonemes.push('aa');
    }
    
    return phonemes.length > 0 ? phonemes : ['aa'];
  }
  
  // Count syllables
  function countSyllables(word: string): number {
    const lower = word.toLowerCase();
    if (lower.length <= 3) return 1;
    
    const trimmed = lower.replace(/e$/, '');
    const vowelGroups = trimmed.match(/[aeiouy]+/g);
    if (!vowelGroups) return 1;
    
    let count = vowelGroups.length;
    if (lower.match(/[aeiouy]{2,}/)) count--;
    if (lower.match(/le$/)) count++;
    
    return Math.max(1, count);
  }
  
  // Calculate word timings
  const totalDurationMs = audioDuration * 1000;
  const pauseMs = 80;
  const totalPauseTime = (words.length - 1) * pauseMs;
  const availableWordTime = Math.max(100, totalDurationMs - totalPauseTime);
  
  let currentTime = 0;
  const wordTimes: number[] = [];
  const wordDurations: number[] = [];
  const visemes: string[] = [];
  const visemeTimes: number[] = [];
  const visemeDurations: number[] = [];
  
  // Calculate word duration based on syllable count
  const getWordDuration = (word: string, baseTime: number): number => {
    const syllableCount = countSyllables(word);
    const lengthFactor = Math.max(0.7, Math.min(1.5, word.length / 6));
    const duration = baseTime * syllableCount * lengthFactor;
    return Math.max(100, Math.min(1000, duration));
  };
  
  const baseWordTime = availableWordTime / words.length;
  let lastViseme = 'sil';
  const minVisemeDuration = 150;
  
  words.forEach((word, wordIndex) => {
    const wordDuration = getWordDuration(word, baseWordTime);
    const wordStartTime = currentTime;
    
    // Get phonemes for this word
    const phonemes = getPhonemesForWord(word);
    
    // Prioritize vowels for mouth opening
    const vowelPhonemes = phonemes.filter(p => {
      const viseme = phonemeToViseme[p] || '';
      return ['aa', 'E', 'I', 'O', 'U'].includes(viseme) || 
             ['aa', 'E', 'I', 'O', 'U', 'eh', 'ih', 'ow', 'uh', 'ah', 'aw', 'ee', 'oo'].includes(p);
    });
    const consonantPhonemes = phonemes.filter(p => !vowelPhonemes.includes(p));
    
    // Generate visemes: prioritize vowels
    const visemesForWord: string[] = [];
    
    if (vowelPhonemes.length > 0) {
      const primaryVowel = vowelPhonemes[0];
      const vowelViseme = phonemeToViseme[primaryVowel] || 'aa';
      visemesForWord.push(vowelViseme);
      
      if (vowelPhonemes.length > 1) {
        const secondaryVowel = vowelPhonemes[1];
        const secondaryViseme = phonemeToViseme[secondaryVowel] || 'aa';
        if (secondaryViseme !== vowelViseme) {
          visemesForWord.push(secondaryViseme);
        }
      }
    } else {
      visemesForWord.push('aa');
    }
    
    // Add consonant viseme at beginning if different
    if (consonantPhonemes.length > 0) {
      const consonant = consonantPhonemes[0];
      const consonantViseme = phonemeToViseme[consonant] || 'aa';
      if (consonantViseme !== visemesForWord[0] && !visemesForWord.includes(consonantViseme)) {
        visemesForWord.unshift(consonantViseme);
      }
    }
    
    // Limit to 3 visemes per word
    const finalVisemes = visemesForWord.slice(0, 3);
    const visemeDuration = wordDuration / finalVisemes.length;
    
    // Generate viseme timings
    finalVisemes.forEach((viseme, i) => {
      if (viseme === lastViseme && i > 0) {
        // Extend duration instead of adding duplicate
        if (visemes.length > 0) {
          const lastIndex = visemes.length - 1;
          visemeDurations[lastIndex] = Math.max(minVisemeDuration, visemeDurations[lastIndex] + visemeDuration);
        }
        return;
      }
      
      const actualVisemeDuration = Math.max(minVisemeDuration, visemeDuration);
      const visemeTime = currentTime + (i * visemeDuration);
      
      visemes.push(viseme);
      visemeTimes.push(visemeTime);
      visemeDurations.push(actualVisemeDuration);
      
      lastViseme = viseme;
    });
    
    wordTimes.push(wordStartTime);
    wordDurations.push(wordDuration);
    currentTime += wordDuration + (wordIndex < words.length - 1 ? pauseMs : 0);
  });
  
  // Scale timings to match actual duration
  if (currentTime > 0 && Math.abs(currentTime - totalDurationMs) > 50) {
    const scaleFactor = totalDurationMs / currentTime;
    for (let i = 0; i < wordTimes.length; i++) {
      wordTimes[i] *= scaleFactor;
      wordDurations[i] *= scaleFactor;
    }
    for (let i = 0; i < visemeTimes.length; i++) {
      visemeTimes[i] *= scaleFactor;
      visemeDurations[i] *= scaleFactor;
    }
  }
  
  return {
    words: words,
    wordTimes: wordTimes,
    wordDurations: wordDurations,
    visemes: visemes,
    visemeTimes: visemeTimes,
    visemeDurations: visemeDurations,
    audioDriven: false,
    duration: audioDuration
  };
}

/**
 * POST /api/elevenlabs/tts
 * Generate TTS audio with lip-sync data
 */
router.post('/tts', async (req, res) => {
  try {
    const {
      text,
      voiceId = DEFAULT_VOICE_ID,
      emotion = 'neutral',
      modelId = 'eleven_multilingual_v2',
      stability = 0.5,
      similarityBoost = 0.75,
      style = 0.0,
      speed = 0.45, // Slower for Ah Meng (76-year-old man) - default was 0.75
      speakerBoost = true,
      stream = true,
    } = req.body;

    if (!text) {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    if (!ELEVENLABS_API_KEY) {
      res.status(503).json({
        error: 'ElevenLabs API key not configured',
        success: false,
        demo: true,
      });
      return;
    }

    if (!voiceId || !DEFAULT_VOICE_ID) {
      res.status(503).json({
        error: 'Voice ID not configured. Please set VOICE_ID in your .env file',
        success: false,
      });
      return;
    }

    const cleanText = cleanTextForTTS(text);
    if (!cleanText) {
      res.status(400).json({ error: 'No valid text after cleaning' });
      return;
    }

    console.log(`🎤 ElevenLabs TTS Request: "${cleanText.substring(0, 50)}..." with voice ${voiceId}`);

    const apiUrl = stream
      ? `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`
      : `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost,
          style,
          use_speaker_boost: speakerBoost,
        },
        speed: Math.max(0.3, Math.min(1.2, speed)), // Allow slower speeds for elderly characters (min 0.3 instead of 0.7)
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as any).detail?.message || `ElevenLabs API error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);
    const audioBase64 = audioBuffer.toString('base64');

    // Estimate duration (client will use actual AudioBuffer.duration)
    const estimatedDuration = Math.max(1.0, audioBuffer.length / (128 * 1000 / 8) * 0.85);

    // Generate visemes for lip sync
    const lipSync = generatePhoneticVisemes(cleanText, estimatedDuration);
    
    // Debug: Log viseme variety
    const uniqueVisemes = [...new Set(lipSync.visemes)];
    console.log(`✅ ElevenLabs TTS Success: ~${estimatedDuration.toFixed(2)}s audio, ${lipSync.words.length} words`);
    console.log(`💋 Viseme variety: ${uniqueVisemes.length} unique visemes: [${uniqueVisemes.join(', ')}]`);
    console.log(`💋 Total visemes: ${lipSync.visemes.length}, Avg duration: ${(estimatedDuration * 1000 / lipSync.visemes.length).toFixed(0)}ms`);

    res.json({
      success: true,
      audio: audioBase64,
      voice: voiceId,
      emotion,
      lipSync: lipSync, // Include visemes for mouth movement
      duration: estimatedDuration,
      provider: 'elevenlabs',
      streaming: stream,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('❌ ElevenLabs TTS Error:', err);
    res.status(500).json({
      error: 'ElevenLabs TTS generation failed',
      details: err.message,
      success: false,
    });
  }
});

/**
 * GET /api/elevenlabs/health
 * Health check
 */
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'ElevenLabs TTS API Running!',
    hasApiKey: !!ELEVENLABS_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

export default router;
