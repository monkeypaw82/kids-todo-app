(function (global) {
  const SYNC_CFG_KEY = 'kids_todo_sync_cfg_v1';
  const CLIENT_ID = `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  let syncConfig = loadSyncConfig();
  let eventSource = null;
  let pollTimer = null;
  let pushTimer = null;
  let lastSyncedUpdatedAt = 0;
  let isApplyingRemote = false;
  let onRemoteStateCallback = null;
  let onStatusChangeCallback = null;

  function loadSyncConfig() {
    try {
      const raw = localStorage.getItem(SYNC_CFG_KEY);
      if (!raw) return { enabled: false, dbUrl: '', familyCode: '' };
      const parsed = JSON.parse(raw);
      return {
        enabled: Boolean(parsed.enabled),
        dbUrl: String(parsed.dbUrl || '').trim(),
        familyCode: String(parsed.familyCode || '').trim()
      };
    } catch (e) {
      return { enabled: false, dbUrl: '', familyCode: '' };
    }
  }

  function saveSyncConfig(cfg) {
    syncConfig = {
      enabled: Boolean(cfg.enabled),
      dbUrl: normalizeDbUrl(cfg.dbUrl),
      familyCode: String(cfg.familyCode || '').trim()
    };
    try {
      localStorage.setItem(SYNC_CFG_KEY, JSON.stringify(syncConfig));
    } catch (e) {
      console.error('Failed to save sync config:', e);
    }
    return syncConfig;
  }

  function normalizeDbUrl(url) {
    let u = String(url || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    return u.replace(/\/+$/, '');
  }

  function sanitizeFamilyKey(code) {
    const clean = String(code || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9가-힣_-]/g, '_');
    return clean ? `fam_${TodoData.hashPassword(clean)}` : '';
  }

  function getEndpointUrl(cfg) {
    const c = cfg || syncConfig;
    const base = normalizeDbUrl(c.dbUrl);
    const key = sanitizeFamilyKey(c.familyCode);
    if (!base || !key) return '';
    return `${base}/kids_todo/${key}.json`;
  }

  function emitStatus(status, detail) {
    if (typeof onStatusChangeCallback === 'function') {
      onStatusChangeCallback(status, detail || '');
    }
  }

  function syncUrlWithConfig() {
    try {
      const base = `${window.location.origin}${window.location.pathname}`;
      if (syncConfig.enabled && syncConfig.dbUrl && syncConfig.familyCode) {
        const params = new URLSearchParams({
          syncDb: syncConfig.dbUrl,
          syncCode: syncConfig.familyCode
        });
        window.history.replaceState({}, document.title, `${base}?${params.toString()}`);
      } else {
        window.history.replaceState({}, document.title, base);
      }
    } catch (e) {
      // Ignore history errors
    }
  }

  function checkMagicLinkParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      const syncDb = params.get('syncDb');
      const syncCode = params.get('syncCode');
      if (syncDb && syncCode) {
        saveSyncConfig({
          enabled: true,
          dbUrl: syncDb,
          familyCode: syncCode
        });
        // Keep query params intact so "Open in Safari" from KakaoTalk
        // and iOS "Add to Home Screen" preserve the sync connection!
        return true;
      }
    } catch (e) {
      // Ignore URL parse errors
    }
    return false;
  }

  function buildMagicShareLink() {
    if (!syncConfig.dbUrl || !syncConfig.familyCode) return '';
    const base = `${window.location.origin}${window.location.pathname}`;
    const params = new URLSearchParams({
      syncDb: syncConfig.dbUrl,
      syncCode: syncConfig.familyCode
    });
    return `${base}?${params.toString()}`;
  }

  async function pullOnce() {
    const url = getEndpointUrl();
    if (!syncConfig.enabled || !url) return { ok: false, empty: true };
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) {
        emitStatus('error', `서버 응답 오류 (${res.status})`);
        return { ok: false, error: `HTTP ${res.status}` };
      }
      const payload = await res.json();
      if (!payload || !payload.state) {
        emitStatus('connected', '연결됨 (클라우드 초기 상태)');
        return { ok: true, empty: true };
      }
      handleIncomingPayload(payload);
      emitStatus('connected', '실시간 동기화 중');
      return { ok: true, empty: false, payload };
    } catch (err) {
      emitStatus('error', '네트워크 또는 권한 오류');
      return { ok: false, error: err.message || 'Network error' };
    }
  }

  function handleIncomingPayload(payload) {
    if (!payload || !payload.state) return;
    if (payload.clientId === CLIENT_ID) return;
    const remoteTs = Number(payload.updatedAt || 0);
    if (remoteTs <= lastSyncedUpdatedAt) return;

    lastSyncedUpdatedAt = remoteTs;
    isApplyingRemote = true;
    try {
      if (typeof onRemoteStateCallback === 'function') {
        onRemoteStateCallback(payload.state, remoteTs);
      }
    } finally {
      isApplyingRemote = false;
    }
  }

  async function pushNow(state) {
    const url = getEndpointUrl();
    if (!syncConfig.enabled || !url || isApplyingRemote) return { ok: false };

    const ts = Date.now();
    lastSyncedUpdatedAt = ts;
    emitStatus('syncing', '저장 중...');
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updatedAt: ts,
          clientId: CLIENT_ID,
          state
        })
      });
      if (!res.ok) {
        emitStatus('error', `저장 오류 (${res.status})`);
        return { ok: false, error: `HTTP ${res.status}` };
      }
      emitStatus('connected', '실시간 동기화됨');
      return { ok: true };
    } catch (err) {
      emitStatus('error', '동기화 연결 실패');
      return { ok: false, error: err.message || 'Network error' };
    }
  }

  function schedulePush(state) {
    if (!syncConfig.enabled || !getEndpointUrl() || isApplyingRemote) return;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      pushNow(state);
    }, 350);
  }

  function stopListeners() {
    if (eventSource) {
      try {
        eventSource.close();
      } catch (e) {
        // Ignore
      }
      eventSource = null;
    }
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function startListeners() {
    stopListeners();
    const url = getEndpointUrl();
    if (!syncConfig.enabled || !url) {
      emitStatus('offline', '미연결');
      return;
    }

    emitStatus('syncing', '연결 중...');

    // 1. Firebase Realtime Database SSE Stream (instant push across devices!)
    if (typeof EventSource !== 'undefined') {
      try {
        eventSource = new EventSource(url);
        eventSource.addEventListener('put', (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg && msg.path === '/' && msg.data && msg.data.state) {
              handleIncomingPayload(msg.data);
            }
            emitStatus('connected', '실시간 동기화 중');
          } catch (e) {
            // Ignore malformed chunk
          }
        });
        eventSource.onerror = () => {
          // Fallback polling continues quietly even if SSE reconnects
          emitStatus('connected', '자동 동기화 중');
        };
      } catch (e) {
        // Ignore EventSource errors and rely on polling
      }
    }

    // 2. Fallback visibility-aware polling (essential for iOS Safari background resume)
    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        pullOnce();
      }
    }, 5000);
  }

  async function connectAndSync(newCfg, currentState) {
    saveSyncConfig(Object.assign({}, newCfg, { enabled: true }));
    const pulled = await pullOnce();
    if (!pulled.ok) {
      return pulled;
    }
    if (pulled.empty) {
      const pushed = await pushNow(currentState);
      if (!pushed.ok) return pushed;
    }
    syncUrlWithConfig();
    startListeners();
    return { ok: true, pulledFromCloud: !pulled.empty };
  }

  function disconnect() {
    stopListeners();
    saveSyncConfig({
      enabled: false,
      dbUrl: syncConfig.dbUrl,
      familyCode: syncConfig.familyCode
    });
    syncUrlWithConfig();
    emitStatus('offline', '미연결');
  }

  function init(callbacks) {
    onRemoteStateCallback = callbacks && callbacks.onRemoteState;
    onStatusChangeCallback = callbacks && callbacks.onStatusChange;

    const fromMagicLink = checkMagicLinkParams();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && syncConfig.enabled && getEndpointUrl()) {
        pullOnce();
      }
    });

    if (syncConfig.enabled && getEndpointUrl()) {
      syncUrlWithConfig();
      pullOnce().then(() => {
        startListeners();
      });
    } else {
      emitStatus('offline', '미연결');
    }

    return { fromMagicLink, config: syncConfig };
  }

  global.SyncService = {
    init,
    getConfig: () => Object.assign({}, syncConfig),
    connectAndSync,
    disconnect,
    pullOnce,
    pushNow,
    schedulePush,
    buildMagicShareLink
  };
})(window);
