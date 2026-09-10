/**
 * Husk & Co. — Modern Minimalist Authentication Logic
 * Supports split-card layout on desktop & single-card on mobile
 */

(function () {
  'use strict';

  const urlParams = new URLSearchParams(window.location.search);
  const initialMode = window.location.hash === '#register' || urlParams.get('mode') === 'register' ? 'register' : 'login';

  document.addEventListener('DOMContentLoaded', () => {
    initPaneSwitchers();
    initPasswordToggles();
    initAddressCollapsible();
    initFormSubmissions();
    showPane(initialMode);
    checkExistingSession();
  });

  // ── Switch between Login & Register Panes ────────────────────
  function initPaneSwitchers() {
    const toRegButtons = document.querySelectorAll('.js-switch-to-reg');
    const toLoginButtons = document.querySelectorAll('.js-switch-to-login');

    toRegButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showPane('register');
      });
    });

    toLoginButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        showPane('login');
      });
    });
  }

  function showPane(mode) {
    const paneLogin = document.getElementById('paneLogin');
    const paneRegister = document.getElementById('paneRegister');
    clearAlerts();

    if (mode === 'register') {
      if (paneLogin) paneLogin.classList.add('hidden-pane');
      if (paneRegister) {
        paneRegister.classList.remove('hidden-pane');
        const firstInput = paneRegister.querySelector('input');
        if (firstInput) firstInput.focus();
      }
      history.replaceState(null, '', '#register');
    } else {
      if (paneRegister) paneRegister.classList.add('hidden-pane');
      if (paneLogin) {
        paneLogin.classList.remove('hidden-pane');
        const firstInput = paneLogin.querySelector('input');
        if (firstInput) firstInput.focus();
      }
      history.replaceState(null, '', '#login');
    }
  }

  // ── Password Visibility Toggles ──────────────────────────────
  function initPasswordToggles() {
    const toggles = document.querySelectorAll('.js-toggle-pwd');
    toggles.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const inputId = btn.getAttribute('data-target');
        const input = document.getElementById(inputId);
        if (!input) return;

        if (input.type === 'password') {
          input.type = 'text';
          btn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
        } else {
          input.type = 'password';
          btn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
        }
      });
    });
  }

  // ── Optional Address Collapsible ─────────────────────────────
  function initAddressCollapsible() {
    const btn = document.getElementById('btnToggleAddress');
    const fields = document.getElementById('registerAddressFields');
    if (btn && fields) {
      btn.addEventListener('click', () => {
        fields.classList.toggle('open');
        btn.textContent = fields.classList.contains('open')
          ? '− Hide Delivery Address'
          : '+ Add Delivery Address (Optional)';
      });
    }
  }

  // ── AJAX Form Submissions ────────────────────────────────────
  function initFormSubmissions() {
    // 1. Login
    const formLogin = document.getElementById('formLogin');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const remember = document.getElementById('loginRemember').checked;
        const alertBox = document.getElementById('loginAlert');
        const btn = document.getElementById('btnLoginSubmit');

        if (!email || !password) {
          showAlert(alertBox, 'Please enter your email/phone and password.', 'error');
          return;
        }

        btn.textContent = 'Logging in...';
        btn.disabled = true;

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, remember_me: remember }),
          });

          let data;
          const text = await res.text();
          try {
            data = JSON.parse(text);
          } catch (_) {
            data = { detail: `Server returned ${res.status}. Please try again.` };
          }

          if (res.ok && data.success) {
            localStorage.setItem('husk_customer_jwt', data.token);
            localStorage.setItem('husk_customer_name', data.user.name);
            localStorage.setItem('husk_customer_email', data.user.email);
            showAlert(alertBox, `Welcome back, ${data.user.name}! Redirecting...`, 'success');
            setTimeout(() => {
              window.location.href = urlParams.get('redirect') || '/';
            }, 800);
          } else {
            showAlert(alertBox, data.detail || 'Invalid email or password.', 'error');
          }
        } catch (err) {
          console.error('Login error:', err);
          showAlert(alertBox, 'Network connection error. Please try again.', 'error');
        } finally {
          btn.textContent = 'Login';
          btn.disabled = false;
        }
      });
    }

    // 2. Register
    const formRegister = document.getElementById('formRegister');
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const password = document.getElementById('regPassword').value;
        const address = document.getElementById('regAddress') ? document.getElementById('regAddress').value.trim() : null;
        const city = document.getElementById('regCity') ? document.getElementById('regCity').value.trim() : null;
        const pincode = document.getElementById('regPincode') ? document.getElementById('regPincode').value.trim() : null;

        const alertBox = document.getElementById('registerAlert');
        const btn = document.getElementById('btnRegisterSubmit');

        if (!name || !email || !password) {
          showAlert(alertBox, 'Please fill in all required fields.', 'error');
          return;
        }

        if (password.length < 6) {
          showAlert(alertBox, 'Password must be at least 6 characters long.', 'error');
          return;
        }

        btn.textContent = 'Creating Account...';
        btn.disabled = true;

        try {
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              email,
              phone: phone || null,
              password,
              address: address || null,
              city: city || null,
              pincode: pincode || null,
            }),
          });

          let data;
          const text = await res.text();
          try {
            data = JSON.parse(text);
          } catch (_) {
            data = { detail: `Server returned ${res.status}. Please try again.` };
          }

          if (res.ok && data.success) {
            localStorage.setItem('husk_customer_jwt', data.token);
            localStorage.setItem('husk_customer_name', data.user.name);
            localStorage.setItem('husk_customer_email', data.user.email);
            showAlert(alertBox, `Account created for ${data.user.name}! Welcome to Husk & Co. Redirecting...`, 'success');
            setTimeout(() => {
              window.location.href = urlParams.get('redirect') || '/';
            }, 900);
          } else {
            showAlert(alertBox, data.detail || 'Could not register account.', 'error');
          }
        } catch (err) {
          console.error('Registration error:', err);
          showAlert(alertBox, 'Unable to reach server. Please try again.', 'error');
        } finally {
          btn.textContent = 'Create Account';
          btn.disabled = false;
        }
      });
    }
  }

  // ── Session Check ────────────────────────────────────────────
  async function checkExistingSession() {
    const token = localStorage.getItem('husk_customer_jwt');
    if (!token) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const user = await res.json();
        const loginAlert = document.getElementById('loginAlert');
        if (loginAlert) {
          showAlert(
            loginAlert,
            `You are signed in as <strong>${user.name}</strong> (${user.email}). <a href="/" style="color:#a67343;font-weight:700;margin-left:6px;">Go to Store &rarr;</a>`,
            'success'
          );
        }
      }
    } catch (e) {
      // Ignored
    }
  }

  function showAlert(el, msg, type) {
    if (!el) return;
    el.className = `auth-alert-box ${type}`;
    el.innerHTML = msg;
    el.style.display = 'block';
  }

  function clearAlerts() {
    const alerts = document.querySelectorAll('.auth-alert-box');
    alerts.forEach((a) => {
      a.style.display = 'none';
      a.innerHTML = '';
    });
  }
})();
