// Phase 1 Test Script
// Tests prompt loader and config loader

import { loadPrompt, loadAngerConfig } from './dist/emotion-engine/index.js';

async function testPhase1() {
  console.log('🧪 Testing Phase 1: Foundation & Core Infrastructure\n');
  
  // Test 1: Load a prompt
  console.log('Test 1: Loading prompt (normal_agent.md)...');
  try {
    const prompt = await loadPrompt('normal_agent.md');
    console.log(`✅ Prompt loaded successfully (${prompt.length} characters)`);
    console.log(`   Preview: ${prompt.substring(0, 100)}...\n`);
  } catch (error) {
    console.error(`❌ Failed to load prompt:`, error.message);
    process.exit(1);
  }

  // Test 2: Load anger config
  console.log('Test 2: Loading anger config...');
  try {
    const config = await loadAngerConfig();
    console.log('✅ Config loaded successfully');
    console.log(`   Anger multiplier: ${config.anger_multiplier}`);
    console.log(`   Thresholds: irritated=${config.thresholds.irritated}, agitated=${config.thresholds.agitated}, enraged=${config.thresholds.enraged}`);
    console.log(`   Max points: ${config.meter.max_points}\n`);
  } catch (error) {
    console.error(`❌ Failed to load config:`, error.message);
    process.exit(1);
  }

  // Test 3: Load multiple prompts
  console.log('Test 3: Loading multiple prompts...');
  try {
    const prompts = [
      'sassi_personality.md',
      'linguistic-engine.md',
      'false-memory.md',
      'sentiment_agent.md'
    ];
    
    for (const promptFile of prompts) {
      const prompt = await loadPrompt(promptFile);
      console.log(`   ✅ ${promptFile} (${prompt.length} chars)`);
    }
    console.log('');
  } catch (error) {
    console.error(`❌ Failed to load prompts:`, error.message);
    process.exit(1);
  }

  console.log('✨ Phase 1 tests passed!');
}

testPhase1().catch(console.error);

