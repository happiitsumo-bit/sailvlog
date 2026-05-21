// ── 定数 ──────────────────────────────────────────────
const RHO = 1.225;       // 空気密度 kg/m³
const SAIL_AREA = 10;    // 帆面積 m²（教育用固定値）

// N9-L5: 失速角を標準より2〜3°広く設定
const STALL_ANGLE_BASE = 17 * (Math.PI / 180);  // 基準失速角 17° [rad]

// 相対値の正規化スケール（真風速30kt全力時の揚力≈1800Nを100に対応）
const SCALE_MAX = 1800;

// ── 型定義 ──────────────────────────────────────────
export type SailState = "luffing" | "good" | "near-stall" | "stalled";

export interface PhysicsInput {
  /** シート角度 [deg]: 0=ラフィング, ~10=良トリム, 15+=失速 */
  sheetAngle: number;
  /** マストベンド [0.0〜1.0]: 0=ストレート, 1=最大ベンド */
  mastBend: number;
  /** 真風速 [knots] */
  windSpeedKnots: number;
  /** 真風向 [deg]: 0=真正面, 90=アビーム, 180=ラン */
  windDirDeg: number;
}

export interface PhysicsResult {
  /** 迎角 [deg] */
  angleOfAttackDeg: number;
  /** 揚力係数 */
  Cl: number;
  /** 抗力係数 */
  Cd: number;
  /** 揚力 [N] */
  liftN: number;
  /** 抗力 [N] */
  dragN: number;
  /** 揚抗比 */
  liftDragRatio: number;
  /** 推進力（0〜100 相対値） */
  driveForce: number;
  /** ヒール力（0〜100 相対値） */
  heelForce: number;
  /** 揚力（0〜100 相対値） */
  liftRel: number;
  /** 抗力（0〜100 相対値） */
  dragRel: number;
  /** 帆の状態 */
  state: SailState;
  /** 有効失速角 [deg]（mastBend が高いほど拡大） */
  stallAngleDeg: number;
  /**
   * 帆面の向き [rad]（ボート座標系）
   * 0=船首方向と平行
   */
  sailAngleRad: number;
  /**
   * 見かけの風向 [rad]（Phase1: 真風向=見かけの風向）
   */
  apparentWindRad: number;
  /** 揚力ベクトル（正規化済み）*/
  liftVec: { x: number; y: number };
  /** 抗力ベクトル（正規化済み）*/
  dragVec: { x: number; y: number };
  /** 推進力ベクトル（正規化済み）*/
  driveVec: { x: number; y: number };
  /** ヒール力ベクトル（正規化済み）*/
  heelVec: { x: number; y: number };
  /**
   * ドラフト比 [0〜1]: 帆の膨らみ量
   * Clに比例し、失速後に下がる
   */
  draftRatio: number;
  /**
   * ツイスト量 [0〜1]: マストトップの開き量
   * mastBend と失速状態に応じて増加
   */
  twistRatio: number;
}

// ── 内部ヘルパー ─────────────────────────────────────

function deg2rad(d: number): number {
  return d * (Math.PI / 180);
}

function knotsToMs(knots: number): number {
  return knots * 0.514444;
}

