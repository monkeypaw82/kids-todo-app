(function () {
  const TASK_EMOJIS = ['🛏️', '✏️', '📖', '🎹', '🏃', '🪥', '🧸', '🎨', '🎒', '🧼', '⚽', '📓', '🔢', '🔤', '🧹', '🌙'];
  const GIFT_EMOJIS = ['🎁', '🧱', '🍦', '🎡', '🎮', '🚲', '📚', '🧸', '🍰', '🎨', '⚽', '🎟️'];

  let state = TodoData.loadState();
  if (!state.admin) state.admin = { passwordHash: '' };

  let selectedDate = TodoData.getTodayStr();
  let calYear = TodoData.parseDateStr(selectedDate).getFullYear();
  let calMonth = TodoData.parseDateStr(selectedDate).getMonth();
  let selectedCalDate = selectedDate;

  // Admin state
  let isAdminUnlocked = false;
  let adminSelectedWeekday = TodoData.getWeekdayIndex(selectedDate);
  let selectedGiftEmoji = '🎁';

  // Photo editor transient state
  let editorConfig = null;
  let editorUploadedImg = null;
  let isDraggingCanvas = false;
  let dragStartX = 0;
  let dragStartY = 0;

  function playChime(type) {
    if (!state.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const notes =
        type === 'celebrate'
          ? [523.25, 659.25, 783.99, 1046.5]
          : type === 'check'
          ? [587.33, 880]
          : [349.23, 293.66];

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.09, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.24);
      });
    } catch (e) {
      // Ignore audio errors
    }
  }

  // Cheerful Nintendo-style 100-point victory fanfare
  function playFanfare100() {
    if (!state.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const melody = [
        { freq: 523.25, t: 0.0, d: 0.14, type: 'triangle' },  // C5
        { freq: 659.25, t: 0.12, d: 0.14, type: 'triangle' }, // E5
        { freq: 783.99, t: 0.24, d: 0.14, type: 'triangle' }, // G5
        { freq: 1046.5, t: 0.38, d: 0.45, type: 'triangle' }, // C6
        { freq: 783.99, t: 0.56, d: 0.16, type: 'sine' },     // G5
        { freq: 1046.5, t: 0.72, d: 0.65, type: 'triangle' }, // C6
        { freq: 1318.5, t: 0.72, d: 0.65, type: 'sine' },     // E6 harmony
        { freq: 1567.98, t: 0.72, d: 0.65, type: 'sine' }     // G6 harmony
      ];

      melody.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = n.type;
        osc.frequency.setValueAtTime(n.freq, now + n.t);
        gain.gain.setValueAtTime(0.001, now + n.t);
        gain.gain.linearRampToValueAtTime(0.12, now + n.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.04);
      });
    } catch (e) {
      // Ignore audio errors
    }
  }

  function showBigCelebration100() {
    playFanfare100();
    const overlay = document.getElementById('celebration-overlay');
    if (overlay) overlay.classList.remove('hidden');

    // Multi-wave fireworks confetti!
    const w = window.innerWidth;
    const h = window.innerHeight;
    launchConfetti(w * 0.5, h * 0.35, 55);
    setTimeout(() => launchConfetti(w * 0.22, h * 0.3, 40), 260);
    setTimeout(() => launchConfetti(w * 0.78, h * 0.3, 40), 520);
    setTimeout(() => launchConfetti(w * 0.5, h * 0.22, 48), 820);
  }

  function launchConfetti(originX, originY, count) {
    const layer = document.getElementById('confetti-layer');
    if (!layer) return;
    const colors = ['#ff6b4a', '#ffb800', '#1eb9a8', '#4ea8de', '#a78bfa', '#f472b6'];
    const cx = originX != null ? originX : window.innerWidth / 2;
    const cy = originY != null ? originY : window.innerHeight * 0.35;
    const total = count || 28;

    for (let i = 0; i < total; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-piece';
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 190;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 60 + Math.random() * 120;
      el.style.left = `${cx}px`;
      el.style.top = `${cy}px`;
      el.style.backgroundColor = colors[i % colors.length];
      el.style.setProperty('--dx', `${dx}px`);
      el.style.setProperty('--dy', `${dy}px`);
      el.style.setProperty('--rot', `${Math.round(Math.random() * 540 - 270)}deg`);
      layer.appendChild(el);
      setTimeout(() => el.remove(), 1200);
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureHeroPhoto() {
    if (!state.profile.photoDataUrl) {
      state.profile.photoDataUrl = PhotoEditor.generateDefaultHeroDataUrl(state.profile.photoMeta);
      TodoData.saveState(state);
    }
  }

  // ==================== KID SINGLE-PAGE RENDERING ====================
  function renderHero() {
    ensureHeroPhoto();
    document.getElementById('hero-photo-img').src = state.profile.photoDataUrl;
    document.getElementById('hero-title').textContent = state.profile.title || '아이의 오늘도 화이팅! 🌟';
    document.getElementById('hero-subtitle').textContent =
      state.profile.subtitle || '오늘의 할일을 완료하고 멋진 선물을 받아보세요!';

    const stats = TodoData.getTotalStats(state);
    document.getElementById('stat-total-points').textContent = `${stats.totalPoints} ⭐`;
    document.getElementById('stat-streak').textContent = `${stats.streak}일 🔥`;
    document.getElementById('stat-today-rate').textContent = `${stats.todayRate}%`;

    const soundBtn = document.getElementById('btn-sound-toggle');
    soundBtn.textContent = state.soundEnabled ? '🔊' : '🔇';
  }

  function renderWeekdayBoard() {
    const today = TodoData.getTodayStr();
    const weekDates = TodoData.getWeekDatesFor(selectedDate);
    const tabsEl = document.getElementById('weekday-tabs');
    tabsEl.innerHTML = '';

    weekDates.forEach((dStr) => {
      const wd = TodoData.getWeekdayIndex(dStr);
      const dt = TodoData.parseDateStr(dStr);
      const sum = TodoData.getDaySummary(state, dStr);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'weekday-btn';
      if (wd === 0) btn.classList.add('sun');
      if (wd === 6) btn.classList.add('sat');
      if (dStr === selectedDate) btn.classList.add('active');

      let dotClass = '';
      if (sum.perfect) dotClass = 'perfect';
      else if (sum.passed) dotClass = 'pass';
      else if (sum.settled || dStr < today) dotClass = 'fail';

      btn.innerHTML = `
        ${dStr === today ? '<span class="today-badge">오늘</span>' : ''}
        <span class="wd-name">${TodoData.WEEKDAYS_KO[wd]}</span>
        <span class="wd-date">${dt.getMonth() + 1}/${dt.getDate()}</span>
        <span class="wd-dot ${dotClass}"></span>
      `;
      btn.addEventListener('click', () => {
        selectedDate = dStr;
        renderWeekdayBoard();
      });
      tabsEl.appendChild(btn);
    });

    const summary = TodoData.getDaySummary(state, selectedDate);
    document.getElementById('selected-date-label').textContent = TodoData.formatKoreanDate(selectedDate);
    document.getElementById('task-list-heading').textContent = `${TodoData.WEEKDAYS_KO[summary.weekday]}요일 할일 (${summary.doneCount}/${summary.totalCount})`;

    const fill = document.getElementById('progress-fill');
    fill.style.width = `${summary.rate}%`;
    fill.classList.remove('passed', 'perfect');
    if (summary.perfect) fill.classList.add('perfect');
    else if (summary.passed) fill.classList.add('passed');

    const threshold = summary.threshold;
    document.getElementById('threshold-marker').style.left = `${threshold}%`;
    document.getElementById('threshold-marker-label').textContent = `기준 ${threshold}%`;
    document.getElementById('progress-percent').textContent = `${summary.rate}%`;
    document.getElementById('progress-fraction').textContent = `${summary.doneCount} / ${summary.totalCount} 완료`;

    const statusText = document.getElementById('progress-status-text');
    const alertBanner = document.getElementById('threshold-alert-banner');
    alertBanner.className = 'threshold-alert-banner';

    if (summary.totalCount === 0) {
      statusText.textContent = '등록된 할일이 없어요';
      alertBanner.classList.add('ok');
      alertBanner.textContent = '🔒 관리자 메뉴의 "할일 편집"에서 요일별 할일을 설정할 수 있어요.';
    } else if (summary.perfect) {
      statusText.textContent = '와! 오늘 할일을 100% 끝냈어요! 🏆';
      alertBanner.classList.add('perfect');
      alertBanner.textContent = `🌟 최고예요! 오늘 +${summary.earnedPoints}점을 모두 획득했습니다!`;
    } else if (summary.passed) {
      statusText.textContent = '목표 성취도 달성 성공! 🎉';
      alertBanner.classList.add('ok');
      alertBanner.textContent = `✅ 성취도 ${summary.rate}%로 기준(${threshold}%)을 넘었어요! 남은 ${summary.totalCount - summary.doneCount}개도 도전해볼까요?`;
    } else {
      statusText.textContent = '조금만 더 힘내자! 💪';
      alertBanner.classList.add('warn');
      if (summary.penaltyPoints > 0) {
        alertBanner.textContent = `⚠️ 기준(${threshold}%) 미달로 -${summary.penaltyPoints}점 감점되었어요. 지금 완료하면 감점이 취소돼요!`;
      } else {
        alertBanner.textContent = `⚠️ 현재 ${summary.earnedPoints}점 (목표 ${threshold}점) — ${state.settings.cutoffTime}까지 미달 시 -${state.settings.penaltyPoints}점 감점 및 카카오톡 알림!`;
      }
    }

    const ptsSummaryEl = document.getElementById('day-points-summary');
    ptsSummaryEl.textContent =
      summary.penaltyPoints > 0
        ? `+${summary.earnedPoints}/100점 (감점 -${summary.penaltyPoints})`
        : `오늘 ${summary.earnedPoints} / 100점`;

    // Kid Checklist (check-only, tap anywhere on row)
    const listEl = document.getElementById('task-list');
    const emptyEl = document.getElementById('task-empty');
    listEl.innerHTML = '';

    if (summary.tasks.length === 0) {
      emptyEl.classList.remove('hidden');
    } else {
      emptyEl.classList.add('hidden');
      summary.tasks.forEach((task) => {
        const isDone = summary.completedIds.includes(task.id);
        const li = document.createElement('li');
        li.className = `task-item${isDone ? ' done' : ''}`;
        li.innerHTML = `
          <button type="button" class="task-check-btn" aria-label="${escapeHtml(task.title)} 완료 체크">
            ${isDone ? '✓' : ''}
          </button>
          <div class="task-emoji">${task.emoji || '⭐'}</div>
          <div class="task-content">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-meta">
              <span class="cat-badge" data-cat="${escapeHtml(task.category)}">${escapeHtml(task.category)}</span>
              <span class="pts-badge">+${task.points} ⭐</span>
            </div>
          </div>
        `;

        li.addEventListener('click', (ev) => {
          toggleTask(selectedDate, task.id, ev.clientX, ev.clientY);
        });

        listEl.appendChild(li);
      });
    }
  }

  function renderCalendarAndGift() {
    const today = TodoData.getTodayStr();
    document.getElementById('cal-month-title').textContent = `${calYear}년 ${calMonth + 1}월`;

    const firstDay = new Date(calYear, calMonth, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

    const gridEl = document.getElementById('calendar-days');
    gridEl.innerHTML = '';

    for (let i = 0; i < startWeekday; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal-cell empty';
      gridEl.appendChild(empty);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const sum = TodoData.getDaySummary(state, dStr);
      const hasRecord = Boolean(state.dailyRecords[dStr]);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-cell';
      if (dStr === today) btn.classList.add('today');
      if (dStr === selectedCalDate) btn.classList.add('selected');

      let icon = '';
      let rateTxt = '';
      if (hasRecord && sum.totalCount > 0) {
        if (sum.perfect) {
          btn.classList.add('perfect');
          icon = '🏆';
        } else if (sum.passed) {
          btn.classList.add('pass');
          icon = '✅';
        } else {
          btn.classList.add('fail');
          icon = '⚠️';
        }
        rateTxt = `${sum.rate}%`;
      }

      btn.innerHTML = `
        <span class="cal-day-num">${day}</span>
        <span class="cal-day-icon">${icon}</span>
        <span class="cal-day-rate">${rateTxt}</span>
      `;
      btn.addEventListener('click', () => {
        selectedCalDate = dStr;
        renderCalendarAndGift();
      });
      gridEl.appendChild(btn);
    }

    const detailEl = document.getElementById('cal-day-detail');
    const calSum = TodoData.getDaySummary(state, selectedCalDate);
    const statusLabel = calSum.perfect
      ? '🏆 완벽 달성 (100%)'
      : calSum.passed
      ? `✅ 기준 달성 (${calSum.rate}%)`
      : calSum.penaltyPoints > 0
      ? `⚠️ 기준 미달 (${calSum.rate}%, -${calSum.penaltyPoints}점)`
      : `📝 성취도 ${calSum.rate}%`;

    detailEl.innerHTML = `
      <div class="cal-detail-head">
        <div>
          <strong>${TodoData.formatKoreanDate(selectedCalDate)}</strong>
          <div class="section-sub">${statusLabel} · 순포인트 ${calSum.netPoints >= 0 ? '+' : ''}${calSum.netPoints}점</div>
        </div>
        <button type="button" id="btn-jump-to-date" class="btn btn-soft-sm">할일 보기 ↑</button>
      </div>
      <div class="cal-detail-tasks">
        ${
          calSum.tasks.length
            ? calSum.tasks
                .map((t) => {
                  const done = calSum.completedIds.includes(t.id);
                  return `<span class="mini-task-pill${done ? ' done' : ''}">${done ? '✓' : '○'} ${escapeHtml(t.title)}</span>`;
                })
                .join('')
            : '<span class="section-sub">등록된 할일이 없습니다.</span>'
        }
      </div>
    `;

    document.getElementById('btn-jump-to-date').addEventListener('click', () => {
      selectedDate = selectedCalDate;
      renderWeekdayBoard();
      document.getElementById('section-tasks').scrollIntoView({ behavior: 'smooth' });
    });

    // Kid Gift Progress Card (Score-based Multi-Tier)
    const cycle = TodoData.getCurrentGiftCycle(state, today);
    document.getElementById('gift-cycle-period').textContent = `${cycle.cycleDays}일 주기 (${cycle.cycleStart} ~ ${cycle.cycleEnd})`;
    document.getElementById('gift-cycle-score-pill').textContent = `이번 주기 ${cycle.cyclePoints}점 ⭐`;

    const tiersListEl = document.getElementById('gift-tiers-list');
    tiersListEl.innerHTML = '';

    if (cycle.tiers.length === 0) {
      tiersListEl.innerHTML = '<div class="section-sub">관리자 메뉴에서 목표 점수별 선물을 등록해주세요!</div>';
    } else {
      cycle.tiers.forEach((tier) => {
        const card = document.createElement('div');
        card.className = `gift-tier-card${tier.claimed ? ' claimed' : tier.qualified ? ' qualified' : ''}`;
        const badgeText = tier.claimed
          ? '🎉 수령 완료'
          : tier.qualified
          ? '✨ 자격 획득!'
          : `${tier.remainingPoints}점 남음`;
        const badgeClass = tier.claimed ? 'done' : tier.qualified ? 'ready' : '';

        card.innerHTML = `
          <div class="gift-tier-top">
            <div class="gift-tier-emoji">${tier.emoji || '🎁'}</div>
            <div class="gift-tier-info">
              <div class="gift-tier-name">${escapeHtml(tier.name)}</div>
              <div class="gift-tier-target">목표 ${tier.targetPoints}점 (${cycle.cyclePoints} / ${tier.targetPoints}점)</div>
            </div>
            <span class="gift-tier-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="mini-track">
            <div class="mini-fill ${tier.qualified ? 'mint' : 'gold'}" style="width: ${tier.pct}%"></div>
          </div>
        `;
        tiersListEl.appendChild(card);
      });
    }

    const qualBanner = document.getElementById('gift-qualified-banner');
    if (cycle.anyQualified) {
      qualBanner.classList.remove('hidden');
    } else {
      qualBanner.classList.add('hidden');
    }

    const histEl = document.getElementById('gift-history-list');
    histEl.innerHTML = '';
    if (state.giftClaims.length === 0) {
      histEl.innerHTML = '<li class="section-sub">아직 받은 선물이 없어요. 첫 선물에 도전!</li>';
    } else {
      state.giftClaims.slice(0, 5).forEach((item) => {
        const li = document.createElement('li');
        li.className = 'gift-history-item';
        li.innerHTML = `
          <span><strong>${item.giftEmoji} ${escapeHtml(item.giftName)}</strong></span>
          <span class="section-sub">${item.claimedAt}</span>
        `;
        histEl.appendChild(li);
      });
    }
  }

  // ==================== ADMIN PANEL RENDERING ====================
  function renderAdminTasks() {
    const pillsEl = document.getElementById('admin-weekday-pills');
    pillsEl.innerHTML = '';
    TodoData.WEEKDAY_ORDER.forEach((wd) => {
      const count = (state.weekdayTasks[wd] || []).length;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `admin-wd-btn${wd === adminSelectedWeekday ? ' active' : ''}`;
      btn.textContent = `${TodoData.WEEKDAYS_KO[wd]} (${count})`;
      btn.addEventListener('click', () => {
        adminSelectedWeekday = wd;
        renderAdminTasks();
      });
      pillsEl.appendChild(btn);
    });

    const listEl = document.getElementById('admin-task-list');
    const tasks = state.weekdayTasks[adminSelectedWeekday] || [];
    const totalPts = tasks.reduce((sum, t) => sum + Number(t.points || 0), 0);
    const totalLbl = document.getElementById('admin-day-total-label');
    const totalBadge = document.getElementById('admin-day-total-badge');
    if (totalLbl) totalLbl.textContent = `${TodoData.WEEKDAYS_KO[adminSelectedWeekday]}요일 하루 총점 (${tasks.length}개 항목)`;
    if (totalBadge) totalBadge.textContent = tasks.length ? `${totalPts} / 100점 고정` : '0점 (할일 없음)';

    listEl.innerHTML = '';

    if (tasks.length === 0) {
      listEl.innerHTML = `<li class="section-sub" style="padding: 16px; text-align:center;">${TodoData.WEEKDAYS_KO[adminSelectedWeekday]}요일에 등록된 할일이 없습니다. 상단 버튼으로 항목을 추가하세요.</li>`;
      return;
    }

    tasks.forEach((task) => {
      const li = document.createElement('li');
      li.className = 'admin-task-row';
      li.innerHTML = `
        <div class="task-emoji">${task.emoji || '⭐'}</div>
        <div class="task-content">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-meta">
            <span class="cat-badge" data-cat="${escapeHtml(task.category)}">${escapeHtml(task.category)}</span>
            <span class="pts-badge">${task.points}점 ⭐</span>
          </div>
        </div>
        <div class="admin-task-actions">
          <button type="button" class="btn btn-soft-sm btn-admin-edit">✏️ 편집</button>
          <button type="button" class="icon-btn-sm btn-admin-del" title="삭제">🗑️</button>
        </div>
      `;

      li.querySelector('.btn-admin-edit').addEventListener('click', () => {
        openTaskModal(task, adminSelectedWeekday);
      });

      li.querySelector('.btn-admin-del').addEventListener('click', () => {
        if (confirm(`"${task.title}" 항목을 ${TodoData.WEEKDAYS_KO[adminSelectedWeekday]}요일에서 삭제할까요? (남은 항목은 총점 100점으로 자동 재계산됩니다)`)) {
          state.weekdayTasks[adminSelectedWeekday] = tasks.filter((t) => t.id !== task.id);
          TodoData.normalizeDayPoints(state.weekdayTasks[adminSelectedWeekday]);
          TodoData.saveState(state);
          renderAll();
        }
      });

      listEl.appendChild(li);
    });
  }

  function renderAdminGift() {
    const cfg = state.giftConfig;
    document.getElementById('gift-cycle-days').value = String(cfg.cycleDays || 7);

    const ep = document.getElementById('gift-emoji-picker');
    ep.innerHTML = '';
    GIFT_EMOJIS.forEach((em) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `emoji-opt${em === selectedGiftEmoji ? ' active' : ''}`;
      b.textContent = em;
      b.addEventListener('click', () => {
        selectedGiftEmoji = em;
        ep.querySelectorAll('.emoji-opt').forEach((x) => x.classList.toggle('active', x.textContent === em));
      });
      ep.appendChild(b);
    });

    const today = TodoData.getTodayStr();
    const cycle = TodoData.getCurrentGiftCycle(state, today);
    document.getElementById('admin-gift-status-box').innerHTML = `
      <div><strong>현재 주기:</strong> ${cycle.cycleStart} ~ ${cycle.cycleEnd} (${cycle.cycleDays}일 주기)</div>
      <div><strong>이번 주기 누적 순포인트:</strong> <span style="color:var(--primary);font-weight:800;">${cycle.cyclePoints}점</span> (목표 달성 ${cycle.passedDays}일)</div>
    `;

    const listEl = document.getElementById('admin-gift-tiers-list');
    listEl.innerHTML = '';
    if (cycle.tiers.length === 0) {
      listEl.innerHTML = '<li class="section-sub" style="padding:12px;">등록된 목표 점수별 선물이 없습니다. 좌측에서 추가해주세요.</li>';
      return;
    }

    cycle.tiers.forEach((tier) => {
      const li = document.createElement('li');
      li.className = 'admin-task-row';
      li.innerHTML = `
        <div class="task-emoji">${tier.emoji || '🎁'}</div>
        <div class="task-content">
          <div class="task-title">${escapeHtml(tier.name)}</div>
          <div class="task-meta">
            <span class="pts-badge">목표 ${tier.targetPoints}점</span>
            <span class="section-sub">${
              tier.claimed
                ? '🎉 수령 완료됨'
                : tier.qualified
                ? '✨ 자격 달성!'
                : `${tier.remainingPoints}점 남음`
            }</span>
          </div>
        </div>
        <div class="admin-task-actions">
          ${
            tier.qualified && !tier.claimed
              ? '<button type="button" class="btn btn-warning btn-tier-claim" style="min-height:34px;padding:6px 10px;font-size:12px;">🎁 수령 완료</button>'
              : ''
          }
          <button type="button" class="icon-btn-sm btn-tier-del" title="삭제">🗑️</button>
        </div>
      `;

      const claimBtn = li.querySelector('.btn-tier-claim');
      if (claimBtn) {
        claimBtn.addEventListener('click', () => {
          state.giftClaims.unshift({
            id: TodoData.uid('gift'),
            claimKey: tier.claimKey,
            claimedAt: today,
            cycleLabel: `${cycle.cycleStart} ~ ${cycle.cycleEnd}`,
            giftName: `${tier.name} (${tier.targetPoints}점)`,
            giftEmoji: tier.emoji || '🎁'
          });
          TodoData.saveState(state);
          playFanfare100();
          launchConfetti(window.innerWidth / 2, window.innerHeight / 2, 55);
          renderAll();
        });
      }

      li.querySelector('.btn-tier-del').addEventListener('click', () => {
        if (confirm(`"${tier.name} (${tier.targetPoints}점)" 선물을 목록에서 삭제할까요?`)) {
          state.giftConfig.tiers = (state.giftConfig.tiers || []).filter((t) => t.id !== tier.id);
          TodoData.saveState(state);
          renderAll();
        }
      });

      listEl.appendChild(li);
    });
  }

  function renderAdminSmsAndLogs() {
    const s = state.settings;
    document.getElementById('setting-threshold').value = s.threshold;
    document.getElementById('setting-threshold-val').textContent = `${s.threshold}%`;
    document.getElementById('setting-penalty').value = s.penaltyPoints;
    document.getElementById('setting-cutoff').value = s.cutoffTime;
    document.getElementById('setting-sms-enabled').checked = s.kakaoEnabled !== false;
    document.getElementById('setting-kakao-sender').value = s.kakaoSender || '엄마';
    document.getElementById('setting-kakao-receiver').value = s.kakaoReceiver || '민수';
    document.getElementById('setting-kakao-key').value = s.kakaoJsKey || '';
    document.getElementById('setting-webhook').value = s.webhookUrl || '';

    const smsList = document.getElementById('sms-log-list');
    smsList.innerHTML = '';
    if (state.smsLogs.length === 0) {
      smsList.innerHTML = '<div class="section-sub">아직 생성된 카카오톡 알림 내역이 없습니다.</div>';
    } else {
      state.smsLogs.forEach((log) => {
        const div = document.createElement('div');
        div.className = 'sms-log-item';
        const routeLabel =
          log.sender || log.receiver
            ? `발신: ${log.sender || '엄마'} → 수신: ${log.receiver || '민수'}`
            : `대상: ${log.to || '미지정'}`;
        div.innerHTML = `
          <div class="sms-log-meta">
            <span><strong>${escapeHtml(routeLabel)}</strong></span>
            <span>${escapeHtml(log.timestamp)} · ${escapeHtml(log.status)}</span>
          </div>
          <div class="sms-log-msg">${escapeHtml(log.message)}</div>
          <div class="log-item-actions">
            <button type="button" class="btn btn-kakao-sm btn-log-share">💬 카톡 공유</button>
            <button type="button" class="btn btn-soft-sm btn-log-copy">📋 복사</button>
          </div>
        `;
        div.querySelector('.btn-log-share').addEventListener('click', async () => {
          const r = await KakaoAlertService.shareToKakao(state, log.message);
          if (r.method === 'clipboard') {
            alert('📋 카카오톡 메시지가 복사되었습니다! 카카오톡 채팅방에 붙여넣기 해주세요.');
          }
        });
        div.querySelector('.btn-log-copy').addEventListener('click', async (ev) => {
          await KakaoAlertService.copyText(log.message);
          ev.currentTarget.textContent = '✓ 복사됨';
          setTimeout(() => {
            ev.currentTarget.textContent = '📋 복사';
          }, 1600);
        });
        smsList.appendChild(div);
      });
    }

    const penList = document.getElementById('penalty-log-list');
    penList.innerHTML = '';
    if (state.penaltyLogs.length === 0) {
      penList.innerHTML = '<div class="section-sub">감점 및 변동 기록이 없습니다.</div>';
    } else {
      state.penaltyLogs.forEach((log) => {
        const isDeduct = log.points < 0;
        const div = document.createElement('div');
        div.className = `penalty-log-item${isDeduct ? ' deduct' : ''}`;
        div.innerHTML = `
          <div>
            <div><strong>${log.date}</strong></div>
            <div class="section-sub">${escapeHtml(log.reason)}</div>
          </div>
          <span class="penalty-pts${isDeduct ? '' : ' plus'}">${log.points > 0 ? '+' : ''}${log.points}점</span>
        `;
        penList.appendChild(div);
      });
    }
  }

  function updateSyncStatusUI(status, detail) {
    const pill = document.getElementById('sync-status-pill');
    const adminBox = document.getElementById('sync-admin-status');
    if (pill) {
      if (status === 'offline') {
        pill.className = 'sync-pill offline';
        pill.textContent = '☁️ 동기화 미연결';
      } else if (status === 'syncing') {
        pill.className = 'sync-pill syncing';
        pill.textContent = `🔄 ${detail || '동기화 중...'}`;
      } else if (status === 'error') {
        pill.className = 'sync-pill error';
        pill.textContent = `⚠️ ${detail || '동기화 오류'}`;
      } else {
        pill.className = 'sync-pill';
        pill.textContent = `☁️ ${detail || '실시간 동기화'}`;
      }
    }
    if (adminBox) {
      const cfg = SyncService.getConfig();
      if (!cfg.enabled || !cfg.dbUrl) {
        adminBox.textContent = '상태: 미연결 (현재 기기만 저장 중)';
      } else if (status === 'error') {
        adminBox.textContent = `상태: ⚠️ ${detail || '연결 오류'} (Firebase DB 규칙이 테스트 모드인지 확인해주세요)`;
      } else {
        adminBox.textContent = `상태: ✅ ${detail || '실시간 동기화 중'} (가족 코드: ${cfg.familyCode})`;
      }
    }
  }

  function renderAdminSync() {
    if (!window.SyncService) return;
    const cfg = SyncService.getConfig();
    const urlInput = document.getElementById('sync-db-url');
    const codeInput = document.getElementById('sync-family-code');
    const magicInput = document.getElementById('sync-magic-link');
    if (urlInput && document.activeElement !== urlInput) urlInput.value = cfg.dbUrl || '';
    if (codeInput && document.activeElement !== codeInput) codeInput.value = cfg.familyCode || '';
    if (magicInput) {
      magicInput.value = cfg.enabled ? SyncService.buildMagicShareLink() : '';
    }
  }

  function renderAll() {
    renderHero();
    renderWeekdayBoard();
    renderCalendarAndGift();
    if (isAdminUnlocked) {
      renderAdminTasks();
      renderAdminGift();
      renderAdminSmsAndLogs();
      renderAdminSync();
    }
  }

  // ==================== KID INTERACTIONS ====================
  function toggleTask(dateStr, taskId, clickX, clickY) {
    if (!state.dailyRecords[dateStr]) {
      state.dailyRecords[dateStr] = {
        completedIds: [],
        settled: false,
        penaltyApplied: 0,
        smsSent: false
      };
    }
    const rec = state.dailyRecords[dateStr];
    if (!Array.isArray(rec.completedIds)) rec.completedIds = [];
    const idx = rec.completedIds.indexOf(taskId);
    const beforeSummary = TodoData.getDaySummary(state, dateStr);
    const wasPassed = beforeSummary.passed;
    const wasPerfect = beforeSummary.perfect;

    if (idx >= 0) {
      rec.completedIds.splice(idx, 1);
      playChime('uncheck');
    } else {
      rec.completedIds.push(taskId);
      const after = TodoData.getDaySummary(state, dateStr);
      if (after.perfect && !wasPerfect) {
        showBigCelebration100();
      } else if (!wasPassed && after.passed) {
        playChime('celebrate');
        launchConfetti(clickX, clickY, 26);
      } else {
        playChime('check');
        launchConfetti(clickX, clickY, 12);
      }
    }

    const afterSummary = TodoData.getDaySummary(state, dateStr);
    if (rec.penaltyApplied > 0 && afterSummary.passed) {
      const refunded = rec.penaltyApplied;
      rec.penaltyApplied = 0;
      state.penaltyLogs.unshift({
        id: TodoData.uid('pen'),
        date: dateStr,
        reason: `할일 추가 완료로 기준(${afterSummary.threshold}%) 달성 → 감점 취소`,
        points: +refunded
      });
    }

    TodoData.saveState(state);
    renderAll();
  }

  // ==================== ADMIN AUTH & PANEL ====================
  function openAdminAuth() {
    const modal = document.getElementById('admin-auth-modal');
    const setupForm = document.getElementById('admin-setup-form');
    const loginForm = document.getElementById('admin-login-form');
    const titleEl = document.getElementById('admin-auth-title');

    document.getElementById('setup-pw-error').classList.add('hidden');
    document.getElementById('login-pw-error').classList.add('hidden');

    if (!state.admin || !state.admin.passwordHash) {
      titleEl.textContent = '🔐 관리자 비밀번호 초기 설정';
      setupForm.classList.remove('hidden');
      loginForm.classList.add('hidden');
      document.getElementById('setup-pw-1').value = '';
      document.getElementById('setup-pw-2').value = '';
      modal.classList.remove('hidden');
      document.getElementById('setup-pw-1').focus();
    } else {
      titleEl.textContent = '🔐 관리자 비밀번호 입력';
      setupForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
      document.getElementById('login-pw-input').value = '';
      modal.classList.remove('hidden');
      document.getElementById('login-pw-input').focus();
    }
  }

  function openAdminPanel() {
    isAdminUnlocked = true;
    adminSelectedWeekday = TodoData.getWeekdayIndex(selectedDate);
    document.getElementById('admin-auth-modal').classList.add('hidden');
    document.getElementById('admin-modal').classList.remove('hidden');
    switchAdminTab('tasks');
    renderAdminTasks();
    renderAdminGift();
    renderAdminSmsAndLogs();
    renderAdminSync();
  }

  function closeAdminPanel() {
    isAdminUnlocked = false;
    document.getElementById('admin-modal').classList.add('hidden');
  }

  function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.adminTab === tabName);
    });
    document.querySelectorAll('.admin-panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `admin-panel-${tabName}`);
    });
  }

  // ==================== TASK EDIT MODAL (ADMIN ONLY) ====================
  let selectedTaskEmoji = '✏️';
  let editingWeekday = null;
  let editingTaskMeta = null;

  function isSameTaskGroup(task, meta) {
    if (!task || !meta) return false;
    if (task.id === meta.id) return true;
    if (meta.groupId && task.groupId && task.groupId === meta.groupId) return true;
    if (meta.originalTitle && task.title === meta.originalTitle) return true;
    return false;
  }

  function openTaskModal(existingTask, weekdayIdx) {
    if (!isAdminUnlocked) return;
    const modal = document.getElementById('task-modal');
    const titleEl = document.getElementById('task-modal-title');
    const idInput = document.getElementById('task-edit-id');
    const nameInput = document.getElementById('task-title-input');
    const catInput = document.getElementById('task-category-input');
    const ptsInput = document.getElementById('task-points-input');
    const daysGroup = document.getElementById('task-days-group');

    editingWeekday = weekdayIdx != null ? weekdayIdx : adminSelectedWeekday;
    daysGroup.style.display = 'flex';

    let preCheckedDays = [editingWeekday];

    if (existingTask) {
      titleEl.textContent = '할일 항목 편집 (요일 멀티 선택)';
      idInput.value = existingTask.id;
      nameInput.value = existingTask.title;
      catInput.value = existingTask.category || '공부';
      ptsInput.value = String(existingTask.points || 20);
      selectedTaskEmoji = existingTask.emoji || '⭐';
      editingTaskMeta = {
        id: existingTask.id,
        groupId: existingTask.groupId || TodoData.uid('grp'),
        originalTitle: existingTask.title
      };
      // Pre-check all weekdays that currently contain this task
      preCheckedDays = TodoData.WEEKDAY_ORDER.filter((wd) =>
        (state.weekdayTasks[wd] || []).some((t) => isSameTaskGroup(t, editingTaskMeta))
      );
      if (preCheckedDays.length === 0) preCheckedDays = [editingWeekday];
    } else {
      titleEl.textContent = '새 할일 항목 등록';
      idInput.value = '';
      nameInput.value = '';
      catInput.value = '공부';
      ptsInput.value = '20';
      selectedTaskEmoji = '✏️';
      editingTaskMeta = null;
    }

    const ep = document.getElementById('task-emoji-picker');
    ep.innerHTML = '';
    TASK_EMOJIS.forEach((em) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `emoji-opt${em === selectedTaskEmoji ? ' active' : ''}`;
      b.textContent = em;
      b.addEventListener('click', () => {
        selectedTaskEmoji = em;
        ep.querySelectorAll('.emoji-opt').forEach((x) => x.classList.toggle('active', x.textContent === em));
      });
      ep.appendChild(b);
    });

    const dayGrid = document.getElementById('task-day-checkboxes');
    dayGrid.innerHTML = '';
    TodoData.WEEKDAY_ORDER.forEach((wd) => {
      const checked = preCheckedDays.includes(wd);
      const lbl = document.createElement('label');
      lbl.className = `day-check-label${checked ? ' checked' : ''}`;
      lbl.innerHTML = `<input type="checkbox" value="${wd}" ${checked ? 'checked' : ''} />${TodoData.WEEKDAYS_KO[wd]}`;
      const cb = lbl.querySelector('input');
      cb.addEventListener('change', () => {
        lbl.classList.toggle('checked', cb.checked);
      });
      dayGrid.appendChild(lbl);
    });

    modal.classList.remove('hidden');
    nameInput.focus();
  }

  // ==================== PHOTO EDITOR MODAL (KID & PARENT) ====================
  function openPhotoModal() {
    const meta = state.profile.photoMeta || {};
    editorConfig = {
      preset: meta.preset || 'space',
      zoom: meta.zoom || 1,
      rotate: meta.rotate || 0,
      brightness: meta.brightness || 100,
      offsetX: meta.offsetX || 0,
      offsetY: meta.offsetY || 0,
      filter: meta.filter || 'none',
      frame: meta.frame || 'none',
      stickers: Array.isArray(meta.stickers) ? [...meta.stickers] : ['⭐']
    };

    document.getElementById('edit-hero-title').value = state.profile.title || '';
    document.getElementById('edit-hero-subtitle').value = state.profile.subtitle || '';
    syncPhotoControlsUI();
    renderPhotoPresets();

    document.getElementById('photo-modal').classList.remove('hidden');
    redrawEditorCanvas();
  }

  function renderPhotoPresets() {
    const wrap = document.getElementById('photo-presets');
    wrap.innerHTML = '';
    PhotoEditor.PRESETS.forEach((p) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `chip${!editorUploadedImg && editorConfig.preset === p.id ? ' active' : ''}`;
      btn.textContent = p.label;
      btn.addEventListener('click', () => {
        editorUploadedImg = null;
        editorConfig.preset = p.id;
        editorConfig.offsetX = 0;
        editorConfig.offsetY = 0;
        renderPhotoPresets();
        redrawEditorCanvas();
      });
      wrap.appendChild(btn);
    });
  }

  function syncPhotoControlsUI() {
    document.getElementById('photo-zoom').value = editorConfig.zoom;
    document.getElementById('photo-zoom-val').textContent = `${Math.round(editorConfig.zoom * 100)}%`;
    document.getElementById('photo-rotate').value = editorConfig.rotate;
    document.getElementById('photo-rotate-val').textContent = `${editorConfig.rotate}°`;
    document.getElementById('photo-brightness').value = editorConfig.brightness;
    document.getElementById('photo-brightness-val').textContent = `${editorConfig.brightness}%`;

    document.querySelectorAll('#photo-filters .chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.filter === editorConfig.filter);
    });
    document.querySelectorAll('#photo-frames .chip').forEach((c) => {
      c.classList.toggle('active', c.dataset.frame === editorConfig.frame);
    });
    document.querySelectorAll('#photo-stickers .sticker-btn').forEach((b) => {
      b.classList.toggle('active', editorConfig.stickers.includes(b.dataset.sticker));
    });
  }

  function redrawEditorCanvas() {
    const canvas = document.getElementById('photo-editor-canvas');
    if (!canvas || !editorConfig) return;
    PhotoEditor.renderToCanvas(canvas, editorConfig, editorUploadedImg);
  }

  // ==================== EVENT LISTENERS ====================
  function bindEvents() {
    // Sound toggle
    document.getElementById('btn-sound-toggle').addEventListener('click', () => {
      state.soundEnabled = !state.soundEnabled;
      TodoData.saveState(state);
      renderHero();
      if (state.soundEnabled) playChime('check');
    });

    // SMS Toast close
    document.getElementById('sms-toast-close').addEventListener('click', () => {
      document.getElementById('sms-toast').classList.add('hidden');
    });

    // Modal close buttons & backdrop click
    document.querySelectorAll('.modal-close').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.close;
        if (target) document.getElementById(target).classList.add('hidden');
      });
    });
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          if (backdrop.id === 'admin-modal') closeAdminPanel();
          else backdrop.classList.add('hidden');
        }
      });
    });

    // Kid main page buttons
    document.getElementById('btn-go-today').addEventListener('click', () => {
      selectedDate = TodoData.getTodayStr();
      renderWeekdayBoard();
    });
    document.getElementById('btn-edit-photo').addEventListener('click', openPhotoModal);
    document.getElementById('btn-open-admin').addEventListener('click', openAdminAuth);
    const syncPillEl = document.getElementById('sync-status-pill');
    if (syncPillEl) syncPillEl.addEventListener('click', openAdminAuth);

    // Mobile bottom bar
    document.getElementById('mobile-btn-photo').addEventListener('click', openPhotoModal);
    document.getElementById('mobile-btn-admin').addEventListener('click', openAdminAuth);
    document.querySelectorAll('.mobile-nav-item[data-jump]').forEach((link) => {
      link.addEventListener('click', () => {
        document.querySelectorAll('.mobile-nav-item[data-jump]').forEach((el) => el.classList.remove('active'));
        link.classList.add('active');
      });
    });

    // Calendar nav
    document.getElementById('cal-prev-month').addEventListener('click', () => {
      calMonth--;
      if (calMonth < 0) {
        calMonth = 11;
        calYear--;
      }
      renderCalendarAndGift();
    });
    document.getElementById('cal-next-month').addEventListener('click', () => {
      calMonth++;
      if (calMonth > 11) {
        calMonth = 0;
        calYear++;
      }
      renderCalendarAndGift();
    });

    // Admin Auth Forms
    document.getElementById('admin-setup-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const pw1 = document.getElementById('setup-pw-1').value;
      const pw2 = document.getElementById('setup-pw-2').value;
      const errEl = document.getElementById('setup-pw-error');

      if (pw1.length < 4) {
        errEl.textContent = '비밀번호는 4자 이상으로 설정해주세요.';
        errEl.classList.remove('hidden');
        return;
      }
      if (pw1 !== pw2) {
        errEl.textContent = '비밀번호가 일치하지 않습니다.';
        errEl.classList.remove('hidden');
        return;
      }

      state.admin = { passwordHash: TodoData.hashPassword(pw1) };
      TodoData.saveState(state);
      openAdminPanel();
    });

    document.getElementById('admin-login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const pw = document.getElementById('login-pw-input').value;
      const errEl = document.getElementById('login-pw-error');
      if (TodoData.hashPassword(pw) !== state.admin.passwordHash) {
        errEl.textContent = '비밀번호가 올바르지 않습니다.';
        errEl.classList.remove('hidden');
        return;
      }
      openAdminPanel();
    });

    // Admin Panel Controls
    document.getElementById('btn-close-admin').addEventListener('click', closeAdminPanel);
    document.querySelectorAll('.admin-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        switchAdminTab(btn.dataset.adminTab);
      });
    });

    // Admin Task Editor
    document.getElementById('btn-admin-new-task').addEventListener('click', () => {
      openTaskModal(null, adminSelectedWeekday);
    });

    document.getElementById('btn-admin-equalize').addEventListener('click', () => {
      if (!isAdminUnlocked) return;
      const list = state.weekdayTasks[adminSelectedWeekday] || [];
      if (list.length === 0) return;
      list.forEach((t) => {
        t.points = 1;
      });
      TodoData.normalizeDayPoints(list);
      TodoData.saveState(state);
      renderAll();
    });

    document.getElementById('btn-days-weekdays').addEventListener('click', () => {
      document.querySelectorAll('#task-day-checkboxes input').forEach((cb) => {
        const wd = Number(cb.value);
        cb.checked = wd >= 1 && wd <= 5;
        cb.parentElement.classList.toggle('checked', cb.checked);
      });
    });
    document.getElementById('btn-days-weekend').addEventListener('click', () => {
      document.querySelectorAll('#task-day-checkboxes input').forEach((cb) => {
        const wd = Number(cb.value);
        cb.checked = wd === 0 || wd === 6;
        cb.parentElement.classList.toggle('checked', cb.checked);
      });
    });
    document.getElementById('btn-days-all').addEventListener('click', () => {
      document.querySelectorAll('#task-day-checkboxes input').forEach((cb) => {
        cb.checked = true;
        cb.parentElement.classList.add('checked', true);
      });
    });

    document.getElementById('task-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!isAdminUnlocked) return;
      const editId = document.getElementById('task-edit-id').value;
      const title = document.getElementById('task-title-input').value.trim();
      const category = document.getElementById('task-category-input').value;
      const points = Math.max(1, Math.min(100, Number(document.getElementById('task-points-input').value || 20)));
      if (!title) return;

      const checkedDays = Array.from(document.querySelectorAll('#task-day-checkboxes input:checked')).map((c) =>
        Number(c.value)
      );
      if (checkedDays.length === 0) {
        alert('적용할 요일을 1개 이상 선택해주세요.');
        return;
      }

      if (editId && editingTaskMeta) {
        const grpId = editingTaskMeta.groupId || TodoData.uid('grp');
        TodoData.WEEKDAY_ORDER.forEach((wd) => {
          if (!state.weekdayTasks[wd]) state.weekdayTasks[wd] = [];
          const list = state.weekdayTasks[wd];
          const existing = list.find((t) => isSameTaskGroup(t, editingTaskMeta));
          if (checkedDays.includes(wd)) {
            if (existing) {
              existing.groupId = grpId;
              existing.title = title;
              existing.category = category;
              existing.points = points;
              existing.emoji = selectedTaskEmoji;
            } else {
              list.push({
                id: TodoData.uid('task'),
                groupId: grpId,
                title,
                category,
                points,
                emoji: selectedTaskEmoji
              });
            }
          } else if (existing) {
            state.weekdayTasks[wd] = list.filter((t) => !isSameTaskGroup(t, editingTaskMeta));
          }
        });
      } else {
        const grpId = TodoData.uid('grp');
        checkedDays.forEach((wd) => {
          if (!state.weekdayTasks[wd]) state.weekdayTasks[wd] = [];
          state.weekdayTasks[wd].push({
            id: TodoData.uid('task'),
            groupId: grpId,
            title,
            category,
            points,
            emoji: selectedTaskEmoji
          });
        });
      }

      // Guarantee every weekday sums to strictly 100 points
      TodoData.normalizeAllWeekdays(state);
      TodoData.saveState(state);
      document.getElementById('task-modal').classList.add('hidden');
      renderAll();
    });

    // Celebration overlay close
    const celebOverlay = document.getElementById('celebration-overlay');
    const celebCloseBtn = document.getElementById('btn-close-celebration');
    if (celebCloseBtn && celebOverlay) {
      celebCloseBtn.addEventListener('click', () => celebOverlay.classList.add('hidden'));
      celebOverlay.addEventListener('click', (e) => {
        if (e.target === celebOverlay) celebOverlay.classList.add('hidden');
      });
    }

    // Admin Gift Settings (Custom Cycle Days + Multi-Tier Score Gifts)
    document.querySelectorAll('.cycle-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('gift-cycle-days').value = btn.dataset.days;
      });
    });

    document.getElementById('admin-cycle-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!isAdminUnlocked) return;
      const days = Math.max(1, Math.min(90, Number(document.getElementById('gift-cycle-days').value || 7)));
      state.giftConfig.cycleDays = days;
      TodoData.saveState(state);
      renderAll();
      alert(`✅ 선물 주기가 ${days}일로 저장되었습니다!`);
    });

    document.getElementById('admin-tier-add-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!isAdminUnlocked) return;
      const pts = Math.max(10, Number(document.getElementById('tier-points-input').value || 100));
      const name = document.getElementById('tier-name-input').value.trim();
      if (!name) return;
      if (!Array.isArray(state.giftConfig.tiers)) state.giftConfig.tiers = [];
      state.giftConfig.tiers.push({
        id: TodoData.uid('tier'),
        points: pts,
        name,
        emoji: selectedGiftEmoji
      });
      state.giftConfig.tiers.sort((a, b) => Number(a.points) - Number(b.points));
      document.getElementById('tier-name-input').value = '';
      TodoData.saveState(state);
      renderAll();
    });

    // Admin SMS & Penalty Settings
    const threshSlider = document.getElementById('setting-threshold');
    threshSlider.addEventListener('input', () => {
      document.getElementById('setting-threshold-val').textContent = `${threshSlider.value}%`;
    });

    function syncKakaoSettingsFromForm() {
      state.settings.threshold = Number(document.getElementById('setting-threshold').value || 70);
      state.settings.penaltyPoints = Number(document.getElementById('setting-penalty').value || 0);
      state.settings.cutoffTime = document.getElementById('setting-cutoff').value || '20:00';
      state.settings.kakaoEnabled = document.getElementById('setting-sms-enabled').checked;
      state.settings.kakaoSender = document.getElementById('setting-kakao-sender').value.trim() || '엄마';
      state.settings.kakaoReceiver = document.getElementById('setting-kakao-receiver').value.trim() || '민수';
      state.settings.kakaoJsKey = document.getElementById('setting-kakao-key').value.trim();
      state.settings.webhookUrl = document.getElementById('setting-webhook').value.trim();
      TodoData.saveState(state);
    }

    document.getElementById('sms-settings-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!isAdminUnlocked) return;
      syncKakaoSettingsFromForm();
      renderAll();
      alert('✅ 카카오톡 알림(발신자/수신자) 및 감점 규칙이 저장되었습니다!');
    });

    document.getElementById('btn-test-sms').addEventListener('click', async () => {
      if (!isAdminUnlocked) return;
      syncKakaoSettingsFromForm();
      await KakaoAlertService.settleDay(state, TodoData.getTodayStr(), {
        testOnly: true,
        forceSms: true,
        triggerShare: true
      });
      renderAll();
    });

    document.getElementById('btn-run-daily-check').addEventListener('click', async () => {
      if (!isAdminUnlocked) return;
      syncKakaoSettingsFromForm();
      const res = await KakaoAlertService.settleDay(state, TodoData.getTodayStr(), {
        forceSms: true,
        triggerShare: true
      });
      renderAll();
      if (res.missingCount === 0) {
        playFanfare100();
        alert('🎉 오늘의 모든 할일이 완료되어 감점 없이 마감되었습니다!');
      }
    });

    document.getElementById('btn-clear-sms-log').addEventListener('click', () => {
      if (!isAdminUnlocked) return;
      if (confirm('카카오톡 알림 내역을 모두 비울까요?')) {
        state.smsLogs = [];
        TodoData.saveState(state);
        renderAll();
      }
    });

    // Admin Realtime Sync Controls
    const syncForm = document.getElementById('admin-sync-form');
    if (syncForm) {
      syncForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!isAdminUnlocked) return;
        const dbUrl = document.getElementById('sync-db-url').value.trim();
        const familyCode = document.getElementById('sync-family-code').value.trim();
        if (!dbUrl || !familyCode) return;

        const res = await SyncService.connectAndSync({ dbUrl, familyCode }, state);
        renderAdminSync();
        if (res.ok) {
          alert(
            res.pulledFromCloud
              ? '☁️ 실시간 동기화 연결 완료! 클라우드의 최신 데이터를 불러왔습니다.'
              : '☁️ 실시간 동기화 연결 완료! 현재 기기의 데이터를 클라우드에 업로드했습니다.'
          );
        } else {
          alert(`⚠️ 연결 실패: ${res.error || '주소를 확인해주세요.'}\nFirebase Realtime Database가 "테스트 모드"로 열려 있는지 확인해주세요.`);
        }
      });
    }

    const syncNowBtn = document.getElementById('btn-sync-now');
    if (syncNowBtn) {
      syncNowBtn.addEventListener('click', async () => {
        if (!isAdminUnlocked) return;
        const cfg = SyncService.getConfig();
        if (!cfg.enabled || !cfg.dbUrl) {
          alert('먼저 Firebase DB 주소와 가족 코드를 입력해 연결해주세요.');
          return;
        }
        await SyncService.pushNow(state);
        await SyncService.pullOnce();
        alert('🔄 동기화가 완료되었습니다!');
      });
    }

    const syncDisBtn = document.getElementById('btn-sync-disconnect');
    if (syncDisBtn) {
      syncDisBtn.addEventListener('click', () => {
        if (!isAdminUnlocked) return;
        if (confirm('이 기기의 실시간 동기화 연결을 해제할까요? (로컬 데이터는 유지됩니다)')) {
          SyncService.disconnect();
          renderAdminSync();
        }
      });
    }

    const copyLinkBtn = document.getElementById('btn-copy-sync-link');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', async () => {
        const link = SyncService.buildMagicShareLink();
        if (!link) {
          alert('먼저 좌측에서 동기화를 연결해주세요.');
          return;
        }
        await KakaoAlertService.copyText(link);
        alert('📋 자동 연결 링크가 복사되었습니다! 아이패드·아이폰 Safari에 붙여넣어 한 번만 열면 자동 동기화됩니다.');
      });
    }

    const kakaoLinkBtn = document.getElementById('btn-kakao-sync-link');
    if (kakaoLinkBtn) {
      kakaoLinkBtn.addEventListener('click', async () => {
        const link = SyncService.buildMagicShareLink();
        if (!link) {
          alert('먼저 좌측에서 동기화를 연결해주세요.');
          return;
        }
        const msg = `[☁️ 아이 할일 실시간 동기화 연결 링크]\n아이패드·아이폰에서 아래 링크를 누르면 자동으로 동기화됩니다!\n${link}`;
        const r = await KakaoAlertService.shareToKakao(state, msg);
        if (r.method === 'clipboard') {
          alert('📋 연결 링크 메시지가 복사되었습니다! 카카오톡에 붙여넣어 아이패드·아이폰으로 보내주세요.');
        }
      });
    }

    // Admin Security & Data
    document.getElementById('admin-change-pw-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!isAdminUnlocked) return;
      const curPw = document.getElementById('cur-pw-input').value;
      const newPw = document.getElementById('new-pw-input').value;
      const newPw2 = document.getElementById('new-pw-confirm').value;
      const msgEl = document.getElementById('change-pw-msg');

      msgEl.className = 'form-error';
      if (TodoData.hashPassword(curPw) !== state.admin.passwordHash) {
        msgEl.textContent = '현재 비밀번호가 일치하지 않습니다.';
        return;
      }
      if (newPw.length < 4) {
        msgEl.textContent = '새 비밀번호는 4자 이상이어야 합니다.';
        return;
      }
      if (newPw !== newPw2) {
        msgEl.textContent = '새 비밀번호 확인이 일치하지 않습니다.';
        return;
      }

      state.admin.passwordHash = TodoData.hashPassword(newPw);
      TodoData.saveState(state);
      document.getElementById('cur-pw-input').value = '';
      document.getElementById('new-pw-input').value = '';
      document.getElementById('new-pw-confirm').value = '';
      msgEl.className = 'form-error success';
      msgEl.textContent = '✅ 관리자 비밀번호가 성공적으로 변경되었습니다!';
    });

    document.getElementById('btn-reset-demo').addEventListener('click', () => {
      if (!isAdminUnlocked) return;
      if (confirm('샘플 데이터로 초기화할까요? (관리자 비밀번호는 유지됩니다)')) {
        const savedAdmin = Object.assign({}, state.admin);
        state = TodoData.createDemoState();
        state.admin = savedAdmin;
        TodoData.saveState(state);
        selectedDate = TodoData.getTodayStr();
        selectedCalDate = selectedDate;
        renderAll();
      }
    });

    document.getElementById('btn-clear-all').addEventListener('click', () => {
      if (!isAdminUnlocked) return;
      if (confirm('기록을 모두 지우고 내 데이터로 새로 시작할까요? (관리자 비밀번호는 유지됩니다)')) {
        const savedAdmin = Object.assign({}, state.admin);
        state = TodoData.createEmptyState();
        state.admin = savedAdmin;
        TodoData.saveState(state);
        selectedDate = TodoData.getTodayStr();
        selectedCalDate = selectedDate;
        renderAll();
      }
    });

    // Photo Editor Events
    document.getElementById('photo-file-input').addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          editorUploadedImg = img;
          editorConfig.zoom = 1;
          editorConfig.rotate = 0;
          editorConfig.offsetX = 0;
          editorConfig.offsetY = 0;
          syncPhotoControlsUI();
          renderPhotoPresets();
          redrawEditorCanvas();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('btn-photo-reset-transform').addEventListener('click', () => {
      editorConfig.zoom = 1;
      editorConfig.rotate = 0;
      editorConfig.brightness = 100;
      editorConfig.offsetX = 0;
      editorConfig.offsetY = 0;
      syncPhotoControlsUI();
      redrawEditorCanvas();
    });

    document.getElementById('photo-zoom').addEventListener('input', (e) => {
      editorConfig.zoom = Number(e.target.value);
      document.getElementById('photo-zoom-val').textContent = `${Math.round(editorConfig.zoom * 100)}%`;
      redrawEditorCanvas();
    });

    document.getElementById('photo-rotate').addEventListener('input', (e) => {
      editorConfig.rotate = Number(e.target.value);
      document.getElementById('photo-rotate-val').textContent = `${editorConfig.rotate}°`;
      redrawEditorCanvas();
    });

    document.getElementById('photo-brightness').addEventListener('input', (e) => {
      editorConfig.brightness = Number(e.target.value);
      document.getElementById('photo-brightness-val').textContent = `${editorConfig.brightness}%`;
      redrawEditorCanvas();
    });

    document.querySelectorAll('#photo-filters .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        editorConfig.filter = chip.dataset.filter;
        syncPhotoControlsUI();
        redrawEditorCanvas();
      });
    });

    document.querySelectorAll('#photo-frames .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        editorConfig.frame = chip.dataset.frame;
        syncPhotoControlsUI();
        redrawEditorCanvas();
      });
    });

    document.querySelectorAll('#photo-stickers .sticker-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const st = btn.dataset.sticker;
        const idx = editorConfig.stickers.indexOf(st);
        if (idx >= 0) editorConfig.stickers.splice(idx, 1);
        else editorConfig.stickers.push(st);
        syncPhotoControlsUI();
        redrawEditorCanvas();
      });
    });

    const canvas = document.getElementById('photo-editor-canvas');
    function getPointerPos(ev) {
      const rect = canvas.getBoundingClientRect();
      const clientX = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const clientY = ev.touches ? ev.touches[0].clientY : ev.clientY;
      return {
        x: ((clientX - rect.left) / rect.width) * canvas.width,
        y: ((clientY - rect.top) / rect.height) * canvas.height
      };
    }

    canvas.addEventListener('mousedown', (e) => {
      isDraggingCanvas = true;
      const pos = getPointerPos(e);
      dragStartX = pos.x - editorConfig.offsetX;
      dragStartY = pos.y - editorConfig.offsetY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDraggingCanvas || !editorConfig) return;
      const pos = getPointerPos(e);
      editorConfig.offsetX = pos.x - dragStartX;
      editorConfig.offsetY = pos.y - dragStartY;
      redrawEditorCanvas();
    });
    window.addEventListener('mouseup', () => {
      isDraggingCanvas = false;
    });

    canvas.addEventListener('touchstart', (e) => {
      isDraggingCanvas = true;
      const pos = getPointerPos(e);
      dragStartX = pos.x - editorConfig.offsetX;
      dragStartY = pos.y - editorConfig.offsetY;
    });
    canvas.addEventListener(
      'touchmove',
      (e) => {
        if (!isDraggingCanvas || !editorConfig) return;
        e.preventDefault();
        const pos = getPointerPos(e);
        editorConfig.offsetX = pos.x - dragStartX;
        editorConfig.offsetY = pos.y - dragStartY;
        redrawEditorCanvas();
      },
      { passive: false }
    );
    canvas.addEventListener('touchend', () => {
      isDraggingCanvas = false;
    });

    document.getElementById('btn-save-photo').addEventListener('click', () => {
      state.profile.title = document.getElementById('edit-hero-title').value.trim() || '아이의 오늘도 화이팅! 🌟';
      state.profile.subtitle = document.getElementById('edit-hero-subtitle').value.trim() || '';
      state.profile.photoMeta = Object.assign({}, editorConfig);
      state.profile.photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      TodoData.saveState(state);
      document.getElementById('photo-modal').classList.add('hidden');
      renderHero();
      playChime('celebrate');
      launchConfetti(window.innerWidth / 2, 180, 30);
    });
  }

  function startCutoffWatcher() {
    setInterval(async () => {
      const today = TodoData.getTodayStr();
      const rec = state.dailyRecords[today];
      if (rec && rec.settled) return;
      if (SmsService.isPastCutoff(state.settings.cutoffTime)) {
        await SmsService.settleDay(state, today, { forceSms: false });
        renderAll();
      }
    }, 60000);
  }

  bindEvents();
  renderAll();
  startCutoffWatcher();

  if (window.SyncService) {
    SyncService.init({
      getLocalState: () => state,
      onRemoteState: (remoteState) => {
        state = TodoData.hydrateState(remoteState);
        TodoData.saveState(state, { skipSync: true });
        renderAll();
      },
      onStatusChange: (status, detail) => {
        updateSyncStatusUI(status, detail);
      }
    });
  }
})();
