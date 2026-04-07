// ============================================================
// CONFIG
// ============================================================
const PROVIDERS = {
  github_gpt4o_mini: {
    name: 'GPT-4o-mini',
    endpoint: 'https://models.inference.ai.azure.com/chat/completions',
    model: 'gpt-4o-mini',
    header: 'Authorization'
  },
  github_gpt4o: {
    name: 'GPT-4o',
    endpoint: 'https://models.inference.ai.azure.com/chat/completions',
    model: 'gpt-4o',
    header: 'Authorization'
  },
  github_llama: {
    name: 'Llama 3.3 70B',
    endpoint: 'https://models.inference.ai.azure.com/chat/completions',
    model: 'meta-llama-3.3-70b-instruct',
    header: 'Authorization'
  },
  github_mistral: {
    name: 'Mistral Large',
    endpoint: 'https://models.inference.ai.azure.com/chat/completions',
    model: 'Mistral-large-2411',
    header: 'Authorization'
  }
};

// ============================================================
// STATE
// ============================================================
let apiKey = localStorage.getItem('gh_api_key') || '';
let currentProvider = localStorage.getItem('gh_provider') || 'github_gpt4o_mini';
let conversationHistory = [];
let chatSessions = JSON.parse(localStorage.getItem('chat_sessions') || '[]');
let currentSessionIndex = -1;
let isLoading = false;

// ============================================================
// INIT
// ============================================================
window.onload = function() {
  if (apiKey) {
    document.getElementById('api-setup').style.display = 'none';
    updateModelDisplay();
  }
  renderChatList();
  document.getElementById('model-switcher').value = currentProvider;
};

function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  const provider = document.getElementById('provider-select').value;
  if (!key) { alert('من فضلك أدخل الـ API Key'); return; }
  apiKey = key;
  currentProvider = provider;
  localStorage.setItem('gh_api_key', key);
  localStorage.setItem('gh_provider', provider);
  document.getElementById('api-setup').style.display = 'none';
  document.getElementById('model-switcher').value = provider;
  updateModelDisplay();
}

function updateModelDisplay() {
  const p = PROVIDERS[currentProvider];
  document.getElementById('model-name-display').textContent = p.name;
}

function switchModel(val) {
  currentProvider = val;
  localStorage.setItem('gh_provider', val);
  updateModelDisplay();
}

// ============================================================
// CHAT SESSIONS
// ============================================================
function newChat() {
  conversationHistory = [];
  currentSessionIndex = -1;
  document.getElementById('messages').innerHTML = '';
  document.getElementById('messages').style.display = 'none';
  document.getElementById('welcome').style.display = 'flex';
  renderChatList();
}

function renderChatList() {
  const list = document.getElementById('chat-list');
  list.innerHTML = '';
  chatSessions.slice().reverse().forEach((s, i) => {
    const realIdx = chatSessions.length - 1 - i;
    const el = document.createElement('div');
    el.className = 'chat-history-item' + (realIdx === currentSessionIndex ? ' active' : '');
    el.textContent = s.title;
    el.onclick = () => loadSession(realIdx);
    list.appendChild(el);
  });
}

function loadSession(idx) {
  currentSessionIndex = idx;
  const session = chatSessions[idx];
  conversationHistory = [...session.history];
  document.getElementById('welcome').style.display = 'none';
  const msgEl = document.getElementById('messages');
  msgEl.style.display = 'block';
  msgEl.innerHTML = '';
  conversationHistory.forEach(m => {
    appendMessage(m.role, m.content, false);
  });
  renderChatList();
}

function saveSession(title) {
  if (currentSessionIndex === -1) {
    chatSessions.push({ title: title.slice(0, 40), history: [...conversationHistory] });
    currentSessionIndex = chatSessions.length - 1;
  } else {
    chatSessions[currentSessionIndex].history = [...conversationHistory];
  }
  localStorage.setItem('chat_sessions', JSON.stringify(chatSessions));
  renderChatList();
}

// ============================================================
// MESSAGES UI
// ============================================================
function appendMessage(role, content, animate = true) {
  const welcome = document.getElementById('welcome');
  const messages = document.getElementById('messages');
  if (welcome.style.display !== 'none') {
    welcome.style.display = 'none';
    messages.style.display = 'block';
  }

  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  if (!animate) row.style.animation = 'none';

  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`;
  avatar.textContent = role === 'user' ? 'أ' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = formatMessage(content);

  row.appendChild(avatar);
  row.appendChild(bubble);
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

function showTyping() {
  const row = document.createElement('div');
  row.className = 'message-row ai';
  row.id = 'typing-row';

  const avatar = document.createElement('div');
  avatar.className = 'avatar ai';
  avatar.textContent = '🤖';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = '<div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';

  row.appendChild(avatar);
  row.appendChild(bubble);
  document.getElementById('messages').appendChild(row);
  document.getElementById('messages').scrollTop = 99999;
  return row;
}

function formatMessage(text) {
  // Basic markdown-like formatting
  text = text.replace(/```(\w+)?\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  lines.forEach(line => {
    if (line.startsWith('- ') || line.startsWith('• ')) {
      if (!inList) { html += '<ul style="padding-right:20px;margin:8px 0;">'; inList = true; }
      html += `<li>${line.slice(2)}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (line.trim()) html += `<p>${line}</p>`;
    }
  });
  if (inList) html += '</ul>';
  return html || `<p>${text}</p>`;
}

// ============================================================
// API CALL
// ============================================================
async function callAPI(messages) {
  const provider = PROVIDERS[currentProvider];
  const response = await fetch(provider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [provider.header]: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      messages: messages,
      max_tokens: 1024,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ============================================================
// SEND
// ============================================================
async function sendMessage() {
  if (isLoading) return;
  const input = document.getElementById('user-input');
  const text = input.value.trim();
  if (!text) return;
  if (!apiKey) { document.getElementById('api-setup').style.display = 'flex'; return; }

  isLoading = true;
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('send-btn').disabled = true;

  conversationHistory.push({ role: 'user', content: text });
  appendMessage('user', text);

  const typingRow = showTyping();

  try {
    const reply = await callAPI(conversationHistory.map(m => ({ role: m.role, content: m.content })));
    typingRow.remove();
    conversationHistory.push({ role: 'assistant', content: reply });
    appendMessage('assistant', reply);

    const title = text.slice(0, 40) + (text.length > 40 ? '...' : '');
    saveSession(title);
  } catch (err) {
    typingRow.remove();
    appendMessage('assistant', `❌ خطأ: ${err.message}\n\nتأكد من:\n- صحة الـ API Key\n- تفعيل GitHub Models\n- الاتصال بالإنترنت`);
  } finally {
    isLoading = false;
    document.getElementById('send-btn').disabled = false;
    input.focus();
  }
}

function sendSuggestion(text) {
  document.getElementById('user-input').value = text;
  sendMessage();
}

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}