/**
 * admin-ai.js — Husk & Co. Admin AI Tools Panel
 * Features: Review Summarizer, Product Description Generator, Content Generator
 */

(function () {
  'use strict';

  // ── CSS ─────────────────────────────────────────────────────
  const CSS = `
    .ai-panel {
      background: linear-gradient(135deg, rgba(46,107,79,0.08) 0%, rgba(13,31,23,0.6) 100%);
      border: 1px solid rgba(74,158,114,0.2);
      border-radius: 16px; padding: 28px;
      margin: 24px 0;
    }
    .ai-panel-header {
      display: flex; align-items: center; gap: 12px; margin-bottom: 24px;
    }
    .ai-panel-icon {
      width: 44px; height: 44px; border-radius: 12px;
      background: linear-gradient(135deg, #2e6b4f, #4a9e72);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; box-shadow: 0 4px 16px rgba(46,107,79,0.35);
    }
    .ai-panel-title { font-size: 18px; font-weight: 700; color: #e8f5ee; }
    .ai-panel-subtitle { font-size: 12px; color: #8fac9b; margin-top: 2px; }

    .ai-tools-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    .ai-tool-card {
      background: rgba(13,31,23,0.7); border: 1px solid rgba(74,158,114,0.15);
      border-radius: 14px; padding: 20px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .ai-tool-card:hover { border-color: rgba(74,158,114,0.3); box-shadow: 0 4px 24px rgba(46,107,79,0.12); }
    .ai-tool-card-title {
      font-size: 14px; font-weight: 600; color: #e8f5ee; margin-bottom: 6px;
      display: flex; align-items: center; gap: 8px;
    }
    .ai-tool-card p { font-size: 12px; color: #8fac9b; line-height: 1.5; margin-bottom: 16px; }

    .ai-form-group { margin-bottom: 12px; }
    .ai-form-label { font-size: 11px; color: #8fac9b; font-weight: 500; margin-bottom: 5px; display: block; }
    .ai-form-input, .ai-form-select, .ai-form-textarea {
      width: 100%; background: rgba(74,158,114,0.07);
      border: 1px solid rgba(74,158,114,0.2); border-radius: 10px;
      padding: 9px 13px; color: #e8f5ee; font-size: 13px;
      font-family: inherit; outline: none; transition: border-color 0.2s;
    }
    .ai-form-input:focus, .ai-form-select:focus, .ai-form-textarea:focus {
      border-color: rgba(74,158,114,0.5);
    }
    .ai-form-input::placeholder, .ai-form-textarea::placeholder { color: rgba(143,172,155,0.4); }
    .ai-form-select option { background: #0d1f17; }
    .ai-form-textarea { resize: vertical; min-height: 80px; }

    .ai-run-btn {
      width: 100%; padding: 10px; border-radius: 10px;
      background: linear-gradient(135deg, #2e6b4f, #4a9e72);
      color: white; border: none; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: opacity 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .ai-run-btn:hover { opacity: 0.85; }
    .ai-run-btn:disabled { opacity: 0.45; cursor: not-allowed; }
    .ai-run-btn .spinner {
      width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white; border-radius: 50%;
      animation: spin 0.7s linear infinite; display: none;
    }
    .ai-run-btn.loading .spinner { display: block; }
    .ai-run-btn.loading .btn-text { display: none; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .ai-result-box {
      margin-top: 14px; background: rgba(74,158,114,0.05);
      border: 1px solid rgba(74,158,114,0.15); border-radius: 10px;
      padding: 14px; display: none;
    }
    .ai-result-box.show { display: block; animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; } }
    .ai-result-label {
      font-size: 10px; color: #4a9e72; font-weight: 600; letter-spacing: 0.8px;
      text-transform: uppercase; margin-bottom: 8px;
    }
    .ai-result-text {
      font-size: 13px; color: #d4ead9; line-height: 1.65; white-space: pre-wrap;
    }
    .ai-result-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .ai-result-tag {
      padding: 3px 10px; background: rgba(74,158,114,0.12);
      border: 1px solid rgba(74,158,114,0.2); border-radius: 16px;
      font-size: 11px; color: #8fac9b;
    }
    .ai-result-copy-btn {
      margin-top: 10px; padding: 5px 12px; background: transparent;
      border: 1px solid rgba(74,158,114,0.3); border-radius: 8px;
      color: #8fac9b; font-size: 11px; cursor: pointer; font-family: inherit;
      transition: all 0.2s;
    }
    .ai-result-copy-btn:hover { border-color: #4a9e72; color: #4a9e72; }

    .ai-sentiment-bar {
      height: 6px; background: rgba(74,158,114,0.1); border-radius: 3px;
      overflow: hidden; margin: 8px 0;
    }
    .ai-sentiment-fill {
      height: 100%; border-radius: 3px;
      transition: width 0.6s cubic-bezier(.34,1.56,.64,1);
    }
    .ai-sentiment-positive .ai-sentiment-fill { background: linear-gradient(90deg, #2e6b4f, #4a9e72); }
    .ai-sentiment-mixed .ai-sentiment-fill { background: linear-gradient(90deg, #b45309, #f59e0b); }
    .ai-sentiment-negative .ai-sentiment-fill { background: linear-gradient(90deg, #7f1d1d, #ef4444); }

    .ai-status-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600;
      background: rgba(74,158,114,0.15); color: #4a9e72;
      border: 1px solid rgba(74,158,114,0.25);
    }
    .ai-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #4a9e72; }
  `;

  const PRODUCTS = {
    chocolate: 'Organic Chocolate',
    unflavored: 'Pure Unflavored',
    'cheese-berry': 'Cheese Berry',
    'honey-black-pepper': 'Honey Black Pepper',
  };

  // ── Build Panel ──────────────────────────────────────────────
  function buildPanel() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Find a good place to inject — after the products section or at end of dashboard
    const dashboard = document.querySelector('.dashboard') || document.querySelector('main') || document.body;

    const panel = document.createElement('div');
    panel.id = 'admin-ai-panel';
    panel.className = 'ai-panel';
    panel.innerHTML = `
      <div class="ai-panel-header">
        <div class="ai-panel-icon">🤖</div>
        <div>
          <div class="ai-panel-title">AI Tools — Powered by Gemini</div>
          <div class="ai-panel-subtitle">Content generation, review analysis & product copy for Husk & Co.</div>
        </div>
        <div style="margin-left:auto;">
          <div class="ai-status-badge"><span class="ai-status-dot"></span> Gemini Active</div>
        </div>
      </div>

      <div class="ai-tools-grid">

        <!-- Tool 1: Review Summarizer -->
        <div class="ai-tool-card">
          <div class="ai-tool-card-title">📊 Review Summarizer</div>
          <p>Paste customer reviews and get an AI-generated sentiment analysis with key themes.</p>
          <div class="ai-form-group">
            <label class="ai-form-label">Product</label>
            <select class="ai-form-select" id="ai-review-product">
              ${Object.entries(PRODUCTS).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}
            </select>
          </div>
          <div class="ai-form-group">
            <label class="ai-form-label">Customer Reviews (one per line)</label>
            <textarea class="ai-form-textarea" id="ai-review-text" 
              placeholder="Great taste, really helped my digestion&#10;Love the chocolate flavor&#10;Shipping was fast..."></textarea>
          </div>
          <button class="ai-run-btn" id="ai-review-btn" onclick="window.adminAI.summarizeReviews()">
            <div class="spinner"></div>
            <span class="btn-text">📊 Analyze Reviews</span>
          </button>
          <div class="ai-result-box" id="ai-review-result">
            <div class="ai-result-label">AI Sentiment Analysis</div>
            <div class="ai-sentiment-bar" id="ai-sentiment-bar"><div class="ai-sentiment-fill" id="ai-sentiment-fill"></div></div>
            <div class="ai-result-text" id="ai-review-text-output"></div>
            <div class="ai-result-tags" id="ai-review-tags"></div>
            <button class="ai-result-copy-btn" onclick="window.adminAI.copy('ai-review-text-output')">📋 Copy</button>
          </div>
        </div>

        <!-- Tool 2: Product Description Generator -->
        <div class="ai-tool-card">
          <div class="ai-tool-card-title">✍️ Description Generator</div>
          <p>Generate premium marketing copy and taglines for any product in seconds.</p>
          <div class="ai-form-group">
            <label class="ai-form-label">Product</label>
            <select class="ai-form-select" id="ai-desc-product">
              ${Object.entries(PRODUCTS).map(([id, name]) => `<option value="${id}">${name}</option>`).join('')}
            </select>
          </div>
          <div class="ai-form-group">
            <label class="ai-form-label">Tone</label>
            <select class="ai-form-select" id="ai-desc-tone">
              <option value="premium">Premium / Luxury</option>
              <option value="friendly">Friendly / Casual</option>
              <option value="scientific">Scientific / Clinical</option>
            </select>
          </div>
          <div class="ai-form-group">
            <label class="ai-form-label">Length</label>
            <select class="ai-form-select" id="ai-desc-length">
              <option value="short">Short (2-3 sentences)</option>
              <option value="medium">Medium (1 paragraph)</option>
              <option value="long">Long (2 paragraphs)</option>
            </select>
          </div>
          <button class="ai-run-btn" id="ai-desc-btn" onclick="window.adminAI.generateDescription()">
            <div class="spinner"></div>
            <span class="btn-text">✨ Generate Copy</span>
          </button>
          <div class="ai-result-box" id="ai-desc-result">
            <div class="ai-result-label">Generated Copy</div>
            <div style="font-size:15px;font-weight:600;color:#4a9e72;margin-bottom:8px;" id="ai-desc-tagline"></div>
            <div class="ai-result-text" id="ai-desc-text-output"></div>
            <div class="ai-result-tags" id="ai-desc-keywords"></div>
            <button class="ai-result-copy-btn" onclick="window.adminAI.copy('ai-desc-text-output')">📋 Copy</button>
          </div>
        </div>

        <!-- Tool 3: Content Generator -->
        <div class="ai-tool-card">
          <div class="ai-tool-card-title">📝 Content Generator</div>
          <p>Generate blog posts, email campaigns, social media posts, and WhatsApp broadcasts.</p>
          <div class="ai-form-group">
            <label class="ai-form-label">Content Type</label>
            <select class="ai-form-select" id="ai-content-type">
              <option value="blog">Blog Post</option>
              <option value="email">Email Campaign</option>
              <option value="social">Social Media (IG + Twitter + LinkedIn)</option>
              <option value="whatsapp">WhatsApp Broadcast</option>
              <option value="ad_copy">Ad Copy (Google Ads)</option>
            </select>
          </div>
          <div class="ai-form-group">
            <label class="ai-form-label">Topic / Focus</label>
            <input class="ai-form-input" id="ai-content-topic" 
              placeholder="e.g. Benefits of psyllium husk for gut health" />
          </div>
          <div class="ai-form-group">
            <label class="ai-form-label">Tone</label>
            <select class="ai-form-select" id="ai-content-tone">
              <option value="professional">Professional</option>
              <option value="friendly">Friendly / Casual</option>
              <option value="luxury">Luxury / Premium</option>
              <option value="scientific">Scientific</option>
            </select>
          </div>
          <button class="ai-run-btn" id="ai-content-btn" onclick="window.adminAI.generateContent()">
            <div class="spinner"></div>
            <span class="btn-text">📝 Generate Content</span>
          </button>
          <div class="ai-result-box" id="ai-content-result">
            <div class="ai-result-label">Generated Content</div>
            <div style="font-size:14px;font-weight:600;color:#4a9e72;margin-bottom:8px;" id="ai-content-title-output"></div>
            <div class="ai-result-text" id="ai-content-text-output"></div>
            <div style="font-size:11px;color:#8fac9b;margin-top:8px;" id="ai-content-wordcount"></div>
            <button class="ai-result-copy-btn" onclick="window.adminAI.copy('ai-content-text-output')">📋 Copy</button>
          </div>
        </div>

      </div>
    `;

    // Insert before the last child of dashboard, or at end
    dashboard.appendChild(panel);
  }

  // ── API calls ────────────────────────────────────────────────
  async function apiFetch(url, body) {
    const token = localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
  }

  function showResult(resultId) {
    const el = document.getElementById(resultId);
    if (el) el.classList.add('show');
  }

  function showError(msg) {
    // Use existing admin toast/alert if available
    if (window.showToast) window.showToast(msg, 'error');
    else alert(`AI Error: ${msg}`);
  }

  // ── Tool implementations ──────────────────────────────────────

  async function summarizeReviews() {
    const product = document.getElementById('ai-review-product').value;
    const rawReviews = document.getElementById('ai-review-text').value.trim();
    if (!rawReviews) { showError('Please paste some reviews first.'); return; }

    const reviews = rawReviews.split('\n').map(r => r.trim()).filter(Boolean);

    setLoading('ai-review-btn', true);
    try {
      const res = await apiFetch('/api/ai/admin/summarize-reviews', { product_id: product, reviews });

      document.getElementById('ai-review-text-output').textContent =
        `${res.summary}\n\nSentiment Score: ${res.sentiment_score || '?'}/10\n\n` +
        (res.improvement ? `Improvement suggestion: ${res.improvement}` : '');

      // Sentiment bar
      const bar = document.getElementById('ai-sentiment-bar');
      const fill = document.getElementById('ai-sentiment-fill');
      bar.className = 'ai-sentiment-bar ai-sentiment-' + (res.sentiment || 'positive');
      fill.style.width = ((res.sentiment_score || 7) * 10) + '%';

      // Highlights as tags
      const tagsEl = document.getElementById('ai-review-tags');
      tagsEl.innerHTML = (res.highlights || []).map(h => `<span class="ai-result-tag">${h}</span>`).join('');

      showResult('ai-review-result');
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading('ai-review-btn', false);
    }
  }

  async function generateDescription() {
    const product = document.getElementById('ai-desc-product').value;
    const tone = document.getElementById('ai-desc-tone').value;
    const length = document.getElementById('ai-desc-length').value;

    setLoading('ai-desc-btn', true);
    try {
      const res = await apiFetch('/api/ai/admin/generate-description', { product_id: product, tone, length });

      document.getElementById('ai-desc-tagline').textContent = res.tagline ? `"${res.tagline}"` : '';
      document.getElementById('ai-desc-text-output').textContent = res.description || '';

      const kw = document.getElementById('ai-desc-keywords');
      kw.innerHTML = (res.seo_keywords || []).map(k => `<span class="ai-result-tag">#${k}</span>`).join('');

      showResult('ai-desc-result');
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading('ai-desc-btn', false);
    }
  }

  async function generateContent() {
    const contentType = document.getElementById('ai-content-type').value;
    const topic = document.getElementById('ai-content-topic').value.trim();
    const tone = document.getElementById('ai-content-tone').value;

    if (!topic) { showError('Please enter a topic.'); return; }

    setLoading('ai-content-btn', true);
    try {
      const res = await apiFetch('/api/ai/admin/generate-content', { content_type: contentType, topic, tone });

      document.getElementById('ai-content-title-output').textContent = res.title || '';
      document.getElementById('ai-content-text-output').textContent = res.content || '';
      document.getElementById('ai-content-wordcount').textContent =
        res.word_count ? `~${res.word_count} words` : '';

      showResult('ai-content-result');
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading('ai-content-btn', false);
    }
  }

  function copyText(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => {
      if (window.showToast) window.showToast('Copied to clipboard!', 'success');
    });
  }

  // ── Expose API ───────────────────────────────────────────────
  window.adminAI = {
    summarizeReviews,
    generateDescription,
    generateContent,
    copy: copyText,
  };

  // ── Init ─────────────────────────────────────────────────────
  function init() {
    // Only inject into admin panel pages
    if (!window.location.pathname.includes('/admin')) return;

    // Wait for the dashboard to be ready (auth may delay render)
    const tryInject = () => {
      const dashboard = document.getElementById('dashboard') || document.querySelector('.dashboard-content');
      if (dashboard) {
        buildPanel();
      } else {
        setTimeout(tryInject, 500);
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(tryInject, 800));
    } else {
      setTimeout(tryInject, 800);
    }
  }

  init();
})();
