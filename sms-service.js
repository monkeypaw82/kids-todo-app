(function (global) {
  let toastTimer = null;

  function showSmsToast(toText, message) {
    const toast = document.getElementById('sms-toast');
    const toEl = document.getElementById('sms-toast-to');
    const bodyEl = document.getElementById('sms-toast-body');
    const timeEl = document.getElementById('sms-toast-time');
    if (!toast) return;

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');

    toEl.textContent = `수신: ${toText || '보호자'}`;
    bodyEl.textContent = message;
    timeEl.textContent = `${hh}:${mm}`;
    toast.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 8500);
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

  async function dispatchSms(state, dateStr, message) {
    const recipients = [state.settings.parentPhone, state.settings.childPhone]
      .map((s) => (s || '').trim())
      .filter(Boolean);
    const toText = recipients.length ? recipients.join(', ') : '미지정 번호 (시뮬레이터)';

    const now = new Date();
    const stamp = `${TodoData.toDateStr(now)} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    let status = '발송완료 (시뮬레이터)';
    const webhook = (state.settings.webhookUrl || '').trim();

    if (webhook) {
      try {
        const res = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipients,
            date: dateStr,
            message
          })
        });
        status = res.ok ? '실제 Webhook 발송완료' : `Webhook 응답 오류 (${res.status})`;
      } catch (err) {
        status = 'Webhook 연결 실패 → 시뮬레이터 대체';
      }
    }

    const logEntry = {
      id: TodoData.uid('sms'),
      date: dateStr,
      timestamp: stamp,
      to: toText,
      status,
      message
    };

    state.smsLogs.unshift(logEntry);
    if (state.smsLogs.length > 50) state.smsLogs.length = 50;

    showSmsToast(toText, message);
    tryBrowserNotification('📱 아이 할일 SMS 알림', message);
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

    let penaltyChanged = false;
    let smsDispatched = false;

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
      } else {
        // Passed! Clear any previous penalty for this date
        if (rec.penaltyApplied > 0) {
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
    }

    const shouldSendSms =
      missingTasks.length > 0 && (opts.testOnly || (state.settings.smsEnabled && (!rec.smsSent || opts.forceSms)));

    if (shouldSendSms) {
      const missedTitles = missingTasks.map((t) => `• ${t.title}`).join('\n');
      const penaltyLine =
        summary.rate < threshold
          ? `⚠️ 성취도 ${summary.rate}% (기준 ${threshold}% 미만) → ${penaltyAmt > 0 ? `-${penaltyAmt}점 감점 적용` : '감점 없음'}`
          : `✅ 현재 성취도 ${summary.rate}% (기준 ${threshold}% 달성, 남은 할일 안내)`;

      const msg = `[아이 할일 일일 알림] ${TodoData.formatKoreanDate(dateStr)}\n${penaltyLine}\n\n아직 완료하지 않은 할일 (${missingTasks.length}개):\n${missedTitles}`;
      await dispatchSms(state, dateStr, msg);
      if (!opts.testOnly) rec.smsSent = true;
      smsDispatched = true;
    } else if (opts.testOnly && missingTasks.length === 0) {
      const msg = `[아이 할일 일일 알림] ${TodoData.formatKoreanDate(dateStr)}\n🎉 오늘의 모든 할일을 100% 완료했어요! 아주 칭찬해요! ⭐`;
      await dispatchSms(state, dateStr, msg);
      smsDispatched = true;
    }

    TodoData.saveState(state);
    return {
      summary: TodoData.getDaySummary(state, dateStr),
      missingCount: missingTasks.length,
      penaltyChanged,
      smsDispatched
    };
  }

  function isPastCutoff(cutoffTimeStr) {
    if (!cutoffTimeStr || !cutoffTimeStr.includes(':')) return false;
    const [hh, mm] = cutoffTimeStr.split(':').map(Number);
    const now = new Date();
    const curMinutes = now.getHours() * 60 + now.getMinutes();
    return curMinutes >= hh * 60 + mm;
  }

  global.SmsService = {
    showSmsToast,
    dispatchSms,
    settleDay,
    isPastCutoff
  };
})(window);
