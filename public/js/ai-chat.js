/**
 * ai-chat.js — Husk & Co. AI Chatbot Widget
 * Floating chatbot powered by Gemini AI
 * Features: multi-turn chat, product search, health FAQ, order lookup
 */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  let isOpen = false;
  let isTyping = false;
  let chatHistory = [];
  let currentMode = 'chat'; // chat | search | recommend | order | health

  // ── CSS ────────────────────────────────────────────────────
  const CSS = `
    #husk-ai-widget * { box-sizing: border-box; margin: 0; padding: 0; }
    
    #husk-ai-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 9999;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, #2e6b4f 0%, #4a9e72 100%);
      border: none; cursor: pointer;
      box-shadow: 0 8px 32px rgba(46,107,79,0.45), 0 2px 8px rgba(0,0,0,0.2);
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.3s cubic-bezier(.34,1.56,.64,1), box-shadow 0.3s;
      color: white; font-size: 26px;
    }
    #husk-ai-fab:hover {
      transform: scale(1.1) rotate(-8deg);
      box-shadow: 0 12px 40px rgba(46,107,79,0.55);
    }
    #husk-ai-fab .fab-badge {
      position: absolute; top: -4px; right: -4px;
      width: 18px; height: 18px; border-radius: 50%;
      background: #f59e0b; color: white; font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid white; animation: pulse-badge 2s infinite;
    }
    @keyframes pulse-badge {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.2); }
    }

    #husk-ai-panel {
      position: fixed; bottom: 100px; right: 28px; z-index: 9998;
      width: 380px; height: 560px;
      background: #0d1f17;
      border: 1px solid rgba(74,158,114,0.25);
      border-radius: 20px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(74,158,114,0.1);
      display: flex; flex-direction: column; overflow: hidden;
      transform: scale(0.85) translateY(20px); opacity: 0;
      pointer-events: none;
      transition: transform 0.35s cubic-bezier(.34,1.56,.64,1), opacity 0.25s ease;
      font-family: 'DM Sans', 'Manrope', -apple-system, sans-serif;
    }
    #husk-ai-panel.open {
      transform: scale(1) translateY(0); opacity: 1; pointer-events: all;
    }
    @media (max-width: 440px) {
      #husk-ai-panel { width: calc(100vw - 24px); right: 12px; bottom: 90px; height: 70vh; }
      #husk-ai-fab { bottom: 20px; right: 16px; }
    }

    /* Header */
    .ai-header {
      padding: 16px 18px 14px;
      background: linear-gradient(135deg, #1a3d28 0%, #1f4a32 100%);
      border-bottom: 1px solid rgba(74,158,114,0.15);
      display: flex; align-items: center; gap: 12px;
    }
    .ai-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, #2e6b4f, #4a9e72);
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(46,107,79,0.4);
    }
    .ai-header-info { flex: 1; }
    .ai-header-name {
      font-size: 14px; font-weight: 600; color: #e8f5ee; letter-spacing: 0.3px;
    }
    .ai-header-status {
      font-size: 11px; color: #4a9e72; display: flex; align-items: center; gap: 4px;
      margin-top: 2px;
    }
    .ai-status-dot {
      width: 6px; height: 6px; border-radius: 50%; background: #4a9e72;
      animation: pulse-dot 2s infinite;
    }
    @keyframes pulse-dot {
      0%, 100% { opacity: 1; } 50% { opacity: 0.4; }
    }
    .ai-header-close {
      background: none; border: none; cursor: pointer; color: #8fac9b;
      padding: 4px; border-radius: 6px; display: flex;
      transition: color 0.2s, background 0.2s;
    }
    .ai-header-close:hover { color: #e8f5ee; background: rgba(255,255,255,0.08); }

    /* Mode tabs */
    .ai-modes {
      display: flex; gap: 4px; padding: 10px 12px 8px;
      background: #0d1f17; border-bottom: 1px solid rgba(74,158,114,0.1);
      overflow-x: auto; scrollbar-width: none;
    }
    .ai-modes::-webkit-scrollbar { display: none; }
    .ai-mode-btn {
      flex-shrink: 0; padding: 5px 11px; border-radius: 20px;
      border: 1px solid rgba(74,158,114,0.2); background: transparent;
      color: #8fac9b; font-size: 11px; font-weight: 500; cursor: pointer;
      transition: all 0.2s; white-space: nowrap;
    }
    .ai-mode-btn:hover { border-color: #4a9e72; color: #4a9e72; }
    .ai-mode-btn.active {
      background: linear-gradient(135deg, #2e6b4f, #4a9e72);
      border-color: transparent; color: white; font-weight: 600;
    }

    /* Messages */
    .ai-messages {
      flex: 1; overflow-y: auto; padding: 14px 14px 8px;
      display: flex; flex-direction: column; gap: 10px;
      scrollbar-width: thin; scrollbar-color: rgba(74,158,114,0.2) transparent;
    }
    .ai-messages::-webkit-scrollbar { width: 4px; }
    .ai-messages::-webkit-scrollbar-thumb { background: rgba(74,158,114,0.25); border-radius: 4px; }

    .msg {
      max-width: 86%; display: flex; flex-direction: column; gap: 3px;
      animation: msg-in 0.3s cubic-bezier(.34,1.56,.64,1);
    }
    @keyframes msg-in {
      from { opacity: 0; transform: translateY(10px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .msg.user { align-self: flex-end; align-items: flex-end; }
    .msg.bot { align-self: flex-start; align-items: flex-start; }

    .msg-bubble {
      padding: 10px 14px; border-radius: 16px; font-size: 13.5px;
      line-height: 1.55; word-break: break-word;
    }
    .msg.user .msg-bubble {
      background: linear-gradient(135deg, #2e6b4f, #3a8560);
      color: white; border-radius: 16px 16px 4px 16px;
    }
    .msg.bot .msg-bubble {
      background: rgba(74,158,114,0.1); color: #d4ead9;
      border: 1px solid rgba(74,158,114,0.15);
      border-radius: 16px 16px 16px 4px;
    }
    .msg-time {
      font-size: 10px; color: rgba(143,172,155,0.5); padding: 0 4px;
    }

    /* Product cards in chat */
    .ai-product-cards { display: flex; flex-direction: column; gap: 8px; max-width: 90%; }
    .ai-product-card {
      background: rgba(74,158,114,0.07);
      border: 1px solid rgba(74,158,114,0.2);
      border-radius: 12px; padding: 12px 14px;
      cursor: pointer; transition: all 0.2s;
      animation: msg-in 0.35s cubic-bezier(.34,1.56,.64,1);
    }
    .ai-product-card:hover {
      background: rgba(74,158,114,0.15); border-color: rgba(74,158,114,0.4);
      transform: translateY(-1px);
    }
    .ai-product-card-name { font-size: 13px; font-weight: 600; color: #e8f5ee; }
    .ai-product-card-price { font-size: 12px; color: #4a9e72; margin-top: 2px; }
    .ai-product-card-reason { font-size: 11.5px; color: #8fac9b; margin-top: 4px; line-height: 1.45; }
    .ai-product-card-btn {
      margin-top: 8px; padding: 5px 12px; background: linear-gradient(135deg, #2e6b4f, #4a9e72);
      color: white; border: none; border-radius: 8px; font-size: 11px;
      font-weight: 600; cursor: pointer; transition: opacity 0.2s;
    }
    .ai-product-card-btn:hover { opacity: 0.85; }

    /* Typing indicator */
    .typing-indicator {
      align-self: flex-start; padding: 10px 16px;
      background: rgba(74,158,114,0.1);
      border: 1px solid rgba(74,158,114,0.15);
      border-radius: 16px 16px 16px 4px;
      display: flex; gap: 4px; align-items: center;
      animation: msg-in 0.3s ease;
    }
    .typing-indicator span {
      width: 6px; height: 6px; background: #4a9e72; border-radius: 50%;
      animation: typing-bounce 1.4s infinite;
    }
    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing-bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
      40% { transform: translateY(-5px); opacity: 1; }
    }

    /* Quick prompts */
    .ai-quick-prompts {
      padding: 6px 12px 10px; display: flex; flex-wrap: wrap; gap: 6px;
    }
    .ai-quick-btn {
      padding: 5px 11px; border-radius: 16px;
      border: 1px solid rgba(74,158,114,0.25); background: transparent;
      color: #8fac9b; font-size: 11px; cursor: pointer;
      transition: all 0.2s; font-family: inherit;
    }
    .ai-quick-btn:hover { border-color: #4a9e72; color: #4a9e72; background: rgba(74,158,114,0.05); }

    /* Input area */
    .ai-input-area {
      padding: 10px 12px 14px;
      background: rgba(13,31,23,0.95);
      border-top: 1px solid rgba(74,158,114,0.12);
      display: flex; gap: 8px; align-items: flex-end;
    }
    .ai-input {
      flex: 1; background: rgba(74,158,114,0.08);
      border: 1px solid rgba(74,158,114,0.2); border-radius: 14px;
      padding: 10px 14px; color: #e8f5ee; font-size: 13.5px;
      font-family: inherit; resize: none; min-height: 42px; max-height: 100px;
      outline: none; transition: border-color 0.2s;
      line-height: 1.4;
    }
    .ai-input::placeholder { color: rgba(143,172,155,0.5); }
    .ai-input:focus { border-color: rgba(74,158,114,0.5); }
    .ai-send-btn {
      width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0;
      background: linear-gradient(135deg, #2e6b4f, #4a9e72);
      border: none; cursor: pointer; color: white;
      display: flex; align-items: center; justify-content: center;
      transition: opacity 0.2s, transform 0.15s;
    }
    .ai-send-btn:hover { opacity: 0.85; transform: scale(1.05); }
    .ai-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }

    /* Order lookup form */
    .ai-order-form { max-width: 92%; display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
    .ai-order-input {
      background: rgba(74,158,114,0.08); border: 1px solid rgba(74,158,114,0.25);
      border-radius: 10px; padding: 9px 13px; color: #e8f5ee; font-size: 13px;
      font-family: inherit; outline: none; transition: border-color 0.2s; width: 100%;
    }
    .ai-order-input:focus { border-color: rgba(74,158,114,0.5); }
    .ai-order-input::placeholder { color: rgba(143,172,155,0.5); }
    .ai-submit-btn {
      padding: 9px 18px; background: linear-gradient(135deg, #2e6b4f, #4a9e72);
      color: white; border: none; border-radius: 10px; font-size: 12px;
      font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity 0.2s; align-self: flex-start;
    }
    .ai-submit-btn:hover { opacity: 0.85; }

    /* Powered by */
    .ai-powered {
      text-align: center; padding: 4px 0 8px;
      font-size: 10px; color: rgba(143,172,155,0.35);
      letter-spacing: 0.5px;
    }
  `;

  // ── Mode definitions ────────────────────────────────────────
  const MODES = [
    { id: 'chat', label: '💬 Chat', placeholder: 'Ask me anything…' },
    { id: 'search', label: '🔍 Search', placeholder: 'Search products naturally…' },
    { id: 'recommend', label: '✨ Recommend', placeholder: 'What\'s your health goal?' },
    { id: 'order', label: '📦 My Order', placeholder: 'Enter your Order ID…' },
    { id: 'health', label: '🌿 Health FAQ', placeholder: 'Ask a health question…' },
  ];

  const QUICK_PROMPTS = {
    chat: ['What is psyllium husk?', 'How do I take it?', 'Is it safe daily?'],
    search: ['good for digestion', 'morning routine', 'weight management', 'no sugar'],
    recommend: ['improve gut health', 'lose weight', 'reduce cholesterol'],
    order: [],
    health: ['Does it help with weight loss?', 'Can diabetics take it?', 'Side effects?'],
  };

  const WELCOME_MESSAGES = {
    chat: 'Hi! I\'m Husk 🌿 Your AI wellness assistant. I can help with products, usage, health questions, and orders. What can I help you with?',
    search: 'Search our products naturally! Try: "something good for digestion" or "morning routine blend"',
    recommend: 'Tell me your health goal and I\'ll recommend the perfect blend for you! 🌿',
    order: 'I can help track your order! Enter your Order ID below (format: HK-XXXXXXXX-XXXXXX)',
    health: 'Ask me any health question about psyllium husk and gut wellness. I\'ll give you science-backed answers! 🔬',
  };

  // ── Build DOM ───────────────────────────────────────────────
  function buildWidget() {
    // Inject styles
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Create container
    const container = document.createElement('div');
    container.id = 'husk-ai-widget';

    // FAB button
    container.innerHTML = `
      <button id="husk-ai-fab" aria-label="Open AI wellness assistant" title="Chat with Husk AI">
        🌿
        <span class="fab-badge" id="fab-badge">AI</span>
      </button>

      <div id="husk-ai-panel" role="dialog" aria-label="Husk AI Assistant">
        <div class="ai-header">
          <div class="ai-avatar">🌿</div>
          <div class="ai-header-info">
            <div class="ai-header-name">Husk AI Assistant</div>
            <div class="ai-header-status">
              <span class="ai-status-dot"></span>
              Online · Powered by Gemini
            </div>
          </div>
          <button class="ai-header-close" id="ai-close-btn" aria-label="Close chat">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="ai-modes" id="ai-modes">
          ${MODES.map(m => `
            <button class="ai-mode-btn${m.id === 'chat' ? ' active' : ''}" 
                    data-mode="${m.id}" aria-label="Switch to ${m.label} mode">
              ${m.label}
            </button>
          `).join('')}
        </div>

        <div class="ai-messages" id="ai-messages"></div>

        <div class="ai-quick-prompts" id="ai-quick-prompts"></div>

        <div class="ai-input-area">
          <textarea class="ai-input" id="ai-input" rows="1"
            placeholder="Ask me anything…"
            aria-label="Chat message input"></textarea>
          <button class="ai-send-btn" id="ai-send-btn" aria-label="Send message">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <div class="ai-powered">Powered by Google Gemini · Husk & Co.</div>
      </div>
    `;

    document.body.appendChild(container);
    bindEvents();
    setMode('chat');
  }

  // ── Events ──────────────────────────────────────────────────
  function bindEvents() {
    const fab = document.getElementById('husk-ai-fab');
    const panel = document.getElementById('husk-ai-panel');
    const closeBtn = document.getElementById('ai-close-btn');
    const sendBtn = document.getElementById('ai-send-btn');
    const input = document.getElementById('ai-input');
    const modeBar = document.getElementById('ai-modes');

    fab.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    sendBtn.addEventListener('click', handleSend);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    });
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    });

    modeBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-mode-btn');
      if (btn) setMode(btn.dataset.mode);
    });

    document.getElementById('ai-quick-prompts').addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-quick-btn');
      if (btn) {
        input.value = btn.textContent;
        handleSend();
      }
    });
  }

  function toggleChat() {
    isOpen = !isOpen;
    const panel = document.getElementById('husk-ai-panel');
    const badge = document.getElementById('fab-badge');
    panel.classList.toggle('open', isOpen);
    if (isOpen) { badge.style.display = 'none'; document.getElementById('ai-input').focus(); }
  }

  function setMode(mode) {
    currentMode = mode;
    chatHistory = [];

    // Update mode buttons
    document.querySelectorAll('.ai-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    // Update placeholder
    const modeData = MODES.find(m => m.id === mode);
    document.getElementById('ai-input').placeholder = modeData?.placeholder || 'Ask me anything…';

    // Clear messages and show welcome
    const msgs = document.getElementById('ai-messages');
    msgs.innerHTML = '';
    appendBotMsg(WELCOME_MESSAGES[mode] || WELCOME_MESSAGES.chat);

    // Show special UI for order mode
    if (mode === 'order') {
      appendOrderForm();
    }

    // Update quick prompts
    renderQuickPrompts(QUICK_PROMPTS[mode] || []);
  }

  // ── Message rendering ───────────────────────────────────────
  function appendUserMsg(text) {
    const msgs = document.getElementById('ai-messages');
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = 'msg user';
    div.innerHTML = `<div class="msg-bubble">${escHtml(text)}</div><div class="msg-time">${time}</div>`;
    msgs.appendChild(div);
    scrollBottom();
  }

  function appendBotMsg(text) {
    const msgs = document.getElementById('ai-messages');
    const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = 'msg bot';
    div.innerHTML = `<div class="msg-bubble">${formatBotText(text)}</div><div class="msg-time">${time}</div>`;
    msgs.appendChild(div);
    scrollBottom();
    return div;
  }

  function appendProductCards(products) {
    const msgs = document.getElementById('ai-messages');
    const container = document.createElement('div');
    container.className = 'ai-product-cards';
    products.forEach(p => {
      const card = document.createElement('div');
      card.className = 'ai-product-card';
      const name = p.name || p.id || 'Product';
      const price = p.price ? `₹${p.price}` : '';
      const reason = p.relevance || p.description || '';
      card.innerHTML = `
        <div class="ai-product-card-name">${escHtml(name)}</div>
        ${price ? `<div class="ai-product-card-price">${price}</div>` : ''}
        ${reason ? `<div class="ai-product-card-reason">${escHtml(reason)}</div>` : ''}
        <button class="ai-product-card-btn" data-id="${escHtml(p.id || '')}">Add to Cart →</button>
      `;
      card.querySelector('.ai-product-card-btn').addEventListener('click', () => {
        // Trigger existing add-to-cart if available
        const existingBtn = document.querySelector(`.add-to-cart[data-id="${p.id}"]`);
        if (existingBtn) { existingBtn.click(); appendBotMsg(`✅ Added ${name} to your cart!`); }
        else { appendBotMsg(`To add ${name} to your cart, please scroll to the Shop section.`); }
      });
      container.appendChild(card);
    });
    msgs.appendChild(container);
    scrollBottom();
  }

  function appendOrderForm() {
    const msgs = document.getElementById('ai-messages');
    const div = document.createElement('div');
    div.className = 'msg bot';
    div.innerHTML = `
      <div class="ai-order-form">
        <input class="ai-order-input" id="ai-order-id-input" placeholder="e.g. HK-67F12345-A3B2C1" />
        <input class="ai-order-input" id="ai-order-msg-input" placeholder="Your question (optional)" />
        <button class="ai-submit-btn" id="ai-order-submit-btn">Track Order →</button>
      </div>
    `;
    msgs.appendChild(div);
    scrollBottom();
    document.getElementById('ai-order-submit-btn').addEventListener('click', handleOrderQuery);
  }

  function showTyping() {
    const msgs = document.getElementById('ai-messages');
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(indicator);
    scrollBottom();
  }

  function hideTyping() {
    const el = document.getElementById('typing-indicator');
    if (el) el.remove();
  }

  function renderQuickPrompts(prompts) {
    const container = document.getElementById('ai-quick-prompts');
    container.innerHTML = prompts.map(p =>
      `<button class="ai-quick-btn" aria-label="Quick prompt: ${escHtml(p)}">${escHtml(p)}</button>`
    ).join('');
  }

  function scrollBottom() {
    const msgs = document.getElementById('ai-messages');
    setTimeout(() => { msgs.scrollTop = msgs.scrollHeight; }, 60);
  }

  // ── Handlers ─────────────────────────────────────────────────
  async function handleSend() {
    const input = document.getElementById('ai-input');
    const text = input.value.trim();
    if (!text || isTyping) return;

    input.value = '';
    input.style.height = 'auto';
    appendUserMsg(text);

    // Route by mode
    switch (currentMode) {
      case 'search':     await handleSearch(text); break;
      case 'recommend':  await handleRecommend(text); break;
      case 'health':     await handleHealthFAQ(text); break;
      case 'order':      await handleOrderQuery(text); break;
      default:           await handleChat(text); break;
    }
  }

  async function handleChat(message) {
    setLoading(true);
    showTyping();
    try {
      const res = await apiFetch('/api/ai/chat', {
        message,
        history: chatHistory,
      });
      chatHistory.push({ role: 'user', parts: message });
      chatHistory.push({ role: 'model', parts: res.reply });
      if (chatHistory.length > 40) chatHistory = chatHistory.slice(-40);
      appendBotMsg(res.reply);
    } catch (e) {
      appendBotMsg('Sorry, I\'m having trouble connecting. Please try again!');
    } finally {
      hideTyping();
      setLoading(false);
    }
  }

  async function handleSearch(query) {
    setLoading(true);
    showTyping();
    try {
      const res = await apiFetch('/api/ai/search', { query });
      if (res.results && res.results.length > 0) {
        appendBotMsg(`Found ${res.results.length} products for "${escHtml(query)}":`);
        appendProductCards(res.results);
      } else {
        appendBotMsg('No matching products found. Try a different search term!');
      }
    } catch (e) {
      appendBotMsg('Search is unavailable right now. Please try again!');
    } finally {
      hideTyping();
      setLoading(false);
    }
  }

  async function handleRecommend(goal) {
    setLoading(true);
    showTyping();
    try {
      const res = await apiFetch('/api/ai/recommend', { goal, preferences: '' });
      if (res.reasoning) appendBotMsg(res.reasoning);
      if (res.tip) appendBotMsg(`💡 Tip: ${res.tip}`);
      if (res.recommendations && res.recommendations.length > 0) {
        const products = res.recommendations.map(id => ({ id, ...getLocalProduct(id) }));
        appendProductCards(products);
      }
    } catch (e) {
      appendBotMsg('I\'m unable to generate recommendations right now. Please try again!');
    } finally {
      hideTyping();
      setLoading(false);
    }
  }

  async function handleHealthFAQ(question) {
    setLoading(true);
    showTyping();
    try {
      const res = await apiFetch('/api/ai/health-faq', { question });
      appendBotMsg(res.answer);
      if (res.disclaimer) appendBotMsg(`⚕️ ${res.disclaimer}`);
      if (res.related_products && res.related_products.length > 0) {
        const products = res.related_products.map(id => ({ id, ...getLocalProduct(id) }));
        if (products.length > 0) {
          appendBotMsg('Related products you might like:');
          appendProductCards(products);
        }
      }
    } catch (e) {
      appendBotMsg('Unable to answer right now. Please try again!');
    } finally {
      hideTyping();
      setLoading(false);
    }
  }

  async function handleOrderQuery(msgOrEvent) {
    const orderId = (document.getElementById('ai-order-id-input')?.value || '').trim();
    const userMsg = typeof msgOrEvent === 'string' ? msgOrEvent
      : (document.getElementById('ai-order-msg-input')?.value || 'Where is my order?').trim();

    if (!orderId && !userMsg) { appendBotMsg('Please enter your Order ID (format: HK-XXXXXXXX-XXXXXX)'); return; }

    setLoading(true);
    showTyping();
    try {
      const res = await apiFetch('/api/ai/order-query', {
        message: userMsg || `What is the status of order ${orderId}?`,
        order_id: orderId || null,
      });
      appendBotMsg(res.reply);
      if (res.order_status) appendBotMsg(`📦 Current status: **${res.order_status}**`);
    } catch (e) {
      appendBotMsg('Unable to look up your order. Please contact support@huskandco.in');
    } finally {
      hideTyping();
      setLoading(false);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────
  function setLoading(loading) {
    isTyping = loading;
    const btn = document.getElementById('ai-send-btn');
    if (btn) btn.disabled = loading;
  }

  async function apiFetch(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function getLocalProduct(id) {
    // Try to get data from existing page product cards
    const btn = document.querySelector(`.add-to-cart[data-id="${id}"]`);
    if (btn) {
      return {
        name: btn.dataset.name || id,
        price: parseInt(btn.dataset.price) || null,
      };
    }
    const PRICES = { chocolate: 899, unflavored: 749, 'cheese-berry': 999, 'honey-black-pepper': 949 };
    const NAMES = { chocolate: 'Organic Chocolate', unflavored: 'Pure Unflavored', 'cheese-berry': 'Cheese Berry', 'honey-black-pepper': 'Honey Black Pepper' };
    return { name: NAMES[id] || id, price: PRICES[id] || null };
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatBotText(text) {
    // Basic markdown-like formatting
    return escHtml(text)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  // ── Init ─────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildWidget);
  } else {
    buildWidget();
  }

})();
