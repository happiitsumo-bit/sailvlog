export const NAV_ITEMS = [
  { href: "/",         icon: "⌂", label: "Home" },
  { href: "/feed",     icon: "◈", label: "Feed" },
  { href: "/questions",icon: "?", label: "Q&A" },
  { href: "/learn",    icon: "▶", label: "Learn" },
  { href: "/sailors",  icon: "◉", label: "Sailors" },
] as const;

export const CLASS_ITEMS = [
  { slug: "470",     label: "470",     flag: "/flags/470.png"  },
  { slug: "ilca",    label: "ILCA",    flag: "/flags/ilca.png" },
  { slug: "snipe",   label: "Snipe",   flag: "/flags/snipe.png"},
  { slug: "49er",    label: "49er",    flag: "/flags/49er.jpg" },
  { slug: "420",     label: "420",     flag: "/flags/420.png"  },
  { slug: "op",      label: "OP",      flag: "/flags/op.webp"  },
  { slug: "cruiser", label: "Cruiser", flag: null               },
] as const;
