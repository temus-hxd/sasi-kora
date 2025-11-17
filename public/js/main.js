// Chat UI JavaScript for Emotion Engine Testing
let conversationHistory = [];
let conversationId = 'default-' + Date.now();
let emotionState = null; // Store emotion state from server

// DOM Elements
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const resetButton = document.getElementById('resetButton');
const chatMessages = document.getElementById('chatMessages');
const statusBar = document.getElementById('status-bar');
const angerMeterBar = document.getElementById('anger-meter-bar');
const angerMeterPoints = document.getElementById('anger-meter-points');
const intensityIndicator = document.getElementById('intensity-indicator');
const intensityLabel = document.getElementById('intensity-label');
const trajectoryIndicator = document.getElementById('trajectory-indicator');
const triggersIndicator = document.getElementById('triggers-indicator');
const aiInsightsState = document.getElementById('ai-insights-state');
const aiInsightsStrategy = document.getElementById('ai-insights-strategy');

// Agent list items
const agentItems = {
  'normal': document.getElementById('agent-normal'),
  'pleased': document.getElementById('agent-happy-level1-pleased'),
  'cheerful': document.getElementById('agent-happy-level2-cheerful'),
  'ecstatic': document.getElementById('agent-happy-level3-ecstatic'),
  'melancholy': document.getElementById('agent-sad-level1-melancholy'),
  'sorrowful': document.getElementById('agent-sad-level2-sorrowful'),
  'depressed': document.getElementById('agent-sad-level3-depressed'),
  'irritated': document.getElementById('agent-angry-level1-irritated'),
  'agitated': document.getElementById('agent-angry-level2-agitated'),
  'enraged': document.getElementById('agent-angry-level3-enraged')
};

// Send message
async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;

  // Add user message to UI
  addMessageToUI('user', message);
  messageInput.value = '';
  messageInput.disabled = true;
  sendButton.disabled = true;

  // Add to history
  conversationHistory.push({
    role: 'user',
    content: message,
    timestamp: new Date().toISOString()
  });

    try {
    // Call emotion engine API
    const response = await fetch('/api/emotional-state/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        conversation_id: conversationId,
        history: conversationHistory.slice(0, -1), // Exclude current message
        emotion_state: emotionState // Send stored state for stateless serverless
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Store emotion state from server (for stateless serverless)
    if (data.emotion_state) {
      emotionState = data.emotion_state;
    }

    // Add assistant response to history
    conversationHistory.push({
      role: 'assistant',
      content: data.response,
      timestamp: data.timestamp
    });

    // Update UI with response
    addMessageToUI('assistant', data.response);

    // Update indicators
    updateIndicators(data);

  } catch (error) {
    console.error('Error sending message:', error);
    addMessageToUI('assistant', `Error: ${error.message}`, true);
  } finally {
    messageInput.disabled = false;
    sendButton.disabled = false;
    messageInput.focus();
  }
}

