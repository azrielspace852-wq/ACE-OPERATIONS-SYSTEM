// ============================================================
//  ACE OPERATIONS - Full Application (Perbaikan Total)
//  Single-file frontend (no bundler)
//  Firebase Auth, State, UI Render, API calls, Log Error
// ============================================================

(function() {
  'use strict';

  // ============================================================
  // 1. CONFIG
  // ============================================================
  const CONFIG = {
    firebase: {
      // Ganti dengan config Firebase Anda yang valid
      apiKey: "AIzaSyBP_9ahQJQDLEYPxaOMhed3Hqo42aUpyak",
      authDomain: "azriel-web2.firebaseapp.com",
      projectId: "azriel-web2",
      storageBucket: "azriel-web2.firebasestorage.app",
      messagingSenderId: "61856199612",
      appId: "1:61856199612:web:9bd6f786857406a9b3f1b9"
    },
    get API_BASE_URL() {
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        return 'http://localhost:8787';
      }
      return 'https://ace-ops-api.azrielspace852.workers.dev/';
    },
    get API_URL() { return this.API_BASE_URL + '/api/v1'; },
    endpoints: {
      auth: { verify: '/auth/verify' },
      user: { profile: '/user/profile' },
      instances: {
        list: '/instances',
        create: '/instances',
        update: (id) => '/instances/' + id,
        delete: (id) => '/instances/' + id
      },
      knowledge: {
        list: '/knowledge',
        create: '/knowledge',
        delete: (id) => '/knowledge/' + id
      },
      users: {
        list: '/users',
        reset: (id) => '/users/' + id + '/reset'
      },
      playground: { chat: '/playground/chat' }
    }
  };

  // ============================================================
  // 2. LOG ERROR SYSTEM
  // ============================================================
  const errorLog = [];
  const MAX_ERROR_LOG = 50;

  function captureError(error, context = '') {
    const entry = {
      time: new Date().toLocaleString(),
      message: error.message || String(error),
      stack: error.stack || '',
      context: context
    };
    errorLog.unshift(entry);
    if (errorLog.length > MAX_ERROR_LOG) errorLog.pop();
    // Update UI jika modal terbuka
    renderErrorLog();
    // Tampilkan di console juga
    console.error('[ACE-OPS Error]', context, error);
  }

  // Override console.error untuk menangkap error yang tidak terhandle
  const originalConsoleError = console.error;
  console.error = function(...args) {
    originalConsoleError.apply(console, args);
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    captureError(new Error(msg), 'console.error');
  };

  // Tangkap error global
  window.addEventListener('error', (event) => {
    captureError(event.error || new Error(event.message), 'global error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    captureError(event.reason || new Error('Unhandled Promise rejection'), 'unhandled rejection');
  });

  // ============================================================
  // 3. STATE MANAGEMENT
  // ============================================================
  class AppState {
    constructor() {
      this._state = {
        user: null,
        token: null,
        isAuthenticated: false,
        currentPage: 'dashboard',
        theme: localStorage.getItem('theme') || 'dark'
      };
      this._listeners = {};
      this._loadFromStorage();
    }

    _loadFromStorage() {
      try {
        const token = localStorage.getItem('ace_ops_token');
        const user = JSON.parse(localStorage.getItem('ace_ops_user') || 'null');
        if (token && user) {
          this._state.token = token;
          this._state.user = user;
          this._state.isAuthenticated = true;
        }
      } catch (_) {}
    }

    _persist() {
      if (this._state.token) {
        localStorage.setItem('ace_ops_token', this._state.token);
      } else {
        localStorage.removeItem('ace_ops_token');
      }
      if (this._state.user) {
        localStorage.setItem('ace_ops_user', JSON.stringify(this._state.user));
      } else {
        localStorage.removeItem('ace_ops_user');
      }
    }

    get(key) { return this._state[key]; }
    set(key, value) {
      const old = this._state[key];
      this._state[key] = value;
      if (key === 'token' || key === 'user') this._persist();
      if (this._listeners[key]) {
        this._listeners[key].forEach(cb => cb(value, old));
      }
    }

    setUser(user) {
      this.set('user', user);
      this.set('isAuthenticated', !!user);
    }
    setToken(token) {
      this.set('token', token);
      this.set('isAuthenticated', !!token);
    }
    clearSession() {
      this.setToken(null);
      this.setUser(null);
      this.set('isAuthenticated', false);
      localStorage.removeItem('ace_ops_token');
      localStorage.removeItem('ace_ops_user');
    }

    subscribe(key, cb) {
      if (!this._listeners[key]) this._listeners[key] = [];
      this._listeners[key].push(cb);
      cb(this._state[key]);
      return () => {
        this._listeners[key] = this._listeners[key].filter(fn => fn !== cb);
      };
    }
  }

  const appState = new AppState();

  // ============================================================
  // 4. UTILITIES
  // ============================================================
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const colors = {
      success: 'toast-success',
      error: 'toast-error',
      warning: 'toast-warning',
      info: 'toast-info'
    };
    const div = document.createElement('div');
    div.className = `toast ${colors[type] || colors.info}`;
    div.textContent = message;
    container.appendChild(div);
    setTimeout(() => {
      div.classList.add('toast-exit');
      setTimeout(() => div.remove(), 300);
    }, 3000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function renderErrorLog() {
    const list = document.getElementById('logErrorList');
    if (!list) return;
    if (errorLog.length === 0) {
      list.innerHTML = '<p style="color: var(--text-muted); text-align:center; padding:1rem;">Belum ada error tercatat.</p>';
      return;
    }
    list.innerHTML = errorLog.map(e => `
      <div class="error-item">
        <span class="error-time">${e.time}</span>
        <span class="error-msg">${escapeHtml(e.message)}</span>
        ${e.stack ? `<details><summary>Stack</summary><pre style="font-size:0.7rem;color:var(--text-muted);">${escapeHtml(e.stack)}</pre></details>` : ''}
        ${e.context ? `<div style="font-size:0.7rem;color:var(--text-muted);">Context: ${escapeHtml(e.context)}</div>` : ''}
      </div>
    `).join('');
  }

  // ============================================================
  // 5. THEME
  // ============================================================
  function getTheme() { return appState.get('theme') || 'dark'; }
  function setTheme(theme) {
    appState.set('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const label = document.getElementById('themeLabel');
    if (label) label.textContent = theme === 'dark' ? 'Mode Gelap' : 'Mode Terang';
    const mobileLabel = document.getElementById('themeToggleMobile');
    if (mobileLabel) mobileLabel.innerHTML = theme === 'dark' ? '&#9681; Mode Terang' : '&#9681; Mode Gelap';
  }
  function toggleTheme() {
    const next = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(next);
  }

  // ============================================================
  // 6. AUTHENTICATION (Firebase)
  // ============================================================
  let auth = null;
  let authInitialized = false;

  function initAuth(firebaseApp) {
    auth = firebaseApp.auth();
    
    auth.onAuthStateChanged(async (user) => {
      authInitialized = true;
      try {
        if (user) {
          const token = await user.getIdToken();
          appState.setToken(token);
          appState.setUser({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email
          });
          showToast('Selamat datang, ' + (user.displayName || 'User') + '!', 'success');
          hideLoadingScreen();
          document.getElementById('authScreen').classList.add('hidden');
          document.getElementById('app').classList.remove('hidden');
          document.dispatchEvent(new CustomEvent('auth:login'));
        } else {
          appState.clearSession();
          hideLoadingScreen();
          document.getElementById('authScreen').classList.remove('hidden');
          document.getElementById('app').classList.add('hidden');
          document.dispatchEvent(new CustomEvent('auth:logout'));
        }
      } catch (err) {
        captureError(err, 'auth state change');
        hideLoadingScreen();
        showToast('Error auth: ' + err.message, 'error');
      }
    });

    // Setup form handlers
    document.getElementById('loginForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      auth.signInWithEmailAndPassword(email, password).catch(err => {
        captureError(err, 'login');
        showToast('Login gagal: ' + err.message, 'error');
      });
    });
    document.getElementById('registerForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('regName').value;
      const email = document.getElementById('regEmail').value;
      const password = document.getElementById('regPassword').value;
      auth.createUserWithEmailAndPassword(email, password)
        .then(cred => cred.user.updateProfile({ displayName: name }))
        .then(() => showToast('Akun berhasil dibuat!', 'success'))
        .catch(err => {
          captureError(err, 'register');
          showToast('Daftar gagal: ' + err.message, 'error');
        });
    });
    document.getElementById('showRegisterLink').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('loginForm').classList.add('hidden');
      document.getElementById('registerForm').classList.remove('hidden');
    });
    document.getElementById('showLoginLink').addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('registerForm').classList.add('hidden');
      document.getElementById('loginForm').classList.remove('hidden');
    });
  }

  async function refreshToken() {
    if (!auth || !auth.currentUser) return null;
    try {
      const token = await auth.currentUser.getIdToken(true);
      appState.setToken(token);
      return token;
    } catch (err) {
      captureError(err, 'refresh token');
      return null;
    }
  }

  function logout() {
    if (auth) auth.signOut().catch(err => captureError(err, 'logout'));
    appState.clearSession();
    showToast('Anda telah keluar', 'info');
  }

  // ============================================================
  // 7. API FETCH with Auto-Refresh on 403
  // ============================================================
  async function apiFetch(endpoint, options = {}) {
    const url = CONFIG.API_URL + endpoint;
    const makeRequest = async (token) => {
      const headers = { 'Content-Type': 'application/json', ...options.headers };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body || undefined
      });
    };

    let token = appState.get('token');
    let response = await makeRequest(token);

    if (response.status === 403 && token) {
      const newToken = await refreshToken();
      if (newToken) {
        response = await makeRequest(newToken);
      } else {
        // Refresh gagal, logout
        logout();
        throw new Error('Sesi kadaluarsa, silakan login ulang.');
      }
    }

    let data;
    try {
      data = await response.json();
    } catch (_) {
      throw new Error('Respons tidak valid dari server.');
    }

    if (!response.ok) {
      const errMsg = data.error?.message || data.error || `HTTP ${response.status}`;
      const err = new Error(errMsg);
      err.status = response.status;
      if (response.status === 401 || response.status === 403) {
        logout();
      }
      throw err;
    }
    return data;
  }

  // API functions
  const API = {
    getInstances: () => apiFetch(CONFIG.endpoints.instances.list),
    createInstance: (data) => apiFetch(CONFIG.endpoints.instances.create, { method: 'POST', body: JSON.stringify(data) }),
    updateInstance: (id, data) => apiFetch(CONFIG.endpoints.instances.update(id), { method: 'PUT', body: JSON.stringify(data) }),
    deleteInstance: (id) => apiFetch(CONFIG.endpoints.instances.delete(id), { method: 'DELETE' }),
    getKnowledge: () => apiFetch(CONFIG.endpoints.knowledge.list),
    createKnowledge: (data) => apiFetch(CONFIG.endpoints.knowledge.create, { method: 'POST', body: JSON.stringify(data) }),
    deleteKnowledge: (id) => apiFetch(CONFIG.endpoints.knowledge.delete(id), { method: 'DELETE' }),
    getUsers: () => apiFetch(CONFIG.endpoints.users.list),
    resetUserCredits: (id) => apiFetch(CONFIG.endpoints.users.reset(id), { method: 'POST' }),
    sendPlaygroundMessage: (messages, instance) => apiFetch(CONFIG.endpoints.playground.chat, { method: 'POST', body: JSON.stringify({ messages, instance }) }),
    getProfile: () => apiFetch(CONFIG.endpoints.user.profile)
  };

  // ============================================================
  // 8. LOADING SCREEN CONTROL
  // ============================================================
  let loadingHidden = false;

  function hideLoadingScreen() {
    if (loadingHidden) return;
    loadingHidden = true;
    const el = document.getElementById('loadingScreen');
    if (el) el.classList.add('hidden');
  }

  // Force hide after 3 seconds (pemanis)
  setTimeout(() => {
    if (!loadingHidden) {
      hideLoadingScreen();
      // Tampilkan error jika auth belum siap
      if (!authInitialized) {
        showToast('Firebase lambat merespons, silakan refresh.', 'warning');
      }
    }
  }, 3000);

  // ============================================================
  // 9. RENDER FUNCTIONS
  // ============================================================

  // ---------- DASHBOARD ----------
  function renderDashboard() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-xl font-bold">Dashboard</h1>
            <p class="text-sm text-gray-500">Panel Kontrol ACE Operations</p>
          </div>
          <div class="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-500/20">
            <span class="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            Sistem Online
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6" id="statsGrid"></div>
        <div class="bg-card border border-theme rounded-xl overflow-hidden">
          <div class="px-4 py-3 border-b border-theme"><h2 class="text-sm font-semibold">Ringkasan</h2></div>
          <div id="summaryContent" class="p-4 text-sm text-gray-400">Memuat data...</div>
        </div>
      </div>
    `;

    Promise.all([API.getInstances(), API.getKnowledge(), API.getUsers()])
      .then(([instSnap, knowSnap, usersSnap]) => {
        const instances = instSnap.data?.instances || [];
        const knowledge = knowSnap.data?.knowledge || [];
        const users = usersSnap.data?.users || [];
        const activeInst = instances.filter(i => i.status === 'active').length;
        let totalCredits = 0, usedCredits = 0;
        users.forEach(u => {
          totalCredits += u.creditLimit || 0;
          usedCredits += (u.creditLimit || 0) - (u.creditRemaining || 0);
        });
        document.getElementById('statsGrid').innerHTML = `
          <div class="bg-card border border-theme rounded-xl p-4 border-l-accent border-l-4">
            <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Instansi AI</p>
            <p class="text-2xl font-bold">${instances.length}</p><p class="text-xs text-gray-500">${activeInst} aktif</p>
          </div>
          <div class="bg-card border border-theme rounded-xl p-4">
            <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Pengetahuan</p>
            <p class="text-2xl font-bold">${knowledge.length}</p>
          </div>
          <div class="bg-card border border-theme rounded-xl p-4">
            <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Pengguna</p>
            <p class="text-2xl font-bold">${users.length}</p>
          </div>
          <div class="bg-card border border-theme rounded-xl p-4 border-l-amber-500 border-l-4">
            <p class="text-xs uppercase tracking-wider text-gray-500 mb-2">Kredit Terpakai</p>
            <p class="text-2xl font-bold">${usedCredits}</p><p class="text-xs text-gray-500">dari ${totalCredits}</p>
          </div>`;
        document.getElementById('summaryContent').innerHTML = `
          <div class="space-y-2">
            <p>📊 <strong>${instances.length}</strong> Instansi AI terdaftar</p>
            <p>📚 <strong>${knowledge.length}</strong> Entri pengetahuan</p>
            <p>👥 <strong>${users.length}</strong> Pengguna terdaftar</p>
            <p>⚡ <strong>${activeInst}</strong> Instansi aktif</p>
          </div>`;
      })
      .catch(err => {
        captureError(err, 'dashboard load');
        showToast('Gagal dashboard: ' + err.message, 'error');
        document.getElementById('summaryContent').innerHTML = 'Gagal memuat data.';
      });
  }

  // ---------- INSTANCES ----------
  let tempApiKeys = [];
  function renderInstances() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
      <div>
        <div class="flex justify-between mb-4">
          <h1 class="text-xl font-bold">Instansi AI</h1>
          <button id="addInstanceBtn" class="px-4 py-2 bg-accent text-white rounded-lg text-sm">+ Tambah</button>
        </div>
        <div id="instancesList"></div>
      </div>
      ${instanceModalHTML()}
    `;
    document.getElementById('addInstanceBtn').addEventListener('click', openInstanceModal);
    document.getElementById('instanceModal').addEventListener('click', e => { if (e.target.id === 'instanceModal') closeInstanceModal(); });
    document.getElementById('closeInstanceModal').addEventListener('click', closeInstanceModal);
    document.getElementById('instanceForm').addEventListener('submit', handleAddInstance);
    document.getElementById('instProvider').addEventListener('change', updateModelDropdown);
    document.getElementById('addApiKeyBtn').addEventListener('click', addApiKey);
    document.getElementById('cancelInstanceBtn').addEventListener('click', closeInstanceModal);
    loadInstances();
  }

  function instanceModalHTML() {
    return `
    <div id="instanceModal" class="hidden fixed inset-0 z-[999] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-card border border-theme rounded-t-2xl md:rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-bold">Tambah Instansi AI</h2>
          <button id="closeInstanceModal" class="text-2xl text-gray-500 hover:text-white">&times;</button>
        </div>
        <form id="instanceForm" class="space-y-3">
          <div><label class="text-xs text-gray-400">Nama</label><input type="text" id="instName" class="w-full px-3 py-2 bg-hover border rounded-lg" required></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="text-xs text-gray-400">Provider</label>
              <select id="instProvider" class="w-full px-3 py-2 bg-hover border rounded-lg">
                <option value="groq">Groq</option><option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option><option value="anthropic">Anthropic</option>
              </select>
            </div>
            <div><label class="text-xs text-gray-400">Model</label>
              <select id="instModel" class="w-full px-3 py-2 bg-hover border rounded-lg"></select>
            </div>
          </div>
          <div><label class="text-xs text-gray-400">System Prompt</label>
            <textarea id="instPrompt" rows="3" class="w-full px-3 py-2 bg-hover border rounded-lg"></textarea>
          </div>
          <div><label class="text-xs text-gray-400">API Keys</label>
            <div class="flex gap-2 mb-2">
              <input id="apiKeyLabel" placeholder="Label" class="flex-1 px-3 py-2 bg-hover border rounded-lg">
              <input id="apiKeyValue" type="password" placeholder="gsk_..." class="flex-1 px-3 py-2 bg-hover border rounded-lg">
            </div>
            <button type="button" id="addApiKeyBtn" class="text-xs text-accent">+ Tambah</button>
            <div id="apiKeyList" class="mt-2 space-y-1"></div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="text-xs text-gray-400">Suhu: <span id="tempVal">0.7</span></label>
              <input type="range" min="0" max="2" step="0.1" value="0.7" id="instTemp" oninput="document.getElementById('tempVal').textContent=this.value">
            </div>
            <div><label class="text-xs text-gray-400">Token Maks</label>
              <input type="number" id="instMaxTokens" value="4096" class="w-full px-3 py-2 bg-hover border rounded-lg">
            </div>
          </div>
          <div class="flex justify-end gap-3 pt-2">
            <button type="button" id="cancelInstanceBtn" class="px-4 py-2 border rounded-lg">Batal</button>
            <button type="submit" class="px-4 py-2 bg-accent text-white rounded-lg">Simpan</button>
          </div>
        </form>
      </div>
    </div>`;
  }

  function openInstanceModal() {
    tempApiKeys = [];
    renderApiKeyList();
    document.getElementById('instanceModal').classList.remove('hidden');
    updateModelDropdown();
  }
  function closeInstanceModal() {
    document.getElementById('instanceModal').classList.add('hidden');
    document.getElementById('instanceForm').reset();
    tempApiKeys = [];
  }
  function renderApiKeyList() {
    const list = document.getElementById('apiKeyList');
    if (!list) return;
    list.innerHTML = tempApiKeys.map((k, i) => `
      <div class="flex justify-between bg-hover px-3 py-1.5 rounded-lg text-xs">
        <span>${k.label} — <code>${k.key.slice(0,6)}...${k.key.slice(-4)}</code></span>
        <button type="button" onclick="window._removeApiKey(${i})" class="text-red-400">Hapus</button>
      </div>`).join('');
  }
  window._removeApiKey = (index) => {
    tempApiKeys.splice(index, 1);
    renderApiKeyList();
  };
  function addApiKey() {
    const label = document.getElementById('apiKeyLabel').value.trim();
    const key = document.getElementById('apiKeyValue').value.trim();
    if (!label || !key) return showToast('Label dan API Key wajib diisi', 'error');
    tempApiKeys.push({ label, key, status: 'active', dailyLimit: 1000, usageToday: 0 });
    document.getElementById('apiKeyLabel').value = '';
    document.getElementById('apiKeyValue').value = '';
    renderApiKeyList();
  }
  const modelsByProvider = {
    groq: [{ value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' }, { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' }],
    deepseek: [{ value: 'deepseek-chat', label: 'DeepSeek Chat' }],
    openai: [{ value: 'gpt-4o', label: 'GPT-4o' }, { value: 'gpt-4o-mini', label: 'GPT-4o Mini' }],
    anthropic: [{ value: 'claude-sonnet-4', label: 'Claude Sonnet 4' }]
  };
  function updateModelDropdown() {
    const provider = document.getElementById('instProvider').value;
    const modelSelect = document.getElementById('instModel');
    const models = modelsByProvider[provider] || [];
    modelSelect.innerHTML = models.map(m => `<option value="${m.value}">${m.label}</option>`).join('');
  }
  function handleAddInstance(e) {
    e.preventDefault();
    const name = document.getElementById('instName').value.trim();
    if (!name) return showToast('Nama wajib diisi', 'error');
    if (tempApiKeys.length === 0) return showToast('Minimal 1 API Key', 'error');
    API.createInstance({
      name,
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      provider: document.getElementById('instProvider').value,
      model: document.getElementById('instModel').value,
      systemPrompt: document.getElementById('instPrompt').value,
      temperature: parseFloat(document.getElementById('instTemp').value),
      maxTokens: parseInt(document.getElementById('instMaxTokens').value),
      status: 'active',
      apiKeys: tempApiKeys,
      rotationStrategy: 'round_robin'
    }).then(() => {
      showToast('Instansi berhasil dibuat!', 'success');
      closeInstanceModal();
      loadInstances();
    }).catch(err => {
      captureError(err, 'create instance');
      showToast('Gagal: ' + err.message, 'error');
    });
  }
  function loadInstances() {
    const list = document.getElementById('instancesList');
    API.getInstances().then(res => {
      const instances = res.data?.instances || [];
      if (!instances.length) return list.innerHTML = '<p class="text-center py-8 text-gray-500">Belum ada instansi AI</p>';
      list.innerHTML = instances.map(i => `
        <div class="bg-card border rounded-xl mb-4 overflow-hidden">
          <div class="px-4 py-3 border-b flex justify-between">
            <div><h2 class="font-semibold">${i.name}</h2><p class="text-xs text-gray-500">${i.provider} · ${i.model}</p></div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-full text-xs ${i.status==='active'?'bg-emerald-500/10 text-emerald-400':'bg-gray-500/10'}">${i.status}</span>
              <button onclick="window._deleteInstance('${i.id}')" class="text-red-400 text-sm">Hapus</button>
            </div>
          </div>
          <div class="p-4">
            <div class="bg-hover p-3 rounded-lg text-xs font-mono mb-3">${escapeHtml(i.systemPrompt || 'Tidak ada prompt')}</div>
            <div class="flex gap-4 text-xs text-gray-500 mb-2">
              <span>Suhu: ${i.temperature||0.7}</span><span>Token: ${i.maxTokens||4096}</span>
            </div>
            ${(i.apiKeys||[]).map(k => `<div class="flex justify-between text-xs py-1"><span>${k.label}</span><span class="${k.status==='active'?'text-emerald-400':'text-amber-400'}">${k.status}</span></div>`).join('')}
          </div>
        </div>`).join('');
    }).catch(err => {
      captureError(err, 'load instances');
      showToast('Gagal memuat instansi: ' + err.message, 'error');
      list.innerHTML = '<p class="text-center py-8 text-gray-500">Gagal memuat data</p>';
    });
  }
  window._deleteInstance = (id) => {
    if (!confirm('Yakin hapus?')) return;
    API.deleteInstance(id).then(() => { showToast('Terhapus', 'info'); loadInstances(); }).catch(err => {
      captureError(err, 'delete instance');
      showToast('Gagal: '+err.message,'error');
    });
  };

  // ---------- KNOWLEDGE ----------
  function renderKnowledge() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
      <div>
        <div class="flex justify-between mb-4"><h1 class="text-xl font-bold">Pengetahuan</h1><button id="addKbBtn" class="px-4 py-2 bg-accent text-white rounded-lg">+ Tambah</button></div>
        <div id="knowledgeGrid" class="grid grid-cols-1 md:grid-cols-2 gap-3"></div>
      </div>
      ${knowledgeModalHTML()}
    `;
    document.getElementById('addKbBtn').addEventListener('click', () => document.getElementById('knowledgeModal').classList.remove('hidden'));
    document.getElementById('knowledgeModal').addEventListener('click', e => { if (e.target.id === 'knowledgeModal') closeKnowledgeModal(); });
    document.getElementById('closeKnowledgeModal').addEventListener('click', closeKnowledgeModal);
    document.getElementById('knowledgeForm').addEventListener('submit', handleAddKnowledge);
    document.getElementById('cancelKnowledgeBtn').addEventListener('click', closeKnowledgeModal);
    loadKnowledge();
  }
  function knowledgeModalHTML() {
    return `
    <div id="knowledgeModal" class="hidden fixed inset-0 z-[999] flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-card border rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="flex justify-between mb-4"><h2 class="text-lg font-bold">Tambah Pengetahuan</h2><button id="closeKnowledgeModal">&times;</button></div>
        <form id="knowledgeForm" class="space-y-3">
          <input id="kbTitle" placeholder="Judul" class="w-full px-3 py-2 bg-hover border rounded-lg" required>
          <textarea id="kbContent" rows="5" placeholder="Konten" class="w-full px-3 py-2 bg-hover border rounded-lg" required></textarea>
          <div class="flex justify-end gap-3"><button type="button" id="cancelKnowledgeBtn" class="border rounded-lg px-4 py-2">Batal</button><button type="submit" class="bg-accent text-white rounded-lg px-4 py-2">Simpan</button></div>
        </form>
      </div>
    </div>`;
  }
  function closeKnowledgeModal() {
    document.getElementById('knowledgeModal').classList.add('hidden');
    document.getElementById('knowledgeForm').reset();
  }
  function handleAddKnowledge(e) {
    e.preventDefault();
    const title = document.getElementById('kbTitle').value.trim();
    const content = document.getElementById('kbContent').value.trim();
    if (!title || !content) return showToast('Judul dan konten wajib', 'error');
    API.createKnowledge({ title, content, type: 'Umum' }).then(() => {
      showToast('Pengetahuan ditambahkan', 'success');
      closeKnowledgeModal();
      loadKnowledge();
    }).catch(err => {
      captureError(err, 'create knowledge');
      showToast('Gagal: '+err.message,'error');
    });
  }
  function loadKnowledge() {
    const grid = document.getElementById('knowledgeGrid');
    API.getKnowledge().then(res => {
      const items = res.data?.knowledge || [];
      if (!items.length) return grid.innerHTML = '<p class="col-span-full text-center py-8 text-gray-500">Belum ada pengetahuan</p>';
      grid.innerHTML = items.map(k => `
        <div class="bg-card border rounded-xl p-4 hover:border-accent group">
          <div class="flex justify-between"><h3 class="font-semibold text-sm">${k.title}</h3><button onclick="window._deleteKnowledge('${k.id}')" class="text-red-400 opacity-0 group-hover:opacity-100">Hapus</button></div>
          <p class="text-xs text-gray-500 line-clamp-2">${k.content}</p>
        </div>`).join('');
    }).catch(err => {
      captureError(err, 'load knowledge');
      showToast('Gagal: '+err.message,'error');
    });
  }
  window._deleteKnowledge = (id) => {
    if (!confirm('Yakin hapus?')) return;
    API.deleteKnowledge(id).then(() => { showToast('Terhapus', 'info'); loadKnowledge(); }).catch(err => {
      captureError(err, 'delete knowledge');
      showToast('Gagal: '+err.message,'error');
    });
  };

  // ---------- USERS ----------
  function renderUsers() {
    document.getElementById('mainContent').innerHTML = `
      <div><h1 class="text-xl font-bold mb-4">Pengguna</h1>
        <div class="bg-card border rounded-xl overflow-hidden"><table class="w-full text-sm"><thead class="bg-hover text-gray-400 text-xs uppercase"><tr><th class="px-4 py-2.5">Nama</th><th>Email</th><th>Kredit</th><th>Status</th><th>Aksi</th></tr></thead><tbody id="usersTbody"></tbody></table></div>
      </div>`;
    loadUsers();
  }
  function loadUsers() {
    API.getUsers().then(res => {
      const users = res.data?.users || [];
      const tbody = document.getElementById('usersTbody');
      if (!users.length) return tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8">Belum ada pengguna</td></tr>';
      tbody.innerHTML = users.map(u => {
        const pct = u.creditLimit ? Math.min((u.creditRemaining / u.creditLimit) * 100, 100) : 0;
        return `<tr class="border-b hover:bg-hover"><td class="px-4 py-2.5">${u.displayName||'N/A'}</td><td class="text-gray-400">${u.email||''}</td>
        <td><div class="w-24 h-1.5 bg-hover rounded-full"><div class="h-full ${pct<30?'bg-red-500':pct<70?'bg-amber-500':'bg-accent'}" style="width:${pct}%"></div></div><span class="text-xs">${u.creditRemaining||0}/${u.creditLimit||0}</span></td>
        <td><span class="px-2 py-0.5 rounded-full text-xs ${u.status==='active'?'bg-emerald-500/10 text-emerald-400':'bg-red-500/10 text-red-400'}">${u.status||'active'}</span></td>
        <td><button onclick="window._resetCredit('${u.id}')" class="border px-2 py-1 text-xs rounded-md hover:bg-hover">Reset</button></td></tr>`;
      }).join('');
    }).catch(err => {
      captureError(err, 'load users');
      showToast('Gagal: '+err.message,'error');
    });
  }
  window._resetCredit = (uid) => {
    API.resetUserCredits(uid).then(() => { showToast('Kredit direset', 'success'); loadUsers(); }).catch(err => {
      captureError(err, 'reset credit');
      showToast('Gagal: '+err.message,'error');
    });
  };

  // ---------- PLAYGROUND ----------
  let chatHistory = [];
  function renderPlayground() {
    document.getElementById('mainContent').innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-160px)] min-h-[450px]">
        <div class="bg-card border rounded-xl p-4">
          <h3 class="font-semibold mb-3">Konfigurasi</h3>
          <div class="space-y-3">
            <div><label class="text-xs text-gray-400">Instansi</label><select id="pgInstance" class="w-full px-3 py-2 bg-hover border rounded-lg"></select></div>
            <div><label class="text-xs text-gray-400">Suhu: <span id="pgTempVal">0.7</span></label><input type="range" min="0" max="2" step="0.1" value="0.7" id="pgTemp" oninput="document.getElementById('pgTempVal').textContent=this.value"></div>
            <button id="clearChatBtn" class="w-full border rounded-lg py-2 text-sm">Bersihkan Chat</button>
          </div>
        </div>
        <div class="bg-card border rounded-xl flex flex-col">
          <div class="flex-1 overflow-y-auto p-4 space-y-3" id="chatMessages"></div>
          <div class="flex gap-2 p-3 border-t">
            <input id="chatInput" placeholder="Ketik pesan..." class="flex-1 px-3 py-2 bg-hover border rounded-lg" onkeydown="if(event.key==='Enter') window._sendPlayground()">
            <button id="sendPlaygroundBtn" class="px-4 py-2 bg-accent text-white rounded-lg">Kirim</button>
          </div>
        </div>
      </div>`;
    document.getElementById('sendPlaygroundBtn').addEventListener('click', window._sendPlayground);
    document.getElementById('clearChatBtn').addEventListener('click', clearChat);
    API.getInstances().then(res => {
      const instances = res.data?.instances || [];
      const sel = document.getElementById('pgInstance');
      sel.innerHTML = instances.map(i => `<option value="${i.slug||i.id}">${i.name}</option>`).join('') || '<option value="default">Default</option>';
    }).catch(err => captureError(err, 'load playground instances'));
  }

  window._sendPlayground = async function() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    const container = document.getElementById('chatMessages');
    container.innerHTML += `<div class="max-w-[85%] self-end bg-accent text-white rounded-xl rounded-br-sm px-3 py-2 text-sm ml-auto">${escapeHtml(msg)}</div>`;
    input.value = '';
    const loadingId = 'loading-' + Date.now();
    container.innerHTML += `<div id="${loadingId}" class="max-w-[85%] self-start bg-hover border rounded-xl px-3 py-2 text-sm text-gray-400">⏳ Mengetik...</div>`;
    container.scrollTop = container.scrollHeight;
    chatHistory.push({ role: 'user', content: msg });
    const instance = document.getElementById('pgInstance').value;
    try {
      const res = await API.sendPlaygroundMessage(chatHistory, instance);
      document.getElementById(loadingId)?.remove();
      const reply = res.data?.reply || 'Tidak ada respons.';
      container.innerHTML += `<div class="max-w-[85%] self-start bg-hover border rounded-xl px-3 py-2 text-sm">${escapeHtml(reply)}</div>`;
      chatHistory.push({ role: 'assistant', content: reply });
      container.scrollTop = container.scrollHeight;
    } catch (err) {
      document.getElementById(loadingId)?.remove();
      captureError(err, 'playground chat');
      container.innerHTML += `<div class="max-w-[85%] self-start bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-sm text-red-400">❌ ${escapeHtml(err.message)}</div>`;
      showToast('Gagal: ' + err.message, 'error');
    }
  };

  function clearChat() {
    chatHistory = [];
    const container = document.getElementById('chatMessages');
    if (container) container.innerHTML = '<div class="text-sm text-gray-400">Chat dibersihkan. Mulai obrolan baru!</div>';
  }

  // ---------- SETTINGS ----------
  function renderSettings() {
    document.getElementById('mainContent').innerHTML = `
      <div class="bg-card border rounded-xl p-4 space-y-4">
        <h2 class="font-semibold">Pengaturan</h2>
        <div><label class="text-xs text-gray-400">Email</label><p id="settingsEmail" class="font-medium">-</p></div>
        <div><label class="text-xs text-gray-400">Nama</label><p id="settingsName" class="font-medium">-</p></div>
        <div><label class="text-xs text-gray-400">Tema</label><button id="settingsThemeBtn" class="border rounded-lg px-4 py-2">${getTheme()==='dark'?'Mode Terang':'Mode Gelap'}</button></div>
        <div class="border-t pt-4"><button id="settingsLogoutBtn" class="px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg">Keluar</button></div>
      </div>`;
    API.getProfile().then(res => {
      const u = res.data?.user || {};
      document.getElementById('settingsEmail').textContent = u.email || '-';
      document.getElementById('settingsName').textContent = u.displayName || '-';
    }).catch(err => {
      captureError(err, 'load profile');
      showToast('Gagal profil: '+err.message,'error');
    });
    document.getElementById('settingsThemeBtn').addEventListener('click', () => {
      toggleTheme();
      document.getElementById('settingsThemeBtn').textContent = getTheme()==='dark'?'Mode Terang':'Mode Gelap';
    });
    document.getElementById('settingsLogoutBtn').addEventListener('click', logout);
  }

  // ---------- DATABASES ----------
  function renderDatabases() {
    document.getElementById('mainContent').innerHTML = `
      <div><h1 class="text-xl font-bold mb-4">Database</h1>
        <div class="bg-card border rounded-xl"><table class="w-full text-sm"><thead class="bg-hover text-gray-400 text-xs"><tr><th class="px-4 py-2.5">Nama</th><th>Tipe</th><th>Status</th></tr></thead>
          <tbody><tr><td class="px-4 py-2.5">Default (azriel-web2)</td><td><span class="bg-accent/10 text-accent px-2 py-0.5 rounded-full text-xs">Firestore</span></td><td><span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full text-xs">Terhubung</span></td></tr></tbody></table></div>
        <p class="text-sm text-gray-500 mt-4">Fitur tambah database setelah MVP.</p>
      </div>`;
  }

  // ============================================================
  // 10. NAVIGATION
  // ============================================================
  const pageMap = {
    dashboard: renderDashboard,
    instances: renderInstances,
    users: renderUsers,
    knowledge: renderKnowledge,
    playground: renderPlayground,
    settings: renderSettings,
    databases: renderDatabases
  };

  function navigate(page) {
    appState.set('currentPage', page);
    document.querySelectorAll('#sidebarNav a').forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-page') === page);
    });
    document.querySelectorAll('#bottomNav .bottom-nav-item[data-nav]').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-nav') === page);
    });
    if (pageMap[page]) pageMap[page]();
    else document.getElementById('mainContent').innerHTML = '<p class="text-center py-20">Halaman tidak ditemukan</p>';
    window.scrollTo(0, 0);
  }

  function setupNavigation() {
    document.querySelectorAll('#sidebarNav a').forEach(a => {
      a.addEventListener('click', e => { e.preventDefault(); navigate(a.getAttribute('data-page')); });
    });
    document.querySelectorAll('#bottomNav .bottom-nav-item[data-nav]').forEach(b => {
      b.addEventListener('click', () => { navigate(b.getAttribute('data-nav')); document.getElementById('moreMenu')?.classList.add('hidden'); });
    });
    document.getElementById('moreBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('moreMenu')?.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#moreBtn')) document.getElementById('moreMenu')?.classList.add('hidden');
    });
  }

  // ============================================================
  // 11. LOG ERROR MODAL HANDLING
  // ============================================================
  function setupLogError() {
    const btn = document.getElementById('logErrorBtn');
    const modal = document.getElementById('logErrorModal');
    const closeBtn = document.getElementById('closeLogError');
    const clearBtn = document.getElementById('clearLogError');

    btn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      renderErrorLog();
    });
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
    clearBtn.addEventListener('click', () => {
      errorLog.length = 0;
      renderErrorLog();
    });
  }

  // ============================================================
  // 12. INIT
  // ============================================================
  function initApp() {
    try {
      // Setup log error
      setupLogError();

      // Firebase
      firebase.initializeApp(CONFIG.firebase);
      setTheme(getTheme());
      initAuth(firebase);
      setupNavigation();

      // Event listeners
      document.addEventListener('auth:login', () => navigate('dashboard'));
      document.addEventListener('auth:logout', () => {
        // tetap di halaman auth, tidak perlu navigate
      });
      window.addEventListener('online', () => showToast('Koneksi kembali', 'success'));
      window.addEventListener('offline', () => showToast('Koneksi terputus.', 'warning'));

      // Theme toggle
      document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
      document.getElementById('themeToggleMobile')?.addEventListener('click', () => {
        toggleTheme();
        document.getElementById('moreMenu')?.classList.add('hidden');
      });

      console.log('🚀 ACE OPERATIONS v2.0.0 ready');
    } catch (err) {
      captureError(err, 'initApp');
      hideLoadingScreen();
      showToast('Error inisialisasi: ' + err.message, 'error');
    }
  }

  // Jalankan saat DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();