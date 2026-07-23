// SPIKE-01 使い捨てプロトタイプ: Canvas 2D直描き版 (案a)
// RQ-01(a) x RQ-02(b) x RQ-03(a) の組み合わせを検証する。
// Puppeteer 計測ハーネスから window.__spike 経由で操作できるようにしている。

(function () {
  'use strict';

  const BASE_LAT = 35.302;
  const BASE_LON = 139.480;
  const M_PER_DEG_LAT = 111320;
  const N_BOATS = 6;
  const HZ = 1;
  const DURATION_S = 2 * 60 * 60;
  const N_POINTS = DURATION_S * HZ; // 7200
  const HIGHLIGHT = new Set([0, 2]); // boat1, boat3 (欠測艇) をハイライト
  const TAIL_SECONDS_DEFAULT = 300; // 直近5分の航跡テール
  const COLORS = ['#ff6b6b', '#4ecdc4', '#ffd93d', '#95e1d3', '#a78bfa', '#f38181'];

  const cv = document.getElementById('cv');
  const ctx = cv.getContext('2d');
  const statsEl = document.getElementById('stats');
  const seekEl = document.getElementById('seek');
  const timeLabelEl = document.getElementById('timeLabel');
  const playPauseBtn = document.getElementById('playPause');
  const noiseSel = document.getElementById('noiseSel');
  const tailToggle = document.getElementById('tailToggle');
  const legendEl = document.getElementById('legend');

  function latLonToXY(lat, lon) {
    const y = (lat - BASE_LAT) * M_PER_DEG_LAT;
    const mPerDegLon = M_PER_DEG_LAT * Math.cos((BASE_LAT * Math.PI) / 180);
    const x = (lon - BASE_LON) * mPerDegLon;
    return { x, y };
  }

  function parseGpx(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    const trkpts = Array.from(doc.getElementsByTagName('trkpt'));
    const baseTimeMs = trkpts.length ? Date.parse(trkpts[0].getElementsByTagName('time')[0].textContent) : 0;
    return trkpts.map((tp) => {
      const lat = parseFloat(tp.getAttribute('lat'));
      const lon = parseFloat(tp.getAttribute('lon'));
      const timeMs = Date.parse(tp.getElementsByTagName('time')[0].textContent);
      const t = Math.round((timeMs - baseTimeMs) / 1000);
      return { t, lat, lon };
    });
  }

  // RQ-03(a): 事前に1Hzグリッド(Float64Array)化し、以後は再生中にindexアクセスのみで済ませる。
  // 欠測秒は前後の既知点から線形補間して埋める(グリッド構築は初回ロード時の1回のみ実行)。
  function buildGrid(points) {
    const gx = new Float64Array(N_POINTS);
    const gy = new Float64Array(N_POINTS);
    const known = new Uint8Array(N_POINTS);
    for (const p of points) {
      if (p.t < 0 || p.t >= N_POINTS) continue;
      const { x, y } = latLonToXY(p.lat, p.lon);
      gx[p.t] = x;
      gy[p.t] = y;
      known[p.t] = 1;
    }
    // 欠測区間を線形補間
    let i = 0;
    while (i < N_POINTS) {
      if (known[i]) { i++; continue; }
      const gapStart = i;
      while (i < N_POINTS && !known[i]) i++;
      const gapEnd = i; // exclusive, known[gapEnd] === 1 または末尾
      const prevIdx = gapStart - 1;
      const nextIdx = gapEnd < N_POINTS ? gapEnd : prevIdx;
      const x0 = prevIdx >= 0 ? gx[prevIdx] : gx[nextIdx];
      const y0 = prevIdx >= 0 ? gy[prevIdx] : gy[nextIdx];
      const x1 = gx[nextIdx];
      const y1 = gy[nextIdx];
      const span = Math.max(1, gapEnd - prevIdx);
      for (let j = gapStart; j < gapEnd; j++) {
        const frac = (j - prevIdx) / span;
        gx[j] = x0 + (x1 - x0) * frac;
        gy[j] = y0 + (y1 - y0) * frac;
      }
    }
    return { gx, gy };
  }

  const state = {
    boats: [], // { gx, gy, color, name }
    noiseVariant: 'sigma3',
    loaded: false,
    playing: false,
    speed: 1,
    simTime: 0, // 秒 (0..N_POINTS-1)
    lastFrameWallMs: null,
    tailOn: true,
    tailSeconds: TAIL_SECONDS_DEFAULT,
    view: null, // { scale, offsetX, offsetY }
    frameDeltas: [], // rAF間隔ログ (ms)
    renderDurations: [], // renderFrame()自体の実行時間ログ (ms)
    rafHandle: null,
  };

  window.__spike = {
    frameDeltas: state.frameDeltas,
    renderDurations: state.renderDurations,
    clearRenderDurations: () => { state.renderDurations.length = 0; },
    getState: () => ({ playing: state.playing, speed: state.speed, simTime: state.simTime, noiseVariant: state.noiseVariant }),
    play: () => { state.playing = true; state.lastFrameWallMs = null; playPauseBtn.textContent = '停止'; },
    pause: () => { state.playing = false; playPauseBtn.textContent = '再生'; },
    setSpeed: (s) => { state.speed = s; },
    seekTo: (seconds) => {
      const t0 = performance.now();
      state.simTime = Math.max(0, Math.min(N_POINTS - 1, seconds));
      renderFrame();
      const t1 = performance.now();
      return t1 - t0; // 表示更新までの応答時間(ms)
    },
    setTail: (on) => { state.tailOn = on; },
    loadVariant: (variant) => loadAll(variant),
    getHeapUsedBytes: () => (performance.memory ? performance.memory.usedJSHeapSize : null),
    clearFrameDeltas: () => { state.frameDeltas.length = 0; },
    isLoaded: () => state.loaded,
    N_POINTS,
  };

  function computeView() {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const b of state.boats) {
      for (let i = 0; i < N_POINTS; i++) {
        if (b.gx[i] < minX) minX = b.gx[i];
        if (b.gx[i] > maxX) maxX = b.gx[i];
        if (b.gy[i] < minY) minY = b.gy[i];
        if (b.gy[i] > maxY) maxY = b.gy[i];
      }
    }
    const marginPx = 60;
    const w = cv.width - marginPx * 2;
    const h = cv.height - marginPx * 2;
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const scale = Math.min(w / spanX, h / spanY);
    state.view = {
      scale,
      minX, minY,
      offsetX: marginPx + (w - spanX * scale) / 2,
      offsetY: marginPx + (h - spanY * scale) / 2,
    };
  }

  function toScreen(x, y) {
    const v = state.view;
    const sx = v.offsetX + (x - v.minX) * v.scale;
    // 北(y+)を画面上方向にするためY反転
    const sy = cv.height - (v.offsetY + (y - v.minY) * v.scale);
    return [sx, sy];
  }

  function renderFrame() {
    const __renderT0 = performance.now();
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!state.loaded) return;
    const idx = Math.floor(state.simTime);

    // スケールバー (500m)
    drawScaleBar();

    for (let bi = 0; bi < state.boats.length; bi++) {
      const b = state.boats[bi];
      const highlighted = HIGHLIGHT.has(bi);

      if (state.tailOn) {
        const tailStart = Math.max(0, idx - state.tailSeconds);
        ctx.beginPath();
        let started = false;
        for (let i = tailStart; i <= idx; i += 1) {
          const [sx, sy] = toScreen(b.gx[i], b.gy[i]);
          if (!started) { ctx.moveTo(sx, sy); started = true; } else { ctx.lineTo(sx, sy); }
        }
        ctx.strokeStyle = b.color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = highlighted ? 2 : 1;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const [sx, sy] = toScreen(b.gx[idx], b.gy[idx]);
      ctx.beginPath();
      ctx.arc(sx, sy, highlighted ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      if (highlighted) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }
    }

    seekEl.value = String(idx);
    timeLabelEl.textContent = formatTime(idx);
    state.lastRenderMs = performance.now() - __renderT0;
    state.renderDurations.push(state.lastRenderMs);
    if (state.renderDurations.length > 5000) state.renderDurations.shift();
  }

  function drawScaleBar() {
    const meters = 500;
    const pxLen = meters * state.view.scale;
    const x0 = 20, y0 = cv.height - 20;
    ctx.strokeStyle = '#9fb2cf';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + pxLen, y0);
    ctx.stroke();
    ctx.fillStyle = '#9fb2cf';
    ctx.font = '12px system-ui';
    ctx.fillText(`${meters} m`, x0, y0 - 6);
  }

  function formatTime(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(Math.floor(seconds % 60)).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function loop(nowMs) {
    if (state.lastFrameWallMs != null) {
      const delta = nowMs - state.lastFrameWallMs;
      state.frameDeltas.push(delta);
      if (state.frameDeltas.length > 5000) state.frameDeltas.shift();
      if (state.playing) {
        state.simTime += (delta / 1000) * state.speed;
        if (state.simTime >= N_POINTS - 1) {
          state.simTime = N_POINTS - 1;
          state.playing = false;
          playPauseBtn.textContent = '再生';
        }
      }
    }
    state.lastFrameWallMs = nowMs;
    renderFrame();
    updateStatsUI();
    state.rafHandle = requestAnimationFrame(loop);
  }

  function updateStatsUI() {
    const arr = state.frameDeltas;
    if (arr.length < 5) { statsEl.textContent = 'measuring...'; return; }
    const sorted = [...arr].slice(-300).sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const fps = 1000 / (sorted.reduce((a, b) => a + b, 0) / sorted.length);
    const heap = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + 'MB' : 'n/a';
    statsEl.textContent = `frame p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms fps~=${fps.toFixed(1)} heap=${heap} speed=${state.speed}x`;
  }

  async function loadAll(variant) {
    state.loaded = false;
    statsEl.textContent = 'loading GPX...';
    const t0 = performance.now();
    const boats = [];
    for (let i = 0; i < N_BOATS; i++) {
      const name = `boat${i + 1}`;
      const res = await fetch(`../gpx/${name}_${variant}.gpx`);
      const text = await res.text();
      const pts = parseGpx(text);
      const { gx, gy } = buildGrid(pts);
      boats.push({ name, gx, gy, color: COLORS[i % COLORS.length] });
    }
    state.boats = boats;
    state.noiseVariant = variant;
    noiseSel.value = variant;
    computeView();
    state.loaded = true;
    const t1 = performance.now();
    window.__spike.lastLoadMs = t1 - t0;
    legendEl.innerHTML = boats
      .map((b, i) => `<span class="dot" style="background:${b.color}"></span>${b.name}${HIGHLIGHT.has(i) ? ' (highlight)' : ''}`)
      .join(' &nbsp; ');
    renderFrame();
    return t1 - t0;
  }

  // UI wiring
  playPauseBtn.addEventListener('click', () => {
    if (state.playing) window.__spike.pause(); else window.__spike.play();
  });
  document.querySelectorAll('.speedBtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.speedBtn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      window.__spike.setSpeed(Number(btn.dataset.speed));
    });
  });
  seekEl.addEventListener('input', () => {
    window.__spike.seekTo(Number(seekEl.value));
  });
  noiseSel.addEventListener('change', () => loadAll(noiseSel.value));
  tailToggle.addEventListener('change', () => { state.tailOn = tailToggle.checked; });

  loadAll(noiseSel.value).then(() => {
    state.rafHandle = requestAnimationFrame(loop);
  });
})();
