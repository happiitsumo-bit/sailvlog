type Props = {
  slug: string;
  className?: string;
};

export default function ClassFlag({ slug, className }: Props) {
  const key = slug.toLowerCase();
  const common = { className: `class-flag ${className ?? ""}`.trim(), viewBox: "0 0 40 26" };

  if (key === "470") {
    // 公式デザイン: 白地・上下に赤帯・中央に "470"
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="470 class flag">
        <rect width="40" height="26" fill="#ffffff" />
        <rect y="0" width="40" height="4" fill="#cc0000" />
        <rect y="22" width="40" height="4" fill="#cc0000" />
        <text x="20" y="18" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="12" fill="#000000">470</text>
      </svg>
    );
  }

  if (key === "ilca" || key === "laser" || key === "laser-ilca") {
    // 公式デザイン: 白地（ILCA7）に赤いイタリック体 "ILCA" ロゴ
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="ILCA class flag">
        <rect width="40" height="26" fill="#ffffff" />
        <text
          x="20" y="18"
          textAnchor="middle"
          fontFamily="Arial Black, Arial, sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="11"
          fill="#cc0000"
          letterSpacing="-0.5"
        >ILCA</text>
      </svg>
    );
  }

  if (key === "snipe") {
    // 公式デザイン: 白地に黒いSnipe鳥シルエット（横向き飛翔、長いくちばし）
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="Snipe class flag">
        <rect width="40" height="26" fill="#ffffff" />
        {/* Snipe鳥シルエット: 長いくちばし、流線型の体、翼を広げた飛翔姿勢 */}
        <path
          d="M3 14 L10 11 L16 9 L22 7 L28 8 L32 10 L36 9 L33 12 L28 12 L22 14 L18 16 L14 17 L10 16 L7 17 L5 16 Z"
          fill="#000000"
        />
        <path d="M16 9 L20 5 L24 7 L22 9 Z" fill="#000000" />
        <circle cx="34" cy="9.5" r="0.8" fill="#ffffff" />
      </svg>
    );
  }

  if (key === "49er") {
    // 公式デザイン: 白地に赤い "49er" ロゴ（FXも含む斜めスラッシュスタイル）
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="49er class flag">
        <rect width="40" height="26" fill="#ffffff" />
        <text
          x="20" y="17"
          textAnchor="middle"
          fontFamily="Arial Black, Arial, sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="13"
          fill="#cc0000"
          letterSpacing="-0.5"
        >49er</text>
      </svg>
    );
  }

  if (key === "cruiser") {
    // バーガーフラッグ（pennant）: 縦3色ペナント形状
    return (
      <svg {...common} xmlns="http://www.w3.org/2000/svg" aria-label="Cruiser flag">
        <rect width="40" height="26" fill="#ffffff" />
        <path d="M2 3 L38 13 L2 23 Z" fill="#003087" />
        <path d="M2 3 L20 13 L2 14 Z" fill="#003087" />
        <path d="M2 3 L38 13 L20 13 Z" fill="#cc0000" />
        <path d="M2 14 L20 13 L38 13 L2 23 Z" fill="#003087" />
      </svg>
    );
  }

  if (key === "other") {
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
      <text x="20" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9" fill="#ffffff">{slug.toUpperCase().slice(0, 3)}</text>
    </svg>
  );
}
