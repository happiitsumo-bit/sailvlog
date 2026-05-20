"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useCommandPalette } from "./CommandPaletteProvider";

interface SearchResult {
  type: "article" | "question" | "user";
  id: string | number;
  title: string;
  sub: string;
  href: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function search(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const [artRes, qRes, userRes] = await Promise.allSettled([
    fetch(`${API_URL}/api/articles?search=${encodeURIComponent(query)}&limit=4`),
    fetch(`${API_URL}/api/questions?search=${encodeURIComponent(query)}&limit=4`),
    fetch(`${API_URL}/api/users?search=${encodeURIComponent(query)}&limit=3`),
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

  return results;
}

const TYPE_ICON: Record<SearchResult["type"], string> = {
  article: "▲",
  question: "?",
  user: "◉",
};

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  article: "Article",
  question: "Q&A",
  user: "Sailor",
};

export default function CommandPalette() {
  const { isOpen, close } = useCommandPalette();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      const r = await search(query);
      setResults(r);
      setCursor(0);
      setLoading(false);
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  function navigate(href: string) {
    close();
    router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && results[cursor]) {
      navigate(results[cursor].href);
    }
  }

  useEffect(() => {
    const item = listRef.current?.children[cursor] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!isOpen) return null;

  return (
    <div className="cmd-overlay" onClick={close} aria-modal="true" role="dialog" aria-label="コマンドパレット">
      <div className="cmd-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-search-row">
          <span className="cmd-search-icon" aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            className="cmd-input"
            type="text"
            placeholder="記事・質問・セーラーを検索..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="cmd-esc-hint" onClick={close}>Esc</kbd>
        </div>

        {(results.length > 0 || loading || query.trim()) && (
          <div className="cmd-results">
            {loading && (
              <div className="cmd-status">検索中...</div>
            )}
            {!loading && query.trim() && results.length === 0 && (
              <div className="cmd-status">「{query}」に一致する結果がありません</div>
            )}
            {!loading && results.length > 0 && (
              <ul ref={listRef} className="cmd-list" role="listbox">
                {results.map((r, i) => (
                  <li
                    key={`${r.type}-${r.id}`}
                    className={`cmd-item ${i === cursor ? "active" : ""}`}
                    role="option"
                    aria-selected={i === cursor}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => navigate(r.href)}
                  >
                    <span className="cmd-item-icon" aria-hidden="true">{TYPE_ICON[r.type]}</span>
                    <span className="cmd-item-body">
                      <span className="cmd-item-title">{r.title}</span>
                      <span className="cmd-item-sub">{r.sub}</span>
                    </span>
                    <span className="cmd-item-type">{TYPE_LABEL[r.type]}</span>
                  </li>
                ))}
              </ul>
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
