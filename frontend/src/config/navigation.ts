export const NAV_ITEMS = [
  { href: "/",         icon: "⌂", label: "Home" },
  { href: "/feed",     icon: "◈", label: "Feed" },
  { href: "/questions",icon: "?", label: "Q&A" },
  { href: "/learn",    icon: "▶", label: "Learn" },
  { href: "/sailors",  icon: "◉", label: "Sailors" },
] as const;

// ILCAはOlympic Laser の新名称。ホーム等での表示はレース志向クラスとして省略。
export const CLASS_ITEMS = [
  { slug: "op",      label: "OP",      flag: "/flags/op.webp"  },
  { slug: "420",     label: "420",     flag: "/flags/420.png"  },
  { slug: "470",     label: "470",     flag: "/flags/470.png"  },
  { slug: "snipe",   label: "Snipe",   flag: "/flags/snipe.png"},
  { slug: "49er",    label: "49er",    flag: "/flags/49er.jpg" },
  { slug: "cruiser", label: "Cruiser", flag: null               },
] as const;
