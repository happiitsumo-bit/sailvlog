import Image from "next/image";

type Props = {
  slug: string;
  className?: string;
};

const FLAG_MAP: Record<string, { src: string; ext: string; label: string }> = {
  "470":     { src: "/flags/470.png",   ext: "png",  label: "470 class" },
  "ilca":    { src: "/flags/ilca.png",  ext: "png",  label: "ILCA class" },
  "snipe":   { src: "/flags/snipe.png", ext: "png",  label: "Snipe class" },
  "49er":    { src: "/flags/49er.jpg",  ext: "jpg",  label: "49er class" },
  "op":      { src: "/flags/op.webp",   ext: "webp", label: "Optimist class" },
  "420":     { src: "/flags/420.png",   ext: "png",  label: "420 class" },
};

export default function ClassFlag({ slug, className }: Props) {
  const key = slug.toLowerCase();
  const flag = FLAG_MAP[key];

  if (flag) {
    return (
      <Image
        src={flag.src}
        alt={flag.label}
        width={40}
        height={26}
        className={`class-flag ${className ?? ""}`.trim()}
        style={{ objectFit: "contain" }}
      />
    );
  }

  // Cruiser: SVGシルエット
  if (key === "cruiser") {
    return (
      <svg
        viewBox="0 0 40 26"
        width={40}
        height={26}
        className={`class-flag ${className ?? ""}`.trim()}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Cruiser class"
      >
        {/* 海 */}
        <rect width="40" height="26" fill="#1a3a5c" />
        {/* 波 */}
        <path d="M0 20 Q5 18 10 20 Q15 22 20 20 Q25 18 30 20 Q35 22 40 20 L40 26 L0 26 Z" fill="#0e2540" />
        {/* 船体 */}
        <path d="M6 20 Q8 22 34 22 Q37 21 36 19 L8 19 Z" fill="#c8a96e" />
        {/* 甲板 */}
        <rect x="9" y="17" width="24" height="2" rx="0.5" fill="#d4b87a" />
        {/* メインマスト */}
        <line x1="18" y1="4" x2="18" y2="18" stroke="#e8dcc8" strokeWidth="1" />
        {/* ミズンマスト */}
        <line x1="26" y1="9" x2="26" y2="18" stroke="#e8dcc8" strokeWidth="0.8" />
        {/* メインセール */}
        <path d="M18 5 L28 13 L18 17 Z" fill="rgba(255,255,255,0.85)" />
        {/* ジブ */}
        <path d="M18 8 L10 16 L18 16 Z" fill="rgba(255,255,255,0.7)" />
        {/* ミズンセール */}
        <path d="M26 10 L32 15 L26 17 Z" fill="rgba(255,255,255,0.65)" />
      </svg>
    );
  }

  // フォールバック: 未知の艇種
  return (
    <svg
      viewBox="0 0 40 26"
      width={40}
      height={26}
      className={`class-flag ${className ?? ""}`.trim()}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`${slug} class flag`}
    >
      <rect width="40" height="26" fill="#5a6378" />
      <text x="20" y="17" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="9" fill="#ffffff">
        {slug.toUpperCase().slice(0, 4)}
      </text>
    </svg>
  );
}
