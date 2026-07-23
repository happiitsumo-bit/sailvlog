#!/usr/bin/env node
/**
 * SPIKE-01 計測ハーネス (Puppeteer)
 * 前提: `npx serve -l 5055 .` を spike/ ディレクトリで起動済みであること
 *       (`npm run serve` でも可)
 *
 * 計測項目 (RESEARCH.md PASS基準に対応):
 *  1. 通常再生のフレーム間隔 p50/p95 (1x/4x/8x) + 航跡テールON/OFF
 *  2. シーク応答時間 (performance.now()差分)
 *  3. 初期ロード時間 (GPXパース+正規化+初回描画)
 *  4. 30分相当の連続シークでのヒープ推移 (発散有無)
 *  5. σ=3m / σ=8m 比較スクリーンショット
 *
 * 出力: 標準出力に生数値、screenshots/ にPNG
 */
'use strict';
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE_URL = process.env.SPIKE_URL || 'http://localhost:5055/public/';
const SHOT_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}
function avgFps(deltas) {
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  return 1000 / mean;
}

async function collectFrames(page, ms) {
  await page.evaluate(() => { window.__spike.clearFrameDeltas(); window.__spike.clearRenderDurations(); });
  await new Promise((r) => setTimeout(r, ms));
  const deltas = await page.evaluate(() => window.__spike.frameDeltas.slice());
  const renders = await page.evaluate(() => window.__spike.renderDurations.slice());
  return { deltas, renders };
}

