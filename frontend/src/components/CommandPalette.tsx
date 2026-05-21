"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCommandPalette } from "./CommandPaletteProvider";
import { REFERENCES, CATEGORY_LABEL, LEVEL_LABEL } from "@/lib/mock-references";

type ResultType = "reference" | "article" | "question" | "user" | "team";

interface SearchResult {
  type: ResultType;
  id: string | number;
  title: string;
  sub: string;
  href: string;
}

interface Section {
  type: ResultType;
  label: string;
  icon: string;
  items: SearchResult[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function searchAPI(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const [artRes, qRes, userRes, teamRes] = await Promise.allSettled([
    fetch(`${API_URL}/api/articles?search=${encodeURIComponent(query)}&limit=3`),
    fetch(`${API_URL}/api/questions?search=${encodeURIComponent(query)}&limit=3`),
    fetch(`${API_URL}/api/users?search=${encodeURIComponent(query)}&limit=2`),
    fetch(`${API_URL}/api/teams?search=${encodeURIComponent(query)}&limit=3`),
  ]);

  const results: SearchResult[] = [];

  if (artRes.status === "fulfilled" && artRes.value.ok) {
    const data = await artRes.value.json();
    for (const a of data.articles ?? []) {
      results.push({ type: "article", id: a.id, title: a.title, sub: `@${a.author?.username ?? ""}`, href: `/articles/${a.slug ?? a.id}` });
    }
  }
  if (qRes.status === "fulfilled" && qRes.value.ok) {
    const data = await qRes.value.json();
    for (const q of data.questions ?? []) {
      results.push({ type: "question", id: q.id, title: q.title, sub: `${q._count?.answers ?? 0} answers`, href: `/questions/${q.id}` });
    }
  }
  if (userRes.status === "fulfilled" && userRes.value.ok) {
    const data = await userRes.value.json();
    for (const u of data.users ?? []) {
      results.push({ type: "user", id: u.id, title: u.username, sub: u.bio ?? "", href: `/users/${u.username}` });
    }
  }
  if (teamRes.status === "fulfilled" && teamRes.value.ok) {
    const data = await teamRes.value.json();
    for (const t of data.teams ?? []) {
      results.push({ type: "team", id: t.id, title: t.name, sub: `${t.university ?? t.category} · ${t._count?.members ?? 0} members`, href: `/teams/${t.slug}` });
    }
  }

  return results;
}

const SECTION_META: Record<ResultType, { label: string; icon: string }> = {
  reference: { label: "Reference", icon: "◇" },
  article:   { label: "Articles",  icon: "▲" },
  question:  { label: "Q&A",       icon: "?" },
  user:      { label: "Sailors",   icon: "◉" },
  team:      { label: "Teams",     icon: "◈" },
};

const SECTION_ORDER: ResultType[] = ["team", "reference", "article", "question", "user"];

export default function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);

  // Referenceはローカル検索（API不要・即時）
  const localRefResults = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return REFERENCES
      .filter((r) =>
        r.title.toLowerCase().includes(q) ||
        (r.titleEn ?? "").toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map((r) => ({
        type: "reference" as const,
        id: r.slug,
        title: r.title,
        sub: `${CATEGORY_LABEL[r.category]}・${LEVEL_LABEL[r.level]}`,
        href: `/reference/${r.slug}`,
      }));
  }, [query]);

  // APIへのデバウンス検索
  useEffect(() => {
    if (!query.trim()) {
      setApiResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const r = await searchAPI(query);
      setApiResults(r);
      setLoading(false);
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  // セクション別に整理（Reference → Articles → Q&A → Sailors）
  const sections = useMemo<Section[]>(() => {
    const all = [...localRefResults, ...apiResults];
    const grouped: Partial<Record<ResultType, SearchResult[]>> = {};
    for (const r of all) {
      if (!grouped[r.type]) grouped[r.type] = [];
      grouped[r.type]!.push(r);
    }
    return SECTION_ORDER
      .filter((t) => grouped[t]?.length)
      .map((t) => ({
        type: t,
        label: SECTION_META[t].label,
        icon: SECTION_META[t].icon,
        items: grouped[t]!,
      }));
  }, [localRefResults, apiResults]);

  // カーソル操作用にフラットなリストも持つ
  const flatItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setApiResults([]);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  useEffect(() => { setCursor(0); }, [flatItems.length]);

  function navigate(href: string) {
    close();
    router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && flatItems[cursor]) {
      navigate(flatItems[cursor].href);
    }
  }

  const hasResults = flatItems.length > 0;
  const showEmpty = !loading && query.trim() && !hasResults;

  if (!isOpen) return null;

  // セクション内でのフラットインデックスを計算するヘルパー
  let globalIdx = 0;

  return (
    <div className="cmd-overlay" onClick={close} aria-modal="true" role="dialog" aria-label="コマンドパレット">
      <div className="cmd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-search-row">
          <span className="cmd-search-icon" aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            className="cmd-input"
            type="text"
            placeholder="記事・Reference・質問を検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cmd-esc-hint" onClick={close}>Esc</kbd>
        </div>

        {(hasResults || loading || query.trim()) && (
          <div className="cmd-results">
            {loading && !hasResults && (
              <div className="cmd-status">検索中...</div>
            )}
            {showEmpty && (
              <div className="cmd-status">「{query}」に一致する結果がありません</div>
            )}
            {hasResults && (
              <div role="listbox">
                {sections.map((section) => (
                  <div key={section.type} className="cmd-section">
                    <div className="cmd-section-header">
                      <span className="cmd-section-icon">{section.icon}</span>
                      {section.label}
                    </div>
                    <ul className="cmd-list">
                      {section.items.map((item) => {
                        const idx = globalIdx++;
                        return (
                          <li
                            key={`${item.type}-${item.id}`}
                            className={`cmd-item ${idx === cursor ? "active" : ""}`}
                            role="option"
                            aria-selected={idx === cursor}
                            onMouseEnter={() => setCursor(idx)}
                            onClick={() => navigate(item.href)}
                          >
                            <span className="cmd-item-body">
                              <span className="cmd-item-title">{item.title}</span>
                              <span className="cmd-item-sub">{item.sub}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="cmd-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> 移動</span>
          <span><kbd>Enter</kbd> 開く</span>
          <span><kbd>Esc</kbd> 閉じる</span>
        </div>
      </div>
    </div>
  );
}
