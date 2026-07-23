#!/usr/bin/env node
/**
 * SPIKE-01 使い捨てスクリプト: 470 O2コース模擬の合成GPXを6艇分生成する。
 * - 1Hz, 2時間 (7200点/艇)
 * - 風上: タック往復 / 風下: ジャイブ往復のジグザグ
 * - ノイズ2水準 (sigma=3m, sigma=8m) + ノイズなし(clean, 目視比較の基準)
 * - 1艇 (boat3) に 30秒 x 2 の欠測ギャップを全バリアントに適用
 *
 * 本番コードではない。spike/ 内で完結し、frontend/backend には一切依存しない。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'gpx');
fs.mkdirSync(OUT_DIR, { recursive: true });

// 基準地点: 江の島(2020東京五輪セーリング会場)付近を仮の470 O2コース中心に採用
const BASE_LAT = 35.302;
const BASE_LON = 139.480;
const HZ = 1;
const DURATION_S = 2 * 60 * 60; // 2時間
const N_POINTS = DURATION_S * HZ; // 7200
const N_BOATS = 6;

// 平面投影(メートル)→緯度経度の簡易変換 (小領域なので等長円筒近似で十分)
const M_PER_DEG_LAT = 111320;
function metersToLatLon(xEast, yNorth) {
  const lat = BASE_LAT + yNorth / M_PER_DEG_LAT;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((BASE_LAT * Math.PI) / 180);
  const lon = BASE_LON + xEast / mPerDegLon;
  return { lat, lon };
}

// 正規分布乱数 (Box-Muller)
function gaussian(sigma) {
  if (sigma === 0) return 0;
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * sigma;
}

// 1艇分の航跡(x,y メートル, ノイズなし)を1Hzで生成する。
// 風上/風下レグを交互に繰り返す 470 O2 コースの簡易模擬:
//   - 風上レグ: 真北(風上方向)に向けタックを繰り返しながら前進 (VMG方向 ±42度)
//   - 風下レグ: 真南に向けジャイブを繰り返しながら前進 (VMG方向 ±30度)
// レグ長・タック周期・艇速は艇ごとに微妙にずらしてリアリティを出す。
function genBoatTrack(boatIndex) {
  const rnd = mulberry32(1000 + boatIndex * 97); // 艇ごとに再現可能な専用乱数列
  const speedUpwind = 3.2 + rnd() * 0.6; // m/s (約6.2-7.4kt)
  const speedDownwind = 4.3 + rnd() * 0.8; // m/s
  const tackAngleUpwind = (40 + rnd() * 6) * (Math.PI / 180);
  const tackAngleDownwind = (28 + rnd() * 6) * (Math.PI / 180);
  const tackPeriodUpwind = 80 + rnd() * 40; // 秒 (タック間隔)
  const tackPeriodDownwind = 70 + rnd() * 40;
  const legLength = 900; // 風上/風下レグの縦方向長さ(m) 目安
  const startXOffset = (boatIndex - (N_BOATS - 1) / 2) * 12; // スタートライン上の横並び

  const pts = new Array(N_POINTS);
  let x = startXOffset;
  let y = 0;
  let leg = 'upwind'; // upwind→downwind→upwind... を繰り返す
  let legStartY = 0;
  let tackSign = boatIndex % 2 === 0 ? 1 : -1;
  let tSinceTack = 0;

  for (let i = 0; i < N_POINTS; i++) {
    const t = i / HZ;
    const isUpwind = leg === 'upwind';
    const speed = isUpwind ? speedUpwind : speedDownwind;
    const tackAngle = isUpwind ? tackAngleUpwind : tackAngleDownwind;
    const tackPeriod = isUpwind ? tackPeriodUpwind : tackPeriodDownwind;

    if (tSinceTack >= tackPeriod) {
      tackSign *= -1;
      tSinceTack = 0;
    }

    const heading = isUpwind
      ? Math.PI - tackSign * tackAngle // 概ね北向き(y+)にVMG、東西にジグザグ
      : tackSign * tackAngle; // 概ね南向き(y-)にVMG、東西にジグザグ
    // heading は「東からの角度」ではなく直接dx,dyへ変換する簡易表現にする
    const dy = isUpwind ? Math.cos(tackAngle) * speed : -Math.cos(tackAngle) * speed;
    const dx = tackSign * Math.sin(tackAngle) * speed;

    x += dx / HZ;
    y += dy / HZ;
    tSinceTack += 1 / HZ;

    pts[i] = { t, x, y };

    // レグ切り替え判定 (縦方向の進み具合で判定)
    if (isUpwind && y - legStartY >= legLength) {
      leg = 'downwind';
      legStartY = y;
    } else if (!isUpwind && legStartY - y >= legLength) {
      leg = 'upwind';
      legStartY = y;
    }
  }
  return pts;
}

// 決定的な擬似乱数 (艇ごとに再現性を持たせる)
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 欠測ギャップ: boat3 (0-indexed 2) に 30秒x2 箇所の欠測を入れる
const GAP_BOAT_INDEX = 2;
const GAP_RANGES_S = [
  [1800, 1830], // 30分地点で30秒
  [4500, 4530], // 75分地点で30秒
];

function isInGap(boatIndex, t) {
  if (boatIndex !== GAP_BOAT_INDEX) return false;
  return GAP_RANGES_S.some(([s, e]) => t >= s && t < e);
}

function toGpxTimestamp(baseDate, tSeconds) {
  return new Date(baseDate.getTime() + tSeconds * 1000).toISOString();
}

function buildGpx(boatName, points, baseDate) {
  const trkpts = points
    .map((p) => {
      return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"><time>${toGpxTimestamp(baseDate, p.t)}</time></trkpt>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="sailvlog-spike-01" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>${boatName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;
}

const BASE_DATE = new Date('2026-07-24T05:00:00Z'); // レース開始時刻(UTC)、任意
const NOISE_VARIANTS = [
  { key: 'clean', sigma: 0 },
  { key: 'sigma3', sigma: 3 },
  { key: 'sigma8', sigma: 8 },
];

const summary = [];

for (let b = 0; b < N_BOATS; b++) {
  const boatName = `boat${b + 1}`;
  const track = genBoatTrack(b);

  for (const variant of NOISE_VARIANTS) {
    const points = [];
    for (const p of track) {
      if (isInGap(b, p.t)) continue; // 欠測ギャップ: 点を出力しない
      const nx = p.x + gaussian(variant.sigma);
      const ny = p.y + gaussian(variant.sigma);
      const { lat, lon } = metersToLatLon(nx, ny);
      points.push({ t: p.t, lat, lon });
    }
    const gpx = buildGpx(`${boatName}_${variant.key}`, points, BASE_DATE);
    const filePath = path.join(OUT_DIR, `${boatName}_${variant.key}.gpx`);
    fs.writeFileSync(filePath, gpx, 'utf8');
    summary.push({
      file: path.relative(process.cwd(), filePath),
      points: points.length,
      expectedPoints: N_POINTS - (b === GAP_BOAT_INDEX ? 60 : 0),
    });
  }
}

console.log('生成完了:');
for (const s of summary) {
  console.log(`  ${s.file}: ${s.points}点 (期待値 ${s.expectedPoints}点)`);
}
console.log(`\n合計: ${N_BOATS}艇 x ${NOISE_VARIANTS.length}バリアント = ${N_BOATS * NOISE_VARIANTS.length}ファイル`);
