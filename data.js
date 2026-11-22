(function (global) {
  const STORAGE_KEY = 'kids_todo_app_v2';
  const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
  // Display order Monday -> Sunday
  const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function toDateStr(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function parseDateStr(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function addDays(dateStr, delta) {
    const dt = parseDateStr(dateStr);
    dt.setDate(dt.getDate() + delta);
    return toDateStr(dt);
  }

  function getTodayStr() {
    return toDateStr(new Date());
  }

  function getWeekdayIndex(dateStr) {
    return parseDateStr(dateStr).getDay(); // 0(Sun) .. 6(Sat)
  }

  function getWeekDatesFor(dateStr) {
    const dt = parseDateStr(dateStr);
    const day = dt.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(dt);
    mon.setDate(dt.getDate() + diffToMon);
    const list = [];
    for (let i = 0; i < 7; i++) {
      const cur = new Date(mon);
      cur.setDate(mon.getDate() + i);
      list.push(toDateStr(cur));
    }
    return list;
  }

  function formatKoreanDate(dateStr) {
    const dt = parseDateStr(dateStr);
    return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일 (${WEEKDAYS_KO[dt.getDay()]})`;
  }

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  // Deterministic salted hash (works on file://, HTTP LAN for iPhone/iPad, and HTTPS)
  function hashPassword(plain) {
    const str = `kids_todo_salt_v1::${String(plain || '')}`;
    let h1 = 0xdeadbeef ^ str.length;
    let h2 = 0x41c6ce57 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }

  function normalizeDayPoints(tasks) {
    if (!Array.isArray(tasks) || tasks.length === 0) return tasks;
    const weights = tasks.map((t) => Math.max(1, Number(t.points) || 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);

    // Largest-remainder distribution so integer sum is ALWAYS exactly 100
    const raw = weights.map((w) => (w / totalWeight) * 100);
    const floors = raw.map((v) => Math.floor(v));
    let remainder = 100 - floors.reduce((a, b) => a + b, 0);

    const order = raw
      .map((v, idx) => ({ idx, frac: v - floors[idx] }))
      .sort((a, b) => b.frac - a.frac);

    for (let i = 0; i < remainder; i++) {
      floors[order[i % order.length].idx] += 1;
    }

    tasks.forEach((t, idx) => {
      t.points = floors[idx];
    });
    return tasks;
  }

  function normalizeAllWeekdays(state) {
    if (!state || !state.weekdayTasks) return state;
    Object.keys(state.weekdayTasks).forEach((wd) => {
      normalizeDayPoints(state.weekdayTasks[wd]);
    });
    return state;
  }

  function createDefaultWeekdayTasks() {
    return {
      1: [
        { id: 't_mon_1', groupId: 'g_bed', title: '아침에 이불 스스로 개기', emoji: '🛏️', category: '생활', points: 20 },
        { id: 't_mon_2', groupId: 'g_hw', title: '학교 숙제 30분 집중하기', emoji: '✏️', category: '공부', points: 25 },
        { id: 't_mon_3', groupId: 'g_piano', title: '피아노 연습 20분', emoji: '🎹', category: '예체능', points: 20 },
        { id: 't_mon_4', groupId: 'g_book', title: '동화책 20분 읽기', emoji: '📖', category: '독서', points: 20 },
        { id: 't_mon_5', groupId: 'g_brush', title: '저녁 양치질 꼼꼼히 하기', emoji: '🪥', category: '생활', points: 15 }
      ],
      2: [
        { id: 't_tue_1', groupId: 'g_bed', title: '아침에 이불 스스로 개기', emoji: '🛏️', category: '생활', points: 20 },
        { id: 't_tue_2', groupId: 'g_math', title: '수학 문제집 2쪽 풀기', emoji: '🔢', category: '공부', points: 25 },
        { id: 't_tue_3', groupId: 'g_jump', title: '줄넘기 100개 도전', emoji: '🏃', category: '운동', points: 20 },
        { id: 't_tue_4', groupId: 'g_toy', title: '장난감 제자리에 정리하기', emoji: '🧸', category: '생활', points: 20 },
        { id: 't_tue_5', groupId: 'g_brush', title: '저녁 양치질 꼼꼼히 하기', emoji: '🪥', category: '생활', points: 15 }
      ],
      3: [
        { id: 't_wed_1', groupId: 'g_bed', title: '아침에 이불 스스로 개기', emoji: '🛏️', category: '생활', points: 20 },
        { id: 't_wed_2', groupId: 'g_eng', title: '영어 단어 5개 소리내어 읽기', emoji: '🔤', category: '공부', points: 25 },
        { id: 't_wed_3', groupId: 'g_art', title: '그림 그리기 / 색칠 놀이', emoji: '🎨', category: '예체능', points: 20 },
        { id: 't_wed_4', groupId: 'g_book', title: '동화책 20분 읽기', emoji: '📖', category: '독서', points: 20 },
        { id: 't_wed_5', groupId: 'g_brush', title: '저녁 양치질 꼼꼼히 하기', emoji: '🪥', category: '생활', points: 15 }
      ],
      4: [
        { id: 't_thu_1', groupId: 'g_bed', title: '아침에 이불 스스로 개기', emoji: '🛏️', category: '생활', points: 20 },
        { id: 't_thu_2', groupId: 'g_write', title: '받아쓰기 / 글씨 바르게 쓰기', emoji: '📝', category: '공부', points: 25 },
        { id: 't_thu_3', groupId: 'g_tkd', title: '태권도 / 스트레칭 15분', emoji: '🥋', category: '운동', points: 20 },
        { id: 't_thu_4', groupId: 'g_bag', title: '내일 준비물 가방 챙기기', emoji: '🎒', category: '생활', points: 20 },
        { id: 't_thu_5', groupId: 'g_brush', title: '저녁 양치질 꼼꼼히 하기', emoji: '🪥', category: '생활', points: 15 }
      ],
      5: [
        { id: 't_fri_1', groupId: 'g_bed', title: '아침에 이불 스스로 개기', emoji: '🛏️', category: '생활', points: 20 },
        { id: 't_fri_2', groupId: 'g_review', title: '한 주 공부 복습하기', emoji: '📚', category: '공부', points: 25 },
        { id: 't_fri_3', groupId: 'g_piano', title: '피아노 연습 20분', emoji: '🎹', category: '예체능', points: 20 },
        { id: 't_fri_4', groupId: 'g_desk', title: '책상 위 깨끗이 치우기', emoji: '🧹', category: '생활', points: 20 },
        { id: 't_fri_5', groupId: 'g_brush', title: '저녁 양치질 꼼꼼히 하기', emoji: '🪥', category: '생활', points: 15 }
      ],
      6: [
        { id: 't_sat_1', groupId: 'g_wash', title: '아침 스스로 일어나 세수하기', emoji: '🧼', category: '생활', points: 25 },
        { id: 't_sat_2', groupId: 'g_play', title: '가족과 밖에서 신나게 뛰어놀기', emoji: '⚽', category: '운동', points: 25 },
        { id: 't_sat_3', groupId: 'g_readwk', title: '만화책/동화책 1권 완독하기', emoji: '📖', category: '독서', points: 25 },
        { id: 't_sat_4', groupId: 'g_help', title: '엄마 아빠 집안일 1가지 돕기', emoji: '💛', category: '생활', points: 25 }
      ],
      0: [
        { id: 't_sun_1', groupId: 'g_wash', title: '아침 스스로 일어나 세수하기', emoji: '🧼', category: '생활', points: 25 },
        { id: 't_sun_2', groupId: 'g_diary', title: '일기 한 편 쓰기', emoji: '📓', category: '공부', points: 25 },
        { id: 't_sun_3', groupId: 'g_monbag', title: '월요일 학교 가방 미리 챙기기', emoji: '🎒', category: '생활', points: 25 },
        { id: 't_sun_4', groupId: 'g_sleep', title: '일찍 잠자리에 들기', emoji: '🌙', category: '생활', points: 25 }
      ]
    };
  }

  function createEmptyState() {
    const today = getTodayStr();
    return {
      admin: {
        passwordHash: ''
      },
      profile: {
        title: '민수의 오늘도 화이팅! 🌟',
        subtitle: '오늘의 할일을 완료하고 멋진 선물을 받아보세요!',
        photoDataUrl: '',
        photoMeta: {
          preset: 'space',
          zoom: 1,
          rotate: 0,
          brightness: 100,
          offsetX: 0,
          offsetY: 0,
          filter: 'none',
          frame: 'none',
          stickers: ['⭐', '🚀']
        }
      },
      soundEnabled: true,
      weekdayTasks: createDefaultWeekdayTasks(),
      dailyRecords: {},
      settings: {
        threshold: 70,
        penaltyPoints: 15,
        cutoffTime: '20:00',
        smsEnabled: true,
        parentPhone: '010-1234-5678',
        childPhone: '010-9876-5432',
        webhookUrl: ''
      },
      giftConfig: {
        cycleDays: 7,
        anchorDate: addDays(today, -5),
        tiers: [
          { id: 'tier_1', points: 350, name: '아이스크림 쿠폰', emoji: '🍦' },
          { id: 'tier_2', points: 500, name: '포켓몬 카드 팩', emoji: '🃏' },
          { id: 'tier_3', points: 600, name: '레고 브릭 세트', emoji: '🧱' }
        ]
      },
      giftClaims: [],
      smsLogs: [],
      penaltyLogs: []
    };
  }

  function createDemoState() {
    const state = createEmptyState();
    const today = getTodayStr();
    // Anchor gift cycle 5 days ago so today is day 6 of a 7-day cycle
    state.giftConfig.anchorDate = addDays(today, -5);

    // Populate realistic history for past 10 days (days -10 .. -1)
    const patterns = [
      { offset: -10, ratio: 1.0 },
      { offset: -9, ratio: 0.8 },
      { offset: -8, ratio: 0.4 }, // missed -> penalty & sms
      { offset: -7, ratio: 1.0 },
      { offset: -6, ratio: 0.8 },
      { offset: -5, ratio: 1.0 },
      { offset: -4, ratio: 0.8 },
      { offset: -3, ratio: 0.4 }, // missed -> penalty & sms
      { offset: -2, ratio: 1.0 },
      { offset: -1, ratio: 0.8 }
    ];

    patterns.forEach((p) => {
      const dStr = addDays(today, p.offset);
      const wd = getWeekdayIndex(dStr);
      const tasks = state.weekdayTasks[wd] || [];
      const countToComplete = Math.round(tasks.length * p.ratio);
      const completedIds = tasks.slice(0, countToComplete).map((t) => t.id);
      const rate = tasks.length ? Math.round((completedIds.length / tasks.length) * 100) : 0;
      const below = rate < state.settings.threshold;

      state.dailyRecords[dStr] = {
        completedIds,
        settled: true,
        penaltyApplied: below ? state.settings.penaltyPoints : 0,
        smsSent: below
      };

      if (below) {
        const missed = tasks.slice(countToComplete).map((t) => t.title);
        state.penaltyLogs.unshift({
          id: uid('pen'),
          date: dStr,
          reason: `일일 성취도 ${rate}% (기준 ${state.settings.threshold}% 미만)`,
          points: -state.settings.penaltyPoints
        });
        state.smsLogs.unshift({
          id: uid('sms'),
          date: dStr,
          timestamp: `${dStr} ${state.settings.cutoffTime}`,
          to: [state.settings.parentPhone, state.settings.childPhone].filter(Boolean).join(', '),
          status: '발송완료 (시뮬레이터)',
          message: `[아이 할일 알림] ${formatKoreanDate(dStr)}\n성취도 ${rate}%로 기준(${state.settings.threshold}%) 미달하여 -${state.settings.penaltyPoints}점 감점되었습니다.\n미완료 할일: ${missed.join(', ')}`
        });
      }
    });

    // Partially complete today so the user can check off remaining items immediately
    const todayWd = getWeekdayIndex(today);
    const todayTasks = state.weekdayTasks[todayWd] || [];
    state.dailyRecords[today] = {
      completedIds: todayTasks.slice(0, 2).map((t) => t.id),
      settled: false,
      penaltyApplied: 0,
      smsSent: false
    };

    // One past claimed gift
    state.giftClaims.push({
      id: uid('gift'),
      claimedAt: addDays(today, -6),
      cycleLabel: `${addDays(today, -12)} ~ ${addDays(today, -6)}`,
      giftName: '아이스크림 쿠폰',
      giftEmoji: '🍦'
    });

    return state;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const demo = createDemoState();
        saveState(demo);
        return demo;
      }
      const parsed = JSON.parse(raw);
      const merged = normalizeAllWeekdays(Object.assign(createEmptyState(), parsed));
      // Migrate legacy single-gift config to tiers array if needed
      if (!merged.giftConfig) merged.giftConfig = createEmptyState().giftConfig;
      if (!Array.isArray(merged.giftConfig.tiers) || merged.giftConfig.tiers.length === 0) {
        merged.giftConfig.tiers = [
          {
            id: uid('tier'),
            points: Number(merged.giftConfig.requiredPoints || 500),
            name: merged.giftConfig.name || '레고 브릭 세트',
            emoji: merged.giftConfig.emoji || '🎁'
          }
        ];
      }
      merged.giftConfig.tiers.sort((a, b) => Number(a.points) - Number(b.points));
      return merged;
    } catch (e) {
      console.warn('Failed to load state, resetting to demo:', e);
      return createDemoState();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save state to localStorage:', e);
    }
  }

  function getDaySummary(state, dateStr) {
    const wd = getWeekdayIndex(dateStr);
    const tasks = state.weekdayTasks[wd] || [];
    const rec = state.dailyRecords[dateStr] || {
      completedIds: [],
      settled: false,
      penaltyApplied: 0,
      smsSent: false
    };
    const validCompletedIds = rec.completedIds.filter((id) => tasks.some((t) => t.id === id));
    const totalCount = tasks.length;
    const doneCount = validCompletedIds.length;
    const totalPossiblePoints = tasks.reduce((sum, t) => sum + Number(t.points || 0), 0);
    const earnedPoints = tasks
      .filter((t) => validCompletedIds.includes(t.id))
      .reduce((sum, t) => sum + Number(t.points || 0), 0);
    const rate = totalPossiblePoints > 0 ? Math.round((earnedPoints / totalPossiblePoints) * 100) : 0;
    const penaltyPoints = Number(rec.penaltyApplied || 0);
    const threshold = Number(state.settings.threshold || 70);
    const passed = totalCount > 0 && rate >= threshold;
    const perfect = totalCount > 0 && doneCount === totalCount;

    return {
      dateStr,
      weekday: wd,
      tasks,
      completedIds: validCompletedIds,
      totalCount,
      doneCount,
      rate,
      earnedPoints,
      penaltyPoints,
      netPoints: earnedPoints - penaltyPoints,
      threshold,
      passed,
      perfect,
      settled: Boolean(rec.settled),
      smsSent: Boolean(rec.smsSent)
    };
  }

  function getTotalStats(state) {
    let totalPoints = 0;
    Object.keys(state.dailyRecords).forEach((dStr) => {
      const sum = getDaySummary(state, dStr);
      totalPoints += sum.netPoints;
    });

    // Calculate current streak up to today (if today not yet passed, check from yesterday)
    const today = getTodayStr();
    let streak = 0;
    let cursor = getDaySummary(state, today).passed ? today : addDays(today, -1);
    for (let i = 0; i < 365; i++) {
      const s = getDaySummary(state, cursor);
      if (s.passed) {
        streak++;
        cursor = addDays(cursor, -1);
      } else {
        break;
      }
    }

    const todaySummary = getDaySummary(state, today);
    return {
      totalPoints: Math.max(0, totalPoints),
      rawPoints: totalPoints,
      streak,
      todayRate: todaySummary.rate
    };
  }

  function getCurrentGiftCycle(state, refDateStr) {
    const ref = refDateStr || getTodayStr();
    const cfg = state.giftConfig || {};
    const cycleDays = Math.max(1, Number(cfg.cycleDays || 7));
    const anchor = cfg.anchorDate || ref;

    const msPerDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor((parseDateStr(ref) - parseDateStr(anchor)) / msPerDay);
    const cycleIndex = diffDays >= 0 ? Math.floor(diffDays / cycleDays) : 0;
    const cycleStart = addDays(anchor, cycleIndex * cycleDays);
    const cycleEnd = addDays(cycleStart, cycleDays - 1);
    const cycleKey = `${cycleStart}~${cycleEnd}`;

    let passedDays = 0;
    let cyclePoints = 0;
    for (let i = 0; i < cycleDays; i++) {
      const d = addDays(cycleStart, i);
      const sum = getDaySummary(state, d);
      if (sum.passed) passedDays++;
      cyclePoints += sum.netPoints;
    }

    const safePoints = Math.max(0, cyclePoints);
    const tiers = (Array.isArray(cfg.tiers) ? cfg.tiers : [])
      .slice()
      .sort((a, b) => Number(a.points) - Number(b.points))
      .map((tier) => {
        const targetPoints = Math.max(1, Number(tier.points || 100));
        const claimKey = `${cycleKey}::${tier.id}`;
        const claimed = state.giftClaims.some((c) => c.claimKey === claimKey);
        const qualified = safePoints >= targetPoints;
        const pct = Math.min(100, Math.round((safePoints / targetPoints) * 100));
        return Object.assign({}, tier, {
          targetPoints,
          claimKey,
          claimed,
          qualified,
          pct,
          remainingPoints: Math.max(0, targetPoints - safePoints)
        });
      });

    const maxTarget = tiers.length ? tiers[tiers.length - 1].targetPoints : 100;
    const anyQualified = tiers.some((t) => t.qualified && !t.claimed);

    return {
      cycleKey,
      cycleStart,
      cycleEnd,
      cycleDays,
      passedDays,
      cyclePoints: safePoints,
      maxTarget,
      tiers,
      anyQualified
    };
  }

  global.TodoData = {
    WEEKDAYS_KO,
    WEEKDAY_ORDER,
    toDateStr,
    parseDateStr,
    addDays,
    getTodayStr,
    getWeekdayIndex,
    getWeekDatesFor,
    formatKoreanDate,
    uid,
    hashPassword,
    normalizeDayPoints,
    normalizeAllWeekdays,
    createEmptyState,
    createDemoState,
    loadState,
    saveState,
    getDaySummary,
    getTotalStats,
    getCurrentGiftCycle
  };
})(window);
