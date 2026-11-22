(function (global) {
  let toastTimer = null;
  let lastToastMessage = '';

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {
      // Fallback below
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch (e) {
      return false;
    }
  }

  async function shareToKakao(state, message) {
    const jsKey = (state && state.settings && state.settings.kakaoJsKey ? state.settings.kakaoJsKey : '').trim();

    // 1. Kakao JavaScript SDK (if user configured their Kakao Developers JS key)
    if (jsKey && global.Kakao) {
      try {
        if (!global.Kakao.isInitialized()) {
          global.Kakao.init(jsKey);
        }
        global.Kakao.Share.sendDefault({
          objectType: 'text',
          text: message,
          link: {
            mobileWebUrl: location.href,
            webUrl: location.href
          }
        });
        return { method: 'kakao_sdk', status: '카카오톡 공유창 열림 (SDK)' };
      } catch (err) {
        console.warn('Kakao SDK share failed, falling back:', err);
      }
    }

    // 2. Native Share Sheet (works directly on iPhone / iPad Safari -> pick KakaoTalk!)
    if (navigator.share) {
      try {
        await navigator.share({
          title: '💬 아이 할일 카카오톡 알림',
          text: message
        });
        return { method: 'web_share', status: '카카오톡 공유 완료 (모바일 공유)' };
      } catch (err) {
        if (err && err.name === 'AbortError') {
          return { method: 'cancelled', status: '공유 취소됨 (메시지 복사됨)' };
        }
      }
    }

    // 3. Desktop fallback: copy formatted message to clipboard
    const copied = await copyText(message);
    return {
      method: 'clipboard',
      status: copied ? '메시지 복사됨 (카카오톡에 붙여넣기)' : '알림 기록됨'
    };
  }

  function showKakaoToast(sender, receiver, message, stateRef) {
    const toast = document.getElementById('sms-toast');
    const toEl = document.getElementById('sms-toast-to');
    const bodyEl = document.getElementById('sms-toast-body');
    const timeEl = document.getElementById('sms-toast-time');
    if (!toast) return;

    lastToastMessage = message;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    toEl.textContent = `발신: ${sender || '엄마'}  →  수신: ${receiver || '민수'}`;
    bodyEl.textContent = message;
    timeEl.textContent = `${hh}:${mm}`;
    toast.classList.remove('hidden');

    const shareBtn = document.getElementById('toast-btn-kakao-share');
    const copyBtn = document.getElementById('toast-btn-copy');
    if (shareBtn) {
      shareBtn.onclick = async () => {
        const r = await shareToKakao(stateRef, lastToastMessage);
        if (r.method === 'clipboard') {
          alert('📋 카카오톡 메시지가 복사되었습니다! 카카오톡 채팅방에 붙여넣기(Ctrl+V) 해주세요.');
        }
      };
    }
    if (copyBtn) {
      copyBtn.onclick = async () => {
        await copyText(lastToastMessage);
        copyBtn.textContent = '✓ 복사됨';
        setTimeout(() => {
          copyBtn.textContent = '📋 복사';
        }, 1800);
      };
    }

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 11000);
  }

  function tryBrowserNotification(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          new Notification(title, { body });
        }
      });
    }
  }

  async function dispatchKakao(state, dateStr, message, options) {
    const opts = options || {};
    const sender = (state.settings.kakaoSender || '엄마').trim() || '엄마';
    const receiver = (state.settings.kakaoReceiver || '민수').trim() || '민수';
    const routeText = `${sender} → ${receiver}`;

    const now = new Date();
    const stamp = `${TodoData.toDateStr(now)} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    let status = '카카오톡 알림 준비됨';
    const webhook = (state.settings.webhookUrl || '').trim();

    if (webhook) {
      try {
        const res = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: 'kakaotalk',
            sender,
            receiver,
            date: dateStr,
            message
          })
        });
        status = res.ok ? 'Webhook 자동 발송완료' : `Webhook 오류 (${res.status})`;
      } catch (err) {
        status = 'Webhook 연결 실패 → 직접 공유 대기';
      }
    } else if (opts.triggerShare) {
      const shareRes = await shareToKakao(state, message);
      status = shareRes.status;
    } else {
      await copyText(message);
      status = '알림 생성 · 클립보드 복사됨';
    }

    const logEntry = {
      id: TodoData.uid('kakao'),
      date: dateStr,
      timestamp: stamp,
      sender,
      receiver,
      to: routeText,
      status,
      message
    };

    state.smsLogs.unshift(logEntry);
    if (state.smsLogs.length > 50) state.smsLogs.length = 50;

    showKakaoToast(sender, receiver, message, state);
    tryBrowserNotification(`💬 카카오톡 알림 (${routeText})`, message);
    return logEntry;
  }

  async function settleDay(state, dateStr, options) {
    const opts = options || {};
    const summary = TodoData.getDaySummary(state, dateStr);
    const missingTasks = summary.tasks.filter((t) => !summary.completedIds.includes(t.id));

    if (!state.dailyRecords[dateStr]) {
      state.dailyRecords[dateStr] = {
        completedIds: [],
        settled: false,
        penaltyApplied: 0,
        smsSent: false
      };
    }
    const rec = state.dailyRecords[dateStr];
    const threshold = Number(state.settings.threshold || 70);
    const penaltyAmt = Number(state.settings.penaltyPoints || 0);
    const sender = (state.settings.kakaoSender || '엄마').trim() || '엄마';
    const receiver = (state.settings.kakaoReceiver || '민수').trim() || '민수';

    let penaltyChanged = false;
    let kakaoDispatched = false;

    if (!opts.testOnly) {
      rec.settled = true;
      if (summary.totalCount > 0 && summary.rate < threshold) {
        if (rec.penaltyApplied !== penaltyAmt && penaltyAmt > 0) {
          rec.penaltyApplied = penaltyAmt;
          penaltyChanged = true;
          state.penaltyLogs.unshift({
            id: TodoData.uid('pen'),
            date: dateStr,
            reason: `일일 성취도 ${summary.rate}% (기준 ${threshold}% 미만 마감)`,
            points: -penaltyAmt
          });
        }
      } else if (rec.penaltyApplied > 0) {
        rec.penaltyApplied = 0;
        penaltyChanged = true;
        state.penaltyLogs.unshift({
          id: TodoData.uid('pen'),
          date: dateStr,
          reason: `성취도 ${summary.rate}% 회복 → 감점 취소`,
          points: +penaltyAmt
        });
      }
    }

    const enabled = state.settings.kakaoEnabled !== false;
    const shouldSend =
      missingTasks.length > 0 && (opts.testOnly || (enabled && (!rec.smsSent || opts.forceSms)));

    if (shouldSend) {
      const missedTitles = missingTasks.map((t) => `• ${t.title} (${t.points}점)`).join('\n');
      const penaltyLine =
        summary.rate < threshold
          ? `⚠️ 현재 ${summary.earnedPoints}/100점 (기준 ${threshold}점 미만) → ${penaltyAmt > 0 ? `-${penaltyAmt}점 감점` : '감점 없음'}`
          : `✅ 현재 ${summary.earnedPoints}/100점 (기준 ${threshold}점 달성, 남은 할일 안내)`;

      const msg = `[💬 카카오톡 할일 알림]\n발신: ${sender} → 수신: ${receiver}\n날짜: ${TodoData.formatKoreanDate(dateStr)}\n${penaltyLine}\n\n아직 완료하지 않은 할일 (${missingTasks.length}개):\n${missedTitles}`;
      await dispatchKakao(state, dateStr, msg, { triggerShare: Boolean(opts.triggerShare) });
      if (!opts.testOnly) rec.smsSent = true;
      kakaoDispatched = true;
    } else if (opts.testOnly && missingTasks.length === 0) {
      const msg = `[💬 카카오톡 할일 알림]\n발신: ${sender} → 수신: ${receiver}\n날짜: ${TodoData.formatKoreanDate(dateStr)}\n🏆 오늘의 할일을 100점 만점으로 완료했어요! 정말 최고예요! ⭐`;
      await dispatchKakao(state, dateStr, msg, { triggerShare: Boolean(opts.triggerShare) });
      kakaoDispatched = true;
    }

    TodoData.saveState(state);
    return {
      summary: TodoData.getDaySummary(state, dateStr),
      missingCount: missingTasks.length,
      penaltyChanged,
      smsDispatched: kakaoDispatched
    };
  }

  function isPastCutoff(cutoffTimeStr) {
    if (!cutoffTimeStr || !cutoffTimeStr.includes(':')) return false;
    const [hh, mm] = cutoffTimeStr.split(':').map(Number);
    const now = new Date();
    const curMinutes = now.getHours() * 60 + now.getMinutes();
    return curMinutes >= hh * 60 + mm;
  }

  const api = {
    copyText,
    shareToKakao,
    showKakaoToast,
    showSmsToast: showKakaoToast,
    dispatchKakao,
    settleDay,
    isPastCutoff
  };

  global.KakaoAlertService = api;
  global.SmsService = api;
})(window);