async function main() {
  const results = { meta: {}, initialLoad: {}, playback: {}, seek: {}, memory: {}, screenshots: {} };

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const version = await browser.version();
  results.meta.chromeVersion = version;
  results.meta.platform = process.platform;
  results.meta.node = process.version;
  results.meta.timestamp = new Date().toISOString();

  // --- 1. 初期ロード時間 ---
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const t0 = Date.now();
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__spike && window.__spike.isLoaded()', { timeout: 30000 });
    const t1 = Date.now();
    const lastLoadMs = await page.evaluate(() => window.__spike.lastLoadMs);
    results.initialLoad.wallClockMs = t1 - t0;
    results.initialLoad.internalLoadMs = lastLoadMs;
    console.log(`[初期ロード] wall=${t1 - t0}ms internal(fetch+parse+grid+初回描画)=${lastLoadMs.toFixed(1)}ms`);
    await page.close();
  }

  // --- 2. 通常再生フレームレート (1x/4x/8x, テールON) ---
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await page.waitForFunction('window.__spike && window.__spike.isLoaded()', { timeout: 30000 });

  for (const speed of [1, 4, 8]) {
    await page.evaluate((s) => { window.__spike.setSpeed(s); window.__spike.seekTo(0); window.__spike.play(); }, speed);
    const { deltas, renders } = await collectFrames(page, 5000);
    await page.evaluate(() => window.__spike.pause());
    const p50 = percentile(deltas, 0.5);
    const p95 = percentile(deltas, 0.95);
    const fps = avgFps(deltas);
    const renderP50 = percentile(renders, 0.5);
    const renderP95 = percentile(renders, 0.95);
    const within16ms = renders.filter((d) => d <= 16).length / renders.length;
    results.playback[`${speed}x_tailOn`] = {
      samples: deltas.length, rafDeltaP50Ms: p50, rafDeltaP95Ms: p95, avgFps: fps,
      renderDurationP50Ms: renderP50, renderDurationP95Ms: renderP95, pctRenders_le16ms: within16ms,
    };
    console.log(`[再生 ${speed}x tail=ON] n=${deltas.length} rAF間隔 p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms avgFps=${fps.toFixed(1)} | renderFrame実行時間 p50=${renderP50.toFixed(2)}ms p95=${renderP95.toFixed(2)}ms <=16ms比率=${(within16ms * 100).toFixed(1)}%`);
  }

  // テールOFFでも1点だけ測定 (比較用)
  await page.evaluate(() => { document.getElementById('tailToggle').click(); window.__spike.setSpeed(4); window.__spike.seekTo(0); window.__spike.play(); });
  {
    const { deltas, renders } = await collectFrames(page, 5000);
    await page.evaluate(() => window.__spike.pause());
    const p50 = percentile(deltas, 0.5);
    const p95 = percentile(deltas, 0.95);
    const fps = avgFps(deltas);
    const renderP50 = percentile(renders, 0.5);
    const renderP95 = percentile(renders, 0.95);
    results.playback['4x_tailOff'] = { samples: deltas.length, rafDeltaP50Ms: p50, rafDeltaP95Ms: p95, avgFps: fps, renderDurationP50Ms: renderP50, renderDurationP95Ms: renderP95 };
    console.log(`[再生 4x tail=OFF] n=${deltas.length} rAF間隔 p50=${p50.toFixed(2)}ms p95=${p95.toFixed(2)}ms avgFps=${fps.toFixed(1)} | renderFrame実行時間 p50=${renderP50.toFixed(2)}ms p95=${renderP95.toFixed(2)}ms`);
  }
  await page.evaluate(() => { if (!document.getElementById('tailToggle').checked) document.getElementById('tailToggle').click(); });

  // --- 3. シーク応答時間 ---
  {
    const seekTargets = [100, 1800, 3600, 5400, 7100];
    const seekMs = [];
    for (const t of seekTargets) {
      const ms = await page.evaluate((tt) => window.__spike.seekTo(tt), t);
      seekMs.push(ms);
    }
    results.seek.targets = seekTargets;
    results.seek.responseMs = seekMs;
    results.seek.maxMs = Math.max(...seekMs);
    console.log(`[シーク応答] targets=${seekTargets.join(',')} ms=${seekMs.map((m) => m.toFixed(2)).join(',')} max=${Math.max(...seekMs).toFixed(2)}ms`);
  }

  // --- 4. メモリ推移 (30分相当の連続スクラブ) ---
  {
    const heapSamples = [];
    const initialHeap = await page.evaluate(() => window.__spike.getHeapUsedBytes());
    heapSamples.push(initialHeap);
    // 30分(1800秒)相当を60回のランダムシークでスクラブし続ける
    for (let i = 0; i < 60; i++) {
      const t = Math.floor(Math.random() * 7199);
      await page.evaluate((tt) => window.__spike.seekTo(tt), t);
      if (i % 10 === 9) {
        await page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
        const h = await page.evaluate(() => window.__spike.getHeapUsedBytes());
        heapSamples.push(h);
      }
    }
    results.memory.samplesBytes = heapSamples;
    results.memory.supported = initialHeap !== null;
    if (initialHeap !== null) {
      const first = heapSamples[0];
      const last = heapSamples[heapSamples.length - 1];
      results.memory.deltaMB = (last - first) / 1048576;
      console.log(`[メモリ] performance.memory対応=true 開始=${(first / 1048576).toFixed(1)}MB 終了=${(last / 1048576).toFixed(1)}MB 差分=${((last - first) / 1048576).toFixed(1)}MB`);
      console.log(`[メモリ] 推移(MB): ${heapSamples.map((b) => (b / 1048576).toFixed(1)).join(' -> ')}`);
    } else {
      console.log('[メモリ] performance.memory 非対応 (このChromeビルドでは取得不可)');
    }
  }
  await page.close();

  // --- 5. スクリーンショット (σ比較 + 通常見た目) ---
  {
    for (const variant of ['clean', 'sigma3', 'sigma8']) {
      const p = await browser.newPage();
      await p.setViewport({ width: 1280, height: 900 });
      await p.goto(BASE_URL, { waitUntil: 'networkidle0' });
      await p.waitForFunction('window.__spike && window.__spike.isLoaded()', { timeout: 30000 });
      await p.evaluate((v) => window.__spike.loadVariant(v), variant);
      await p.waitForFunction('window.__spike && window.__spike.isLoaded()', { timeout: 30000 });
      await p.evaluate(() => window.__spike.seekTo(2400)); // 40分地点 (タック局面が写るように)
      await new Promise((r) => setTimeout(r, 200));
      const fname = `noise-${variant}.png`;
      await p.screenshot({ path: path.join(SHOT_DIR, fname) });
      results.screenshots[variant] = `screenshots/${fname}`;
      console.log(`[スクショ] ${variant} -> screenshots/${fname}`);
      await p.close();
    }

    // 欠測ギャップ地点 (boat3, 30分=1800s付近) の描画確認スクショ
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 900 });
    await p.goto(BASE_URL, { waitUntil: 'networkidle0' });
    await p.waitForFunction('window.__spike && window.__spike.isLoaded()', { timeout: 30000 });
    await p.evaluate(() => window.__spike.seekTo(1815)); // ギャップ区間内
    await new Promise((r) => setTimeout(r, 200));
    await p.screenshot({ path: path.join(SHOT_DIR, 'gap-interpolation.png') });
    results.screenshots.gap = 'screenshots/gap-interpolation.png';
    console.log('[スクショ] 欠測ギャップ補間 -> screenshots/gap-interpolation.png');
    await p.close();
  }

  await browser.close();

  fs.writeFileSync(path.join(__dirname, 'measure-results.json'), JSON.stringify(results, null, 2));
  console.log('\n=== 生データを measure-results.json に保存 ===');
}

main().catch((e) => { console.error('計測失敗:', e); process.exit(1); });
