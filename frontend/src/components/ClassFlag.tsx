// セーリング各クラスの旗を SVG で表現するコンポーネント。
// 実物のクラスフラッグを簡略化したシンボル表記。

type Props = {
  slug: string;
  className?: string;
};

export default function ClassFlag({ slug, className }: Props) {
  const key = slug.toLowerCase();
  const common = { className: `class-flag ${className ?? ""}`.trim(), viewBox: "0 0 40 26" };

  if (key === "470") {
    // 白地・上下に赤帯・中央に "470"
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="470 class flag">
        <rect width="40" height="26" fill="#ffffff" />
        <rect y="0" width="40" height="4" fill="#e6261f" />
        <rect y="22" width="40" height="4" fill="#e6261f" />
        <text x="20" y="18" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="800" fontSize="11" fill="#0a2a3a">470</text>
      </svg>
    );
  }
  if (key === "ilca" || key === "laser" || key === "laser-ilca") {
    // 白地に赤いレーザー (ILCA) シンボル — レーザー級のロゴ風
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="ILCA class flag">
        <rect width="40" height="26" fill="#ffffff" />
        {/* レーザービーム風 ─ 斜めライン */}
        <path d="M4 22 L20 6 L36 22" stroke="#e6261f" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="20" cy="6" r="2.5" fill="#e6261f" />
      </svg>
    );
  }
  if (key === "snipe") {
    // 黄地に黒シルエットのスナイプ鳥（簡略化）
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="Snipe class flag">
        <rect width="40" height="26" fill="#fbd400" />
        {/* くちばし長い鳥のシルエット */}
        <path d="M6 16 Q11 10 18 12 L26 8 L24 13 Q30 14 33 18 L26 17 Q22 20 16 19 Q10 19 6 16 Z" fill="#0a2a3a" />
        <circle cx="22" cy="12" r="0.8" fill="#fbd400" />
      </svg>
    );
  }
  if (key === "49er") {
    // 青地・対角白ストライプ・赤い "49"
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="49er class flag">
        <rect width="40" height="26" fill="#0066b3" />
        <path d="M0 26 L40 0 L40 6 L8 26 Z" fill="#ffffff" />
        <text x="9" y="11" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="800" fontSize="9" fill="#e6261f">49</text>
      </svg>
    );
  }
  if (key === "cruiser") {
    // バーガー（三角旗）モチーフ — 横長旗の中央に三角形
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="Cruiser flag">
        <rect width="40" height="26" fill="#0a2a3a" />
        <path d="M2 4 L34 13 L2 22 Z" fill="#ffd700" stroke="#ffffff" strokeWidth="0.5" />
      </svg>
    );
  }
  if (key === "other") {
    // モノクロのジオメトリック旗（白黒の市松風）
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="Other class flag">
        <rect width="40" height="26" fill="#ffffff" />
        <rect x="0" y="0" width="20" height="13" fill="#0a2a3a" />
        <rect x="20" y="13" width="20" height="13" fill="#0a2a3a" />
      </svg>
    );
  }

  // フォールバック: グレー旗
  return (
    <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="Class flag">
      <rect width="40" height="26" fill="#5a6378" />
      <text x="20" y="17" textAnchor="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="9" fill="#ffffff">{slug.toUpperCase().slice(0, 3)}</text>
    </svg>
  );
}
