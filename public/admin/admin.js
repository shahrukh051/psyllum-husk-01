/**
 * ============================================================================
 * Husk & Co. — Luxury Dark Store Admin Controller
 * Real Data Mode | Order & Price Customization | Admin Password Management
 * ============================================================================
 */

(function () {
  'use strict';

  // State
  let currentToken = localStorage.getItem('husk_admin_jwt') || '';
  let dashboardData = null;
  let allOrders = [];
  let currentProducts = [];
  let currentDashboardStatusFilter = 'all';
  let currentFullStatusFilter = 'all';
  let activeMetric = 'revenue'; // 'revenue' | 'orders'
  let currentModalOrder = null;
  let telemetryInterval = null;

  // ── Initialization ───────────────────────────────────────────
  window.addEventListener('DOMContentLoaded', async () => {
    setupKeyboardShortcuts();
    await checkAuth();
  });

  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Focus search on '/' or Cmd+K
      if ((e.key === '/' || (e.metaKey && e.key === 'k')) && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const searchInput = document.getElementById('globalSearchInput');
        if (searchInput) searchInput.focus();
      }
      // Close modal on Escape
      if (e.key === 'Escape') {
        window.closeOrderModal();
        window.closeProfileModal();
      }
    });
  }

  // ── Authentication ───────────────────────────────────────────
  async function checkAuth() {
    try {
      const res = await fetch('/api/admin/me', {
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        showDashboard(data.username || 'Shahrukh');
      } else {
        showLoginScreen();
      }
    } catch (err) {
      showLoginScreen();
    }
  }

  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }
    return headers;
  }

  function showDashboard(username) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').style.display = 'flex';

    const displayName = (username && username.toLowerCase() !== 'admin')
      ? username.charAt(0).toUpperCase() + username.slice(1)
      : 'Shahrukh';
    const nameEl = document.getElementById('adminHeaderName');
    const avatarEl = document.getElementById('adminAvatar');
    if (nameEl) nameEl.textContent = `${displayName} (Admin)`;
    if (avatarEl) avatarEl.textContent = displayName.charAt(0).toUpperCase();

    setupNavTabs();
    window.fetchDashboardStats();
    window.loadProductsCatalog();
    window.fetchTelemetry();
    if (telemetryInterval) clearInterval(telemetryInterval);
    telemetryInterval = setInterval(window.fetchTelemetry, 15000);
  }

  function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('app').style.display = 'none';
    if (telemetryInterval) clearInterval(telemetryInterval);
  }

  window.handleAdminLogin = async function () {
    const userEl = document.getElementById('adminUsername');
    const passEl = document.getElementById('adminPassword');
    const errEl = document.getElementById('loginErrorMsg');
    const btn = document.getElementById('loginSubmitBtn');

    errEl.style.display = 'none';
    btn.textContent = 'Authenticating...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userEl.value.trim(),
          password: passEl.value,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        currentToken = data.token;
        localStorage.setItem('husk_admin_jwt', data.token);
        showToast(`Welcome back, ${data.username}!`, 'success');
        showDashboard(data.username);
      } else {
        errEl.textContent = data.detail || 'Invalid username or password';
        errEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = 'Network error contacting authentication service';
      errEl.style.display = 'block';
    } finally {
      btn.textContent = 'Sign In to Dashboard →';
      btn.disabled = false;
    }
  };

  window.handleAdminLogout = async function () {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch (e) {}
    currentToken = '';
    localStorage.removeItem('husk_admin_jwt');
    showToast('Signed out successfully.');
    showLoginScreen();
  };

  // ── Password Management (Shahrukh Profile) ───────────────────
  window.openProfileModal = function () {
    const modal = document.getElementById('changePasswordModal');
    const err = document.getElementById('changePasswordError');
    if (err) err.style.display = 'none';
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    if (modal) modal.classList.add('open');
  };

  window.closeProfileModal = function () {
    const modal = document.getElementById('changePasswordModal');
    if (modal) modal.classList.remove('open');
  };

  window.submitChangePassword = async function () {
    const currentPass = document.getElementById('currentPassword').value.trim();
    const newPass = document.getElementById('newPassword').value.trim();
    const confirmPass = document.getElementById('confirmPassword').value.trim();
    const errEl = document.getElementById('changePasswordError');
    const btn = document.getElementById('btnUpdatePassword');

    errEl.style.display = 'none';

    if (!currentPass) {
      errEl.textContent = 'Please enter your current password.';
      errEl.style.display = 'block';
      return;
    }

    if (newPass !== confirmPass) {
      errEl.textContent = 'New passwords do not match!';
      errEl.style.display = 'block';
      return;
    }

    if (newPass.length < 2) {
      errEl.textContent = 'Password must be at least 2 characters long.';
      errEl.style.display = 'block';
      return;
    }

    btn.textContent = 'Saving...';
    btn.disabled = true;

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          current_password: currentPass,
          new_password: newPass,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.token) {
          currentToken = data.token;
          localStorage.setItem('husk_admin_jwt', data.token);
        }
        window.closeProfileModal();
        showToast('Password changed successfully!', 'success');
      } else {
        errEl.textContent = data.detail || 'Failed to update password. Please check your current password.';
        errEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = 'Network error during password update';
      errEl.style.display = 'block';
    } finally {
      btn.textContent = 'Update Password';
      btn.disabled = false;
    }
  };

  // ── Navigation Tabs ──────────────────────────────────────────
  function setupNavTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = item.getAttribute('data-tab');
        window.switchTab(tab);
      });
    });
  }

  window.switchTab = function (tabName) {
    document.querySelectorAll('.nav-item').forEach((it) => {
      it.classList.toggle('active', it.getAttribute('data-tab') === tabName);
    });

    document.querySelectorAll('.tab-content').forEach((tc) => {
      tc.style.display = 'none';
    });

    const target = document.getElementById(`tab${capitalize(tabName)}`);
    if (target) target.style.display = 'block';

    if (tabName === 'orders') window.loadFullOrders();
    if (tabName === 'contacts') window.loadContacts();
    if (tabName === 'telemetry') window.fetchTelemetry();
    if (tabName === 'products') window.loadProductsCatalog();
    if (tabName === 'customers') renderCustomersDirectory();
  };

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ── Fetch Dashboard Analytics (REAL DATA ONLY) ───────────────
  window.fetchDashboardStats = async function () {
    try {
      const res = await fetch('/api/admin/stats', { headers: getAuthHeaders() });
      if (!res.ok) {
        if (res.status === 401) return showLoginScreen();
        throw new Error('Failed to load stats');
      }

      dashboardData = await res.json();
      renderKpis(dashboardData.kpis);
      renderSalesChart(dashboardData.timeline);
      renderCustomerDonut(dashboardData.customer_segments, dashboardData.kpis.total_customers);
      renderTopProducts(dashboardData.top_products);
      await window.loadRecentOrders();

      const ordersBadge = document.getElementById('navOrdersBadge');
      if (ordersBadge) ordersBadge.textContent = dashboardData.kpis.new_orders;
    } catch (err) {
      console.error(err);
      showToast('Error refreshing analytics', 'error');
    }
  };

  function renderKpis(kpis) {
    document.getElementById('kpiRevenue').textContent = kpis.total_revenue_display;
    document.getElementById('kpiOrders').textContent = kpis.new_orders;
    document.getElementById('kpiCustomers').textContent = kpis.total_customers;
    document.getElementById('kpiConversion').textContent = kpis.conversion_rate;

    document.getElementById('kpiRevenueGrowth').textContent = kpis.revenue_growth;
    document.getElementById('kpiOrdersGrowth').textContent = kpis.orders_growth;
    document.getElementById('kpiCustomersGrowth').textContent = kpis.customers_growth;
    document.getElementById('kpiConversionGrowth').textContent = kpis.conversion_growth;
  }

  // ── Real Data Glowing Multi-Line Canvas Spline Chart ──────────
  let chartTimelineData = [];

  function renderSalesChart(timeline) {
    chartTimelineData = timeline || [];
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padX = 45;
    const padY = 30;
    const chartW = w - padX * 2;
    const chartH = h - padY * 2;

    ctx.clearRect(0, 0, w, h);

    if (!chartTimelineData.length) return;

    // Grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padY + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(w - padX, y);
      ctx.stroke();
    }

    // Determine min / max from real data
    const maxRev = Math.max(...chartTimelineData.map((d) => d.revenue), 1000);
    const maxOrd = Math.max(...chartTimelineData.map((d) => d.orders), 5);

    // Build Points
    const revPoints = chartTimelineData.map((d, i) => {
      const x = padX + (chartW / (chartTimelineData.length - 1)) * i;
      const y = padY + chartH - (d.revenue / maxRev) * chartH;
      return { x, y, data: d };
    });

    const ordPoints = chartTimelineData.map((d, i) => {
      const x = padX + (chartW / (chartTimelineData.length - 1)) * i;
      const y = padY + chartH - (d.orders / maxOrd) * chartH;
      return { x, y, data: d };
    });

    // Draw Orders wave (Violet)
    drawSplineWave(ctx, ordPoints, '#8b5cf6', 'rgba(139, 92, 246, 0.15)', h, padY + chartH);

    // Draw Revenue wave (Cyan / Emerald)
    drawSplineWave(ctx, revPoints, '#06b6d4', 'rgba(6, 182, 212, 0.22)', h, padY + chartH);

    // Axis Labels
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';

    const step = Math.ceil(chartTimelineData.length / 6);
    for (let i = 0; i < chartTimelineData.length; i += step) {
      const p = revPoints[i];
      ctx.fillText(chartTimelineData[i].label, p.x, h - 10);
    }

    setupChartHover(canvas, revPoints, ordPoints);
  }

  function drawSplineWave(ctx, points, strokeColor, fillColor, totalH, baseY) {
    if (points.length < 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, baseY);
    ctx.lineTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
    }

    ctx.lineTo(points[points.length - 1].x, baseY);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, 0, 0, baseY);
    grad.addColorStop(0, fillColor);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      ctx.bezierCurveTo(cpX, p0.y, cpX, p1.y, p1.x, p1.y);
    }
    ctx.stroke();

    points.forEach((p, idx) => {
      if (p.data.revenue > 0 || p.data.orders > 0 || idx % 4 === 0) {
        ctx.fillStyle = strokeColor;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();
  }

  function setupChartHover(canvas, revPoints, ordPoints) {
    const tooltip = document.getElementById('chartTooltip');
    const tipDate = document.getElementById('tooltipDate');
    const tipVal = document.getElementById('tooltipVal');

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      let closestIdx = 0;
      let minDiff = Infinity;
      revPoints.forEach((p, idx) => {
        const diff = Math.abs(p.x - mouseX);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });

      if (minDiff < 35) {
        const targetPt = activeMetric === 'revenue' ? revPoints[closestIdx] : ordPoints[closestIdx];
        const data = targetPt.data;

        tipDate.textContent = data.label;
        tipVal.textContent =
          activeMetric === 'revenue' ? `₹${data.revenue.toLocaleString('en-IN')}` : `${data.orders} Orders`;

        tooltip.style.display = 'block';
        tooltip.style.left = `${targetPt.x}px`;
        tooltip.style.top = `${targetPt.y}px`;
      } else {
        tooltip.style.display = 'none';
      }
    };

    canvas.onmouseleave = () => {
      tooltip.style.display = 'none';
    };
  }

  window.toggleChartMetric = function (metric) {
    activeMetric = metric;
    document.getElementById('btnDailyRevenue').classList.toggle('active', metric === 'revenue');
    document.getElementById('btnDailyOrders').classList.toggle('active', metric === 'orders');
    renderSalesChart(chartTimelineData);
  };

  // ── Customer Donut Chart (Real Segmentation) ─────────────────
  function renderCustomerDonut(segments, totalCount) {
    const canvas = document.getElementById('customerDonutChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const centerX = w / 2;
    const centerY = h / 2;
    const radius = 68;
    const thickness = 18;

    ctx.clearRect(0, 0, w, h);

    const seg = segments || { VIP: 0, Loyal: 0, New: 100, Returning: 0 };
    const data = [
      { label: 'VIP', val: seg.VIP || 0, color: '#f59e0b' },
      { label: 'Loyal', val: seg.Loyal || 0, color: '#10b981' },
      { label: 'New', val: seg.New || 100, color: '#06b6d4' },
      { label: 'Returning', val: seg.Returning || 0, color: '#8b5cf6' },
    ];

    const total = data.reduce((s, d) => s + d.val, 0) || 1;
    let startAngle = -Math.PI / 2;

    data.forEach((item) => {
      if (item.val === 0) return;
      const sliceAngle = (item.val / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      ctx.save();
      ctx.shadowColor = item.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle - 0.04);
      ctx.lineWidth = thickness;
      ctx.strokeStyle = item.color;
      ctx.stroke();
      ctx.restore();

      startAngle = endAngle;
    });

    const totalCustEl = document.getElementById('donutTotalCust');
    if (totalCustEl) totalCustEl.textContent = totalCount ? totalCount.toLocaleString('en-IN') : '0';
  }

  // ── Top Selling Products (Real Volume) ───────────────────────
  function renderTopProducts(products) {
    const container = document.getElementById('topProductsList');
    if (!container || !products) return;

    container.innerHTML = products
      .slice(0, 4)
      .map((p) => {
        return `
        <div class="product-rank-row" style="cursor:pointer;" onclick="window.openPriceModal('${p.id}')" title="Click to Change Price">
          <div class="product-rank-info">
            <img src="${p.image}" alt="${p.name}" class="product-rank-img" onerror="this.src='/images/packages/unflavored%20pack.png'">
            <div>
              <div class="product-rank-name">${p.name}</div>
              <div class="product-rank-units">₹${p.price} • ${p.qty} sold</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="text-align:right;">
              <div class="product-rank-revenue">₹${p.revenue.toLocaleString('en-IN')}</div>
              <div style="font-size:10px;color:var(--text-muted);">Real Sales</div>
            </div>
            <button class="table-btn" style="background:rgba(16,185,129,0.18);color:#34d399;font-weight:700;border-color:rgba(16,185,129,0.3);" onclick="event.stopPropagation(); window.openPriceModal('${p.id}')">
              Edit Price
            </button>
          </div>
        </div>
      `;
      })
      .join('');
  }

  // ── Products & Price Customization Tab ───────────────────────
  window.loadProductsCatalog = async function () {
    try {
      const res = await fetch('/api/admin/products', { headers: getAuthHeaders() });
      if (!res.ok) return;

      const data = await res.json();
      currentProducts = data.products || [];
      renderProductsCatalog(currentProducts);
    } catch (err) {
      console.error(err);
    }
  };

  function renderProductsCatalog(products) {
    const container = document.getElementById('productsCatalogGrid');
    if (!container || !products) return;

    container.innerHTML = products
      .map((p) => {
        return `
        <div class="kpi-card emerald" style="padding:22px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
              <img src="${p.image}" alt="${p.name}" style="width:55px;height:55px;object-fit:contain;background:rgba(255,255,255,0.05);padding:4px;border-radius:10px;border:1px solid var(--border-subtle);">
              <div style="flex:1;">
                <input type="text" id="prodTitle-${p.id}" value="${p.name}" class="form-input" style="padding:4px 8px;font-size:13px;font-weight:700;margin-bottom:4px;">
                <div style="font-size:11px;color:var(--accent-cyan);font-family:'JetBrains Mono',monospace;">SKU: ${p.id}</div>
              </div>
            </div>

            <div style="background:rgba(255,255,255,0.02);padding:12px;border-radius:var(--radius-sm);margin-bottom:16px;border:1px solid var(--border-subtle);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <label style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Price (₹ INR):</label>
                <input type="number" id="prodPrice-${p.id}" value="${p.price}" class="form-input" style="width:110px;padding:6px 10px;font-size:15px;font-weight:800;color:var(--accent-emerald);text-align:right;">
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <label style="font-size:11px;color:var(--text-secondary);font-weight:600;text-transform:uppercase;">Availability:</label>
                <select id="prodStock-${p.id}" style="background:var(--bg-elevated);color:#fff;border:1px solid var(--border-light);padding:5px 10px;border-radius:var(--radius-sm);font-size:12px;outline:none;">
                  <option value="1" ${p.in_stock ? 'selected' : ''}>In Stock</option>
                  <option value="0" ${!p.in_stock ? 'selected' : ''}>Out of Stock</option>
                </select>
              </div>
            </div>

            <div style="font-size:11.5px;color:var(--text-muted);display:flex;justify-content:space-between;margin-bottom:14px;">
              <span>Units Sold: <strong style="color:#fff;">${p.units_sold || 0}</strong></span>
              <span>Revenue: <strong style="color:var(--accent-emerald);">₹${(p.revenue || 0).toLocaleString('en-IN')}</strong></span>
            </div>
          </div>

          <div style="display:flex;gap:8px;">
            <button class="btn-primary-admin" style="flex:1;justify-content:center;" onclick="window.saveProductPrice('${p.id}')">
              Save Price
            </button>
            <button class="btn-secondary" onclick="window.openPriceModal('${p.id}')" title="Quick Modal Edit">
              Edit
            </button>
          </div>
        </div>
      `;
      })
      .join('');
  }

  // Direct Inline Price Saver
  window.saveProductPrice = async function (productId) {
    const priceEl = document.getElementById(`prodPrice-${productId}`);
    const stockEl = document.getElementById(`prodStock-${productId}`);
    const nameEl = document.getElementById(`prodTitle-${productId}`);

    const newPrice = parseInt(priceEl.value, 10);
    const inStock = stockEl ? stockEl.value === '1' : true;
    const newName = nameEl ? nameEl.value.trim() : null;

    if (isNaN(newPrice) || newPrice < 1) {
      showToast('Please enter a valid price amount', 'error');
      return;
    }

    try {
      let res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          price: newPrice,
          in_stock: inStock,
          name: newName,
        }),
      });

      if (!res.ok) {
        res = await fetch(`/api/admin/products/${productId}/price`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            price: newPrice,
            in_stock: inStock,
            name: newName,
          }),
        });
      }

      if (!res.ok) throw new Error('Failed to update price');
      const data = await res.json();
      showToast(data.message || `Updated ${productId} price to ₹${newPrice}!`, 'success');
      await window.loadProductsCatalog();
      await window.fetchDashboardStats();
    } catch (err) {
      showToast('Error updating product price', 'error');
    }
  };

  // Dedicated Product Price Modal Handlers
  window.openPriceModal = function (productId) {
    let prod = currentProducts.find((p) => p.id === productId);
    if (!prod && dashboardData && dashboardData.top_products) {
      prod = dashboardData.top_products.find((p) => p.id === productId);
    }
    if (!prod) {
      prod = {
        id: productId,
        name: productId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        price: 899,
        in_stock: true,
        image: `/images/packages/${productId === 'chocolate' ? 'chocolate' : productId === 'unflavored' ? 'unflavored' : productId === 'cheese-berry' ? '%27cheese%20berry' : 'Honey%20paper%20black'}%20pack.png`
      };
    }

    document.getElementById('priceModalId').value = prod.id;
    document.getElementById('priceModalTitle').textContent = `Edit Price: ${prod.name}`;
    document.getElementById('priceModalSku').textContent = `SKU: ${prod.id}`;
    document.getElementById('priceModalName').textContent = prod.name;
    document.getElementById('priceModalImg').src = prod.image || '/images/packages/unflavored%20pack.png';
    document.getElementById('priceModalInput').value = prod.price;
    document.getElementById('priceModalStock').value = prod.in_stock ? '1' : '0';

    document.getElementById('editProductPriceModal').classList.add('open');
  };

  window.closePriceModal = function () {
    const modal = document.getElementById('editProductPriceModal');
    if (modal) modal.classList.remove('open');
  };

  window.submitModalPriceChange = async function () {
    const productId = document.getElementById('priceModalId').value;
    const priceVal = parseInt(document.getElementById('priceModalInput').value, 10);
    const stockVal = document.getElementById('priceModalStock').value === '1';
    const btn = document.getElementById('btnSaveModalPrice');

    if (isNaN(priceVal) || priceVal < 1) {
      showToast('Please enter a valid price amount', 'error');
      return;
    }

    btn.textContent = 'Saving Live Price...';
    btn.disabled = true;

    try {
      let res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ price: priceVal, in_stock: stockVal }),
      });

      if (!res.ok) {
        res = await fetch(`/api/admin/products/${productId}/price`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ price: priceVal, in_stock: stockVal }),
        });
      }

      if (!res.ok) throw new Error('Update failed');
      const data = await res.json();
      showToast(data.message || `Price updated to ₹${priceVal}!`, 'success');
      window.closePriceModal();
      await window.loadProductsCatalog();
      await window.fetchDashboardStats();
    } catch (err) {
      showToast('Failed to update product price', 'error');
    } finally {
      btn.textContent = 'Save Price & Update Store';
      btn.disabled = false;
    }
  };

  // ── Recent Orders ─────────────────────────────────────────────
  window.loadRecentOrders = async function () {
    try {
      const url =
        currentDashboardStatusFilter === 'all'
          ? '/api/admin/orders?limit=8'
          : `/api/admin/orders?limit=8&status=${currentDashboardStatusFilter}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) return;

      const data = await res.json();
      allOrders = data.orders;
      renderRecentOrdersTable(data.orders);
    } catch (err) {
      console.error(err);
    }
  };

  function renderRecentOrdersTable(orders) {
    const tbody = document.getElementById('recentOrdersTbody');
    if (!tbody) return;

    if (!orders || !orders.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">No real orders found yet. Place an order on the site to see it here!</td></tr>`;
      return;
    }

    tbody.innerHTML = orders
      .map((o) => {
        const dateStr = formatOrderDate(o.created_at);
        return `
        <tr onclick="window.openOrderModal('${o.order_id}')">
          <td class="order-id-cell">#${o.order_id}</td>
          <td style="color:var(--text-secondary);font-size:11px;">${dateStr}</td>
          <td>
            <div class="customer-cell">
              <div class="customer-mini-avatar">${o.customer_name ? o.customer_name.charAt(0) : 'C'}</div>
              <div>
                <div style="font-weight:600;">${o.customer_name}</div>
                <div style="font-size:10.5px;color:var(--text-muted);">${o.customer_phone}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="status-badge ${o.status}">${o.status}</span>
          </td>
          <td style="font-weight:700;">₹${o.grand_total.toLocaleString('en-IN')}</td>
          <td>
            <button class="table-btn" onclick="event.stopPropagation(); window.openOrderModal('${o.order_id}')">Customize</button>
          </td>
        </tr>
      `;
      })
      .join('');
  }

  window.filterDashboardOrders = function (status, el) {
    currentDashboardStatusFilter = status;
    document.querySelectorAll('#dashboardStatusPills .filter-pill').forEach((p) => p.classList.remove('active'));
    el.classList.add('active');
    window.loadRecentOrders();
  };

  // ── Full Orders Manager Tab ──────────────────────────────────
  window.loadFullOrders = async function () {
    try {
      const url =
        currentFullStatusFilter === 'all'
          ? '/api/admin/orders?limit=100'
          : `/api/admin/orders?limit=100&status=${currentFullStatusFilter}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) return;

      const data = await res.json();
      allOrders = data.orders;

      const totalCountEl = document.getElementById('ordersTotalCount');
      if (totalCountEl) totalCountEl.textContent = `Total: ${data.total} orders`;

      renderFullOrdersTable(data.orders);
    } catch (err) {
      console.error(err);
    }
  };

  function renderFullOrdersTable(orders) {
    const tbody = document.getElementById('fullOrdersTbody');
    if (!tbody) return;

    if (!orders || !orders.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">No orders match filter</td></tr>`;
      return;
    }

    tbody.innerHTML = orders
      .map((o) => {
        const itemsSummary = o.items.map((it) => `${it.name} (x${it.qty})`).join(', ') || 'Custom';
        return `
        <tr onclick="window.openOrderModal('${o.order_id}')">
          <td class="order-id-cell">#${o.order_id}</td>
          <td style="color:var(--text-secondary);font-size:11px;">${formatOrderDate(o.created_at)}</td>
          <td style="font-weight:600;">${o.customer_name}</td>
          <td style="font-size:11px;color:var(--text-secondary);">${o.customer_phone}</td>
          <td style="font-size:11px;color:var(--text-muted);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${itemsSummary}</td>
          <td><span class="status-badge ${o.status}">${o.status}</span></td>
          <td style="font-weight:700;">₹${o.grand_total.toLocaleString('en-IN')}</td>
          <td>
            <button class="table-btn" onclick="event.stopPropagation(); window.openOrderModal('${o.order_id}')">Customize</button>
          </td>
        </tr>
      `;
      })
      .join('');
  }

  window.filterFullOrders = function (status, el) {
    currentFullStatusFilter = status;
    document.querySelectorAll('#fullOrdersStatusPills .filter-pill').forEach((p) => p.classList.remove('active'));
    el.classList.add('active');
    window.loadFullOrders();
  };

  // ── Global Search Handler ────────────────────────────────────
  window.handleGlobalSearch = function (query) {
    const term = query.trim().toLowerCase();
    if (!term) {
      renderRecentOrdersTable(allOrders.slice(0, 8));
      renderFullOrdersTable(allOrders);
      return;
    }

    const filtered = allOrders.filter((o) => {
      return (
        o.order_id.toLowerCase().includes(term) ||
        o.customer_name.toLowerCase().includes(term) ||
        o.customer_phone.toLowerCase().includes(term) ||
        (o.customer_email && o.customer_email.toLowerCase().includes(term))
      );
    });

    renderRecentOrdersTable(filtered.slice(0, 8));
    renderFullOrdersTable(filtered);
  };

  // ── Full Order Customization Modal ───────────────────────────
  window.openOrderModal = function (orderId) {
    const order = allOrders.find((o) => o.order_id === orderId);
    if (!order) return;

    currentModalOrder = JSON.parse(JSON.stringify(order)); // clone

    document.getElementById('modalOrderId').textContent = `Order #${order.order_id}`;
    document.getElementById('modalOrderDate').textContent = `Placed on ${formatOrderDate(order.created_at)}`;

    // Editable Customer Inputs
    document.getElementById('editCustName').value = order.customer_name || '';
    document.getElementById('editCustPhone').value = order.customer_phone || '';
    document.getElementById('editCustEmail').value = order.customer_email || '';
    document.getElementById('editCustAddress').value = order.customer_address || '';
    document.getElementById('editOrderStatus').value = order.status || 'pending';
    document.getElementById('modalRzpId').textContent = order.razorpay_order_id || 'None (COD / Direct)';

    document.getElementById('editShippingFee').value = order.shipping;
    document.getElementById('editGrandTotal').value = order.grand_total;

    renderModalItemsList();
    document.getElementById('orderModal').classList.add('open');
  };

  function renderModalItemsList() {
    const itemsEl = document.getElementById('modalItemsList');
    if (!currentModalOrder || !itemsEl) return;

    itemsEl.innerHTML = currentModalOrder.items
      .map((it, idx) => {
        return `
        <div class="item-breakdown-row" style="padding:10px 12px;">
          <div>
            <span style="font-weight:600;color:#fff;">${it.name}</span>
            <span style="color:var(--text-muted);font-size:11px;margin-left:8px;">₹${it.price} each</span>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="display:flex;align-items:center;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden;">
              <button style="border:none;background:transparent;color:#fff;padding:2px 8px;cursor:pointer;" onclick="window.adjustModalItemQty(${idx}, -1)">−</button>
              <span style="padding:0 8px;font-size:12px;font-weight:700;">${it.qty}</span>
              <button style="border:none;background:transparent;color:#fff;padding:2px 8px;cursor:pointer;" onclick="window.adjustModalItemQty(${idx}, 1)">+</button>
            </div>
            <strong style="color:var(--accent-emerald);min-width:65px;text-align:right;">₹${it.line_total.toLocaleString('en-IN')}</strong>
          </div>
        </div>
      `;
      })
      .join('');

    window.recalcModalGrandTotal();
  }

  window.adjustModalItemQty = function (itemIdx, delta) {
    if (!currentModalOrder || !currentModalOrder.items[itemIdx]) return;
    const item = currentModalOrder.items[itemIdx];
    item.qty = Math.max(1, item.qty + delta);
    item.line_total = item.qty * item.price;
    renderModalItemsList();
  };

  window.recalcModalGrandTotal = function () {
    if (!currentModalOrder) return;
    const subtotal = currentModalOrder.items.reduce((s, it) => s + (it.line_total || it.price * it.qty), 0);
    const shipping = parseInt(document.getElementById('editShippingFee').value, 10) || 0;
    const grandTotal = subtotal + shipping;

    document.getElementById('modalSubtotal').textContent = `₹${subtotal.toLocaleString('en-IN')}`;
    document.getElementById('editGrandTotal').value = grandTotal;
  };

  window.saveOrderCustomization = async function () {
    if (!currentModalOrder) return;

    const payload = {
      customer_name: document.getElementById('editCustName').value.trim(),
      customer_phone: document.getElementById('editCustPhone').value.trim(),
      customer_email: document.getElementById('editCustEmail').value.trim(),
      customer_address: document.getElementById('editCustAddress').value.trim(),
      status: document.getElementById('editOrderStatus').value,
      items: currentModalOrder.items,
      shipping: parseInt(document.getElementById('editShippingFee').value, 10) || 0,
      grand_total: parseInt(document.getElementById('editGrandTotal').value, 10) || 0,
    };

    try {
      const res = await fetch(`/api/admin/orders/${currentModalOrder.order_id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to update order');

      showToast(`Order #${currentModalOrder.order_id} customized successfully!`, 'success');
      window.closeOrderModal();
      window.fetchDashboardStats();
      window.loadFullOrders();
    } catch (err) {
      showToast('Error saving customized order', 'error');
    }
  };

  window.closeOrderModal = function () {
    document.getElementById('orderModal').classList.remove('open');
    currentModalOrder = null;
  };

  // ── Customers Directory View (Real Registered & Checkout Customers) ───────────
  async function renderCustomersDirectory() {
    const tbody = document.getElementById('customersTbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">Loading customer directory...</td></tr>`;

    try {
      const resUsers = await fetch('/api/admin/users', { headers: getAuthHeaders() });
      const registeredUsers = resUsers.ok ? (await resUsers.json()).users || [] : [];

      const clientsMap = {};

      // 1. Registered accounts (Full profile captured by registration)
      registeredUsers.forEach((u) => {
        const key = (u.email || u.phone || String(u.id)).toLowerCase();
        clientsMap[key] = {
          name: u.name,
          phone: u.phone || 'N/A',
          email: u.email || 'N/A',
          address: [u.address, u.city, u.pincode].filter(Boolean).join(', ') || 'India',
          ordersCount: u.orders_count || 0,
          totalSpent: u.total_spent || 0,
          type: 'Registered Member',
          joined: u.created_at ? u.created_at.slice(0, 10) : 'Recent',
        };
      });

      // 2. Merge guest checkout clients
      allOrders.forEach((o) => {
        const emailKey = (o.customer_email || '').toLowerCase();
        const phoneKey = (o.customer_phone || '').toLowerCase();
        const key = emailKey || phoneKey;

        if (key && clientsMap[key]) {
          if (clientsMap[key].address === 'India' && o.customer_address) {
            clientsMap[key].address = o.customer_address;
          }
        } else if (key) {
          clientsMap[key] = {
            name: o.customer_name,
            phone: o.customer_phone,
            email: o.customer_email || 'None',
            address: o.customer_address || 'India',
            ordersCount: 1,
            totalSpent: o.grand_total,
            type: 'Guest Buyer',
            joined: o.created_at ? o.created_at.slice(0, 10) : 'Recent',
          };
        }
      });

      const clients = Object.values(clientsMap);
      if (!clients.length) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-muted);">No client records found yet. Users will appear here when they register or order.</td></tr>`;
        return;
      }

      tbody.innerHTML = clients
        .map((c) => {
          const badgeClass = c.type === 'Registered Member' ? 'delivered' : 'shipped';
          return `
          <tr>
            <td>
              <div style="font-weight:700;color:#fff;">${c.name}</div>
              <span class="status-badge ${badgeClass}" style="font-size:10px;padding:2px 8px;margin-top:4px;display:inline-block;">${c.type}</span>
            </td>
            <td style="font-family:'JetBrains Mono', monospace;font-size:12px;color:var(--accent-cyan);">${c.phone}</td>
            <td style="color:var(--text-secondary);font-size:12px;">${c.email}</td>
            <td style="color:var(--text-muted);font-size:11.5px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c.address}">
              ${c.address}
            </td>
            <td style="color:var(--text-muted);font-size:11px;">${c.joined}</td>
            <td style="text-align:center;"><span class="status-badge processing">${c.ordersCount}</span></td>
            <td style="font-weight:700;color:var(--accent-emerald);">₹${c.totalSpent.toLocaleString('en-IN')}</td>
          </tr>
        `;
        })
        .join('');
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#f87171;">Failed to load customers directory</td></tr>`;
    }
  }

  // ── Contacts / Inquiries Tab ─────────────────────────────────
  window.loadContacts = async function () {
    try {
      const res = await fetch('/api/admin/contacts', { headers: getAuthHeaders() });
      if (!res.ok) return;

      const data = await res.json();
      const contactsBadge = document.getElementById('navContactsBadge');
      if (contactsBadge) contactsBadge.textContent = data.total;

      const tbody = document.getElementById('contactsTbody');
      if (!tbody) return;

      if (!data.contacts || !data.contacts.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-muted);">No customer inquiries found</td></tr>`;
        return;
      }

      tbody.innerHTML = data.contacts
        .map((c) => {
          return `
          <tr>
            <td style="font-size:11px;color:var(--text-muted);">${formatOrderDate(c.created_at)}</td>
            <td style="font-weight:600;">${c.name}</td>
            <td style="font-size:11px;color:var(--accent-cyan);">${c.email}</td>
            <td style="font-weight:500;">${c.subject}</td>
            <td style="font-size:11.5px;color:var(--text-secondary);max-width:250px;">${c.message || '--'}</td>
            <td>
              <button class="table-btn" onclick="window.deleteContactMessage(${c.id})">Delete</button>
            </td>
          </tr>
        `;
        })
        .join('');
    } catch (err) {
      console.error(err);
    }
  };

  window.deleteContactMessage = async function (id) {
    if (!confirm('Delete this inquiry?')) return;
    try {
      const res = await fetch(`/api/admin/contacts/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showToast('Message deleted');
        window.loadContacts();
      }
    } catch (err) {
      showToast('Error deleting message', 'error');
    }
  };

  // ── Telemetry HUD ─────────────────────────────────────────────
  window.fetchTelemetry = async function () {
    try {
      const res = await fetch('/api/admin/telemetry', { headers: getAuthHeaders() });
      if (!res.ok) return;

      const data = await res.json();
      document.getElementById('hudUptime').textContent = data.uptime_formatted;
      document.getElementById('hudPid').textContent = `Worker PID: ${data.pid} • Threads: ${data.threads}`;
      document.getElementById('hudMemory').textContent = `${data.memory_rss_mb} MB`;
      document.getElementById('hudRamPct').textContent = `System RAM: ${data.system_ram_percent}%`;
      document.getElementById('hudDbSize').textContent = `${data.database_size_kb} KB`;
      document.getElementById('hudPython').textContent = `Python ${data.python_version}`;
      document.getElementById('hudOs').textContent = `${data.platform.split('-')[0]} ASGI Worker`;

      const envEl = document.getElementById('settingsEnv');
      const rzpEl = document.getElementById('settingsRzp');
      const smtpEl = document.getElementById('settingsSmtp');
      if (envEl) envEl.textContent = data.environment;
      if (rzpEl)
        rzpEl.innerHTML = data.razorpay_enabled
          ? `<span class="status-badge delivered">Active</span>`
          : `<span class="status-badge cancelled">Inactive (Keys not set)</span>`;
      if (smtpEl)
        smtpEl.innerHTML = data.email_enabled
          ? `<span class="status-badge delivered">Active</span>`
          : `<span class="status-badge cancelled">Inactive (SMTP not set)</span>`;

      const term = document.getElementById('cyberTerminal');
      if (term) {
        const timeStr = new Date().toTimeString().split(' ')[0];
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.innerHTML = `<span class="ts">[${timeStr}]</span> <span class="cyan">[REAL DATA TELEMETRY]</span> RSS: ${data.memory_rss_mb}MB | DB: ${data.database_size_kb}KB | Active 20k worker ready`;
        term.appendChild(line);
        term.scrollTop = term.scrollHeight;
      }
    } catch (err) {}
  };

  // ── Toast Notifications ──────────────────────────────────────
  function showToast(message, type = 'normal') {
    const toast = document.getElementById('adminToast');
    const msgEl = document.getElementById('toastMsg');
    if (!toast || !msgEl) return;

    msgEl.textContent = message;
    toast.className = `toast-box show ${type}`;

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // ── Date Formatter ───────────────────────────────────────────
  function formatOrderDate(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return dateStr;
    }
  }

  window.addEventListener('resize', () => {
    if (chartTimelineData.length) renderSalesChart(chartTimelineData);
  });
})();