function normalize(x: number, y: number): { x: number; y: number } {
  const len = Math.sqrt(x * x + y * y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/**
 * N9-L5 揚力係数 Cl(α)
 * - 標準と比べてピーク前後の低下を20%緩和（フラットなピーク）
 * - mastBend が高いほど失速角が後退（Stall_angle_eff = base + mastBend×5°）
 */
function computeCl(alpha: number, stallAngle: number): number {
  if (alpha <= 0) return 0;

  if (alpha < stallAngle) {
    // 線形領域（薄翼理論ベース）
    const clLinear = 2 * Math.PI * Math.sin(alpha);
    // N9-L5 フラットピーク効果: 失速角に近づくほど低下を20%緩和
    const proximity = alpha / stallAngle;  // 0→1（失速角に近づく）
    const flatness = 1 + proximity * 0.2;  // 最大20%増
    return clLinear * flatness;
  }

  // 失速後: 失速角での値から指数減衰
  const clAtStall = 2 * Math.PI * Math.sin(stallAngle) * (1 + 0.2);
  const overshoot = alpha - stallAngle;
  // N9-L5: 失速後も急激には落ちない（係数0.3→0.25に緩和）
  return clAtStall * Math.exp(-overshoot * 2.5) * 0.75;
}

/**
 * 抗力係数 Cd(α): 形状抗力＋誘導抗力
 */
function computeCd(alpha: number, stallAngle: number): number {
  const Cd0 = 0.05;
  const cl = computeCl(alpha, stallAngle);
  return Cd0 + (0.1 * cl * cl) / Math.PI;
}

// ── メイン計算関数 ────────────────────────────────────

export function computePhysics(input: PhysicsInput): PhysicsResult {
  const { sheetAngle, mastBend, windSpeedKnots, windDirDeg } = input;

  const V = knotsToMs(windSpeedKnots);

  // N9-L5: mastBend で失速角を後退させる
  // Stall_angle_eff = base + mastBend × 5°
  const stallAngle = STALL_ANGLE_BASE + deg2rad(mastBend * 5);
  const stallAngleDeg = stallAngle * (180 / Math.PI);

  // Phase 1: 真風＝見かけの風（ボート速度=0）
  // windDirDeg: 0=正面, 90=アビーム, 180=ラン
  const windRad = deg2rad(windDirDeg);
  const windVec = { x: Math.sin(windRad), y: Math.cos(windRad) };

  // 帆の向き: sailRad = windRad - sheetAngle
  // sheetAngle=0  → 帆が風と平行（迎角≒0°, ラフィング）
  // sheetAngle=10 → 良トリム（迎角10°）
  // sheetAngle=17+ → 失速
  const sailRad = windRad - deg2rad(sheetAngle);
  const sailDir = { x: Math.sin(sailRad), y: Math.cos(sailRad) };

  // 迎角 α = windVec と sailDir のなす角（0〜90°）
  const dotWS   = windVec.x * sailDir.x + windVec.y * sailDir.y;
  const crossWS = windVec.x * sailDir.y - windVec.y * sailDir.x;
  let alpha = Math.atan2(Math.abs(crossWS), dotWS);
  if (alpha > Math.PI / 2) alpha = Math.PI - alpha;
  const alphaEffective = Math.max(0, alpha);

  // N9-L5 mastBend による Cl 補正
  // Cl_eff = Cl(alpha) × (1 - mastBend × 0.3)
  const clRaw = computeCl(alphaEffective, stallAngle);
  const Cl    = clRaw * (1 - mastBend * 0.3);
  const Cd    = computeCd(alphaEffective, stallAngle);

  const dynamicPressure = 0.5 * RHO * V * V * SAIL_AREA;
  const liftN = dynamicPressure * Cl;
  const dragN = dynamicPressure * Cd;
  const liftDragRatio = dragN > 0 ? liftN / dragN : 0;

  // 揚力方向: 帆面に垂直（法線ベクトル）で、風が当たる面の風上側に向く
  const rawNx =  sailDir.y;
  const rawNy = -sailDir.x;
  const dotNW = rawNx * windVec.x + rawNy * windVec.y;
  const sailNormalX = dotNW >= 0 ? rawNx : -rawNx;
  const sailNormalY = dotNW >= 0 ? rawNy : -rawNy;
  const liftVecNorm = normalize(sailNormalX, sailNormalY);
  const dragVecNorm = normalize(windVec.x, windVec.y);

  // 合力を船首方向 / ヒール方向に分解
  const forceX = liftVecNorm.x * liftN + dragVecNorm.x * dragN;
  const forceY = liftVecNorm.y * liftN + dragVecNorm.y * dragN;
  const driveN = -forceY;  // y軸負=船首方向（前進）
  const heelN  =  forceX;  // x軸正=右舷（ヒール）

  // 0〜100 正規化
  const liftRel  = Math.min(100, Math.round((liftN / SCALE_MAX) * 100));
  const dragRel  = Math.min(100, Math.round((dragN / SCALE_MAX) * 100));
  const driveRel = Math.min(100, Math.round((Math.max(0, driveN) / SCALE_MAX) * 100));
  const heelRel  = Math.min(100, Math.round((Math.abs(heelN) / SCALE_MAX) * 100));

  // 状態判定（有効失速角基準）
  const alphaDeg = alphaEffective * (180 / Math.PI);
  let state: SailState;
  if (alphaDeg < 3)                       state = "luffing";
  else if (alphaDeg < stallAngleDeg - 5)  state = "good";
  else if (alphaDeg < stallAngleDeg)      state = "near-stall";
  else                                    state = "stalled";

  // ドラフト比: 良トリム時に最大、失速後は低下
  const draftRatio = state === "stalled"
    ? Math.max(0.2, Cl / (2 * Math.PI * Math.sin(stallAngle)))
    : Cl / (2 * Math.PI * Math.sin(stallAngle) * 1.2);

  // ツイスト比: mastBend が大きいほど増加、失速時も増加
  const twistRatio = Math.min(1, mastBend * 0.7 + (state === "stalled" ? 0.4 : 0));

  const totalForce = Math.sqrt(forceX * forceX + forceY * forceY) || 1;
  const driveVec = { x: 0, y: -(Math.max(0, driveN) / totalForce) };
  const heelVec  = { x: (heelN / totalForce), y: 0 };

  return {
    angleOfAttackDeg: Math.round(alphaDeg * 10) / 10,
    Cl: Math.round(Cl * 1000) / 1000,
    Cd: Math.round(Cd * 1000) / 1000,
    liftN: Math.round(liftN),
    dragN: Math.round(dragN),
    liftDragRatio: Math.round(liftDragRatio * 10) / 10,
    driveForce: driveRel,
    heelForce: heelRel,
    liftRel,
    dragRel,
    state,
    stallAngleDeg: Math.round(stallAngleDeg * 10) / 10,
    sailAngleRad: sailRad,
    apparentWindRad: windRad,
    liftVec: liftVecNorm,
    dragVec: dragVecNorm,
    driveVec,
    heelVec,
    draftRatio: Math.min(1, Math.max(0, draftRatio)),
    twistRatio: Math.min(1, Math.max(0, twistRatio)),
  };
}
