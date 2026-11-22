(function (global) {
  const PRESETS = [
    { id: 'space', label: '🚀 우주 탐험' },
    { id: 'dino', label: '🦕 공룡 숲' },
    { id: 'rainbow', label: '🌈 무지개 언덕' },
    { id: 'ocean', label: '🐳 바다 탐험' },
    { id: 'camping', label: '⛺ 별빛 캠핑' }
  ];

  const STICKER_POSITIONS = {
    '👑': { x: 0.14, y: 0.38 },
    '⭐': { x: 0.86, y: 0.36 },
    '💖': { x: 0.26, y: 0.42 },
    '🌈': { x: 0.72, y: 0.38 },
    '🚀': { x: 0.82, y: 0.58 },
    '🦕': { x: 0.18, y: 0.60 },
    '🎀': { x: 0.50, y: 0.34 },
    '🏆': { x: 0.64, y: 0.56 }
  };

  function drawPresetScene(ctx, w, h, presetId) {
    ctx.save();
    if (presetId === 'space') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(0.55, '#312e81');
      grad.addColorStop(1, '#4c1d95');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Stars
      for (let i = 0; i < 65; i++) {
        const sx = ((i * 137) % w);
        const sy = ((i * 73) % h);
        const r = (i % 3) + 1;
        ctx.fillStyle = i % 5 === 0 ? '#fde047' : 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Planet 1
      ctx.fillStyle = '#fb923c';
      ctx.beginPath();
      ctx.arc(w * 0.74, h * 0.34, 58, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(w * 0.74, h * 0.34, 96, 22, -0.25, 0, Math.PI * 2);
      ctx.stroke();

      // Moon
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(w * 0.22, h * 0.32, 38, 0, Math.PI * 2);
      ctx.fill();
    } else if (presetId === 'dino') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#7dd3fc');
      grad.addColorStop(0.65, '#bae6fd');
      grad.addColorStop(1, '#86efac');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Sun
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(w * 0.82, h * 0.22, 42, 0, Math.PI * 2);
      ctx.fill();

      // Hills
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(w * 0.25, h * 0.96, 360, 140, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.ellipse(w * 0.78, h * 0.98, 400, 150, 0, 0, Math.PI * 2);
      ctx.fill();

      // Clouds
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      [
        [180, 90, 32], [215, 84, 38], [250, 92, 28],
        [520, 110, 28], [552, 102, 34], [584, 112, 26]
      ].forEach(([cx, cy, cr]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (presetId === 'rainbow') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#fbcfe8');
      grad.addColorStop(0.5, '#fef3c7');
      grad.addColorStop(1, '#bae6fd');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const colors = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa'];
      colors.forEach((col, idx) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = 18;
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.95, 290 - idx * 18, Math.PI, 0);
        ctx.stroke();
      });

      // Fluffy clouds at base
      ctx.fillStyle = '#ffffff';
      [
        [190, 365, 52], [240, 355, 60], [295, 370, 48],
        [605, 370, 48], [660, 355, 60], [710, 365, 52]
      ].forEach(([cx, cy, cr]) => {
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (presetId === 'ocean') {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.5, '#0284c7');
      grad.addColorStop(1, '#0c4a6e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Bubbles
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 22; i++) {
        const bx = (i * 89 + 40) % w;
        const by = (i * 53 + 30) % h;
        const br = (i % 4) * 6 + 6;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Waves
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.beginPath();
      ctx.ellipse(w * 0.5, h * 0.14, 520, 48, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // camping
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.65, '#1e3a5f');
      grad.addColorStop(1, '#14532d');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 45; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc((i * 113) % w, (i * 47) % (h * 0.6), (i % 2) + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Tent
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.36);
      ctx.lineTo(w * 0.36, h * 0.78);
      ctx.lineTo(w * 0.64, h * 0.78);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.5);
      ctx.lineTo(w * 0.45, h * 0.78);
      ctx.lineTo(w * 0.55, h * 0.78);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function buildFilterString(filter, brightness) {
    const b = `brightness(${brightness}%)`;
    switch (filter) {
      case 'warm':
        return `${b} sepia(26%) saturate(130%)`;
      case 'bright':
        return `${b} contrast(108%) saturate(135%)`;
      case 'pastel':
        return `${b} contrast(90%) saturate(115%) hue-rotate(8deg)`;
      case 'vintage':
        return `${b} sepia(48%) contrast(92%)`;
      case 'mono':
        return `${b} grayscale(100%) contrast(108%)`;
      default:
        return b;
    }
  }

  function drawFrame(ctx, w, h, frame) {
    if (!frame || frame === 'none') return;
    ctx.save();
    if (frame === 'rainbow') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#ff6b4a');
      grad.addColorStop(0.25, '#ffb800');
      grad.addColorStop(0.5, '#1eb9a8');
      grad.addColorStop(0.75, '#4ea8de');
      grad.addColorStop(1, '#a78bfa');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 22;
      ctx.strokeRect(11, 11, w - 22, h - 22);
    } else if (frame === 'stars') {
      ctx.strokeStyle = 'rgba(253, 224, 71, 0.9)';
      ctx.lineWidth = 10;
      ctx.setLineDash([18, 12]);
      ctx.strokeRect(14, 14, w - 28, h - 28);
      ctx.setLineDash([]);
      ctx.font = '26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ['✨', '⭐', '✨', '⭐'].forEach((s, i) => {
        const coords = [
          [28, 28],
          [w - 28, 28],
          [28, h - 28],
          [w - 28, h - 28]
        ][i];
        ctx.fillText(s, coords[0], coords[1]);
      });
    } else if (frame === 'polaroid') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 26;
      ctx.strokeRect(13, 13, w - 26, h - 26);
    }
    ctx.restore();
  }

  function drawStickers(ctx, w, h, stickers) {
    if (!stickers || !stickers.length) return;
    ctx.save();
    ctx.font = '56px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = 10;
    stickers.forEach((st) => {
      const pos = STICKER_POSITIONS[st] || { x: 0.5, y: 0.5 };
      ctx.fillText(st, w * pos.x, h * pos.y);
    });
    ctx.restore();
  }

  function renderToCanvas(canvas, config, uploadedImage) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.filter = buildFilterString(config.filter, config.brightness || 100);

    if (uploadedImage) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(w / 2 + (config.offsetX || 0), h / 2 + (config.offsetY || 0));
      ctx.rotate(((config.rotate || 0) * Math.PI) / 180);
      const baseScale = Math.max(w / uploadedImage.width, h / uploadedImage.height);
      const scale = baseScale * (config.zoom || 1);
      ctx.scale(scale, scale);
      ctx.drawImage(uploadedImage, -uploadedImage.width / 2, -uploadedImage.height / 2);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(w / 2 + (config.offsetX || 0), h / 2 + (config.offsetY || 0));
      ctx.rotate(((config.rotate || 0) * Math.PI) / 180);
      ctx.scale(config.zoom || 1, config.zoom || 1);
      ctx.translate(-w / 2, -h / 2);
      drawPresetScene(ctx, w, h, config.preset || 'space');
      ctx.restore();
    }
    ctx.restore();

    drawFrame(ctx, w, h, config.frame);
    drawStickers(ctx, w, h, config.stickers);
  }

  function generateDefaultHeroDataUrl(meta) {
    const offscreen = document.createElement('canvas');
    offscreen.width = 900;
    offscreen.height = 420;
    renderToCanvas(offscreen, meta || {
      preset: 'space',
      zoom: 1,
      rotate: 0,
      brightness: 100,
      offsetX: 0,
      offsetY: 0,
      filter: 'none',
      frame: 'none',
      stickers: ['⭐', '🚀']
    }, null);
    return offscreen.toDataURL('image/jpeg', 0.85);
  }

  global.PhotoEditor = {
    PRESETS,
    renderToCanvas,
    generateDefaultHeroDataUrl
  };
})(window);
