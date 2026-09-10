/* ==========================================================
   main.js — UI interactions
   Hamburger · FAQ accordion · Scroll-reveal · Cart
   ========================================================== */

/* ---- Hamburger menu ---- */
(function hamburgerMenu() {
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', () => {
    const isOpen = mobileNav.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', String(isOpen));
  });

  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
})();




/* ---- Scroll-reveal ---- */
(function scrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) { items.forEach(el => el.classList.add('in-view')); return; }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

  items.forEach(el => observer.observe(el));
})();


/* ---- Shopping Cart ---- */
(function shoppingCart() {
  /* State — persist to localStorage */
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem('husk-cart') || '[]'); } catch (e) { cart = []; }

  function saveCart() {
    try { localStorage.setItem('husk-cart', JSON.stringify(cart)); } catch (e) {}
  }

  /* Element refs */
  const cartBtn      = document.getElementById('cart-btn');
  const cartClose    = document.getElementById('cart-close');
  const cartOverlay  = document.getElementById('cart-overlay');
  const cartDrawer   = document.getElementById('cart-drawer');
  const cartBadge    = document.getElementById('cart-badge');
  const cartTitleEl  = document.querySelector('.cart-title');
  const emptyState   = document.getElementById('cart-empty-state');
  const itemsList    = document.getElementById('cart-items-list');
  const cartFooter   = document.getElementById('cart-footer');
  const subtotalEl   = document.getElementById('cart-subtotal-amount');

  if (!cartDrawer) return;

  /* Open / close drawer */
  function openCart() {
    cartDrawer.classList.add('open');
    cartOverlay.classList.add('open');
    cartDrawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeCart() {
    cartDrawer.classList.remove('open');
    cartOverlay.classList.remove('open');
    cartDrawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  cartBtn.addEventListener('click', openCart);
  cartClose.addEventListener('click', closeCart);
  cartOverlay.addEventListener('click', closeCart);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeCart(); });

  /* Close cart when nav links clicked (so you land on section) */
  document.querySelectorAll('.mobile-nav a, .nav-links a').forEach(a => {
    a.addEventListener('click', closeCart);
  });

  /* Render cart UI */
  function renderCart() {
    const totalQty   = cart.reduce((s, i) => s + i.qty, 0);
    const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0);

    /* Badge */
    cartBadge.textContent = totalQty;
    cartBadge.hidden = totalQty === 0;
    cartBtn.setAttribute('aria-label', `Open cart (${totalQty} item${totalQty !== 1 ? 's' : ''})`);

    /* Drawer title */
    if (cartTitleEl) cartTitleEl.textContent = `${totalQty} item${totalQty !== 1 ? 's' : ''}`;

    if (cart.length === 0) {
      emptyState.style.display = 'flex';
      itemsList.style.display  = 'none';
      if (cartFooter) cartFooter.hidden = true;
      return;
    }

    emptyState.style.display = 'none';
    itemsList.style.display  = 'flex';
    if (cartFooter) cartFooter.hidden = false;

    /* Item rows */
    itemsList.innerHTML = cart.map(item => `
      <div class="cart-item">
        <img class="cart-item-img" src="${item.image}" alt="${item.name}" loading="lazy"/>
        <div class="cart-item-info">
          <p class="cart-item-name">${item.name}</p>
          <p class="cart-item-price">₹${item.price.toLocaleString('en-IN')}</p>
          <div class="cart-item-qty">
            <button class="qty-btn" data-id="${item.id}" data-action="dec" aria-label="Decrease quantity">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" data-id="${item.id}" data-action="inc" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <button class="cart-item-remove" data-id="${item.id}" data-action="remove" aria-label="Remove ${item.name}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('');

    if (subtotalEl) subtotalEl.textContent = `₹${totalPrice.toLocaleString('en-IN')}`;

    /* Qty / remove handlers (event delegation on itemsList) */
    itemsList.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const { id, action } = btn.dataset;
        const idx = cart.findIndex(i => i.id === id);
        if (idx === -1) return;
        if      (action === 'inc')    { cart[idx].qty++; }
        else if (action === 'dec')    { cart[idx].qty--; if (cart[idx].qty <= 0) cart.splice(idx, 1); }
        else if (action === 'remove') { cart.splice(idx, 1); }
        saveCart();
        renderCart();
      });
    });
  }

  /* Add-to-cart buttons on product cards */
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', () => {
      const { id, name, price, image } = btn.dataset;
      const existing = cart.find(i => i.id === id);
      if (existing) { existing.qty++; }
      else { cart.push({ id, name, price: Number(price), image, qty: 1 }); }
      saveCart();
      renderCart();

      /* Visual feedback on button */
      const span = btn.querySelector('span');
      if (span) {
        const orig = span.textContent;
        span.textContent = '✓ Added';
        btn.classList.add('added');
        setTimeout(() => { span.textContent = orig; btn.classList.remove('added'); }, 1400);
      }

      openCart();
    });
  });

  /* Init on load */
  renderCart();
})();
