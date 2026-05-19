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

  // フォールバック: 画像がない艇種はSVGテキスト
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