// Add message to UI
function addMessageToUI(role, content, isError = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-4`;
  
  const bubble = document.createElement('div');
  bubble.className = `max-w-2xl px-4 py-2 rounded-lg ${
    role === 'user' 
      ? 'bg-blue-500 text-white' 
      : isError
      ? 'bg-red-100 text-red-800 border border-red-300'
      : 'bg-gray-200 text-gray-800'
  }`;
  
  bubble.textContent = content;
  messageDiv.appendChild(bubble);
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Update all indicators
function updateIndicators(data) {
  // Update status bar
  const agentType = data.agent_type || 'normal';
  const intensity = data.sentiment_analysis?.intensity || 0;
  statusBar.textContent = `Status: Online | Current: ${agentType} | Intensity: ${intensity.toFixed(1)}/1.0`;

  // Update active agent
  updateActiveAgent(agentType);

  // Update anger meter
  const angerPoints = data.orchestrator_insights?.anger_points || 0;
  const maxPoints = data.orchestrator_insights?.anger_thresholds?.max_points || 100;
  const percentage = Math.min((angerPoints / maxPoints) * 100, 100);
  angerMeterBar.style.width = `${percentage}%`;
  angerMeterPoints.textContent = `${Math.round(angerPoints)}/${maxPoints} pts`;

  // Update intensity
  intensityIndicator.textContent = `${intensity.toFixed(1)}/1.0`;
  intensityLabel.textContent = getIntensityLabel(intensity);

  // Update trajectory
  if (data.orchestrator_insights?.conversation_trajectory) {
    trajectoryIndicator.textContent = data.orchestrator_insights.conversation_trajectory;
  }

  // Update triggers
  if (data.sentiment_analysis?.emotional_indicators) {
    triggersIndicator.innerHTML = '';
    data.sentiment_analysis.emotional_indicators.forEach(trigger => {
      const tag = document.createElement('span');
      tag.className = 'bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded';
      tag.textContent = trigger;
      triggersIndicator.appendChild(tag);
    });
  }

  // Update AI insights
  if (data.orchestrator_insights?.state_transition) {
    aiInsightsState.innerHTML = `<strong>State Transition:</strong> ${data.orchestrator_insights.state_transition}`;
  }
  if (data.orchestrator_insights?.orchestrator_suggestion) {
    aiInsightsStrategy.innerHTML = `<strong>Strategy:</strong> ${data.orchestrator_insights.orchestrator_suggestion}`;
  }
}

// Update active agent indicator
function updateActiveAgent(agentType) {
  // Remove active class from all
  Object.values(agentItems).forEach(item => {
    if (item) {
      item.classList.remove('active-agent');
    }
  });

  // Map agent type to element ID
  const agentMap = {
    'normal': 'agent-normal',
    'pleased': 'agent-happy-level1-pleased',
    'cheerful': 'agent-happy-level2-cheerful',
    'ecstatic': 'agent-happy-level3-ecstatic',
    'melancholy': 'agent-sad-level1-melancholy',
    'sorrowful': 'agent-sad-level2-sorrowful',
    'depressed': 'agent-sad-level3-depressed',
    'irritated': 'agent-angry-level1-irritated',
    'agitated': 'agent-angry-level2-agitated',
    'enraged': 'agent-angry-level3-enraged'
  };

  const elementId = agentMap[agentType];
  if (elementId && agentItems[agentType]) {
    agentItems[agentType].classList.add('active-agent');
  }
}

// Get intensity label
function getIntensityLabel(intensity) {
  if (intensity >= 0.8) return 'Very strong emotion';
  if (intensity >= 0.5) return 'Moderate emotion';
  if (intensity >= 0.3) return 'Mild emotion';
  if (intensity >= 0.1) return 'Subtle emotion';
  return 'Minimal emotion';
}

// Reset conversation
async function resetConversation() {
  if (!confirm('Reset conversation? This will clear all messages.')) {
    return;
  }

  conversationHistory = [];
  conversationId = 'default-' + Date.now();
  emotionState = null; // Clear emotion state
  chatMessages.innerHTML = '';

  try {
    await fetch('/api/emotional-state/reset', {
      method: 'POST'
    });
  } catch (error) {
    console.error('Error resetting:', error);
  }

  // Reset indicators
  statusBar.textContent = 'Status: Online | Current: Normal | Intensity: 0.0/1.0';
  updateActiveAgent('normal');
  angerMeterBar.style.width = '0%';
  angerMeterPoints.textContent = '0/100 pts';
  intensityIndicator.textContent = '0.0/1.0';
  intensityLabel.textContent = 'Minimal emotion';
  trajectoryIndicator.textContent = 'Initial conversation state';
  triggersIndicator.innerHTML = '';
  aiInsightsState.innerHTML = '<strong>State Transition:</strong> -';
  aiInsightsStrategy.innerHTML = '<strong>Strategy:</strong> -';
}

// Event listeners
sendButton.addEventListener('click', sendMessage);
resetButton.addEventListener('click', resetConversation);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// Initialize
updateActiveAgent('normal');
messageInput.focus();

