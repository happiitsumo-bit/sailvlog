import Link from "next/link";
import { timeAgo } from "@/lib/utils";

type FeedTag = "ART" | "Q&A" | "POST" | "TEAM";

interface FeedItem {
  tag: FeedTag;
  text: string;
  meta: string;
  href: string;
  time: string;
}

interface RawArticle  { id: number; title: string; slug: string; createdAt: string; author: { username: string }; teamId?: number | null }
interface RawQuestion { id: number; title: string; createdAt: string; author: { username: string } }
interface RawPost     { id: number; body: string; createdAt: string; author: { username: string } }

const API_URL = process.env.API_URL ?? "http://backend:8000";

async function fetchFeedItems(): Promise<FeedItem[]> {
  const [artRes, qRes, postRes] = await Promise.allSettled([
    fetch(`${API_URL}/api/articles?limit=6`, { cache: "no-store" }),
    fetch(`${API_URL}/api/questions?limit=5`, { cache: "no-store" }),
    fetch(`${API_URL}/api/posts?limit=4`, { cache: "no-store" }),
  ]);

  const items: FeedItem[] = [];

  if (artRes.status === "fulfilled" && artRes.value.ok) {
    const data = await artRes.value.json();
    for (const a of (data.articles ?? []) as RawArticle[]) {
      items.push({
        tag: a.teamId ? "TEAM" : "ART",
        text: a.title,
        meta: `@${a.author.username}`,
        href: `/articles/${a.slug}`,
        time: a.createdAt,
      });
    }
  }
  if (qRes.status === "fulfilled" && qRes.value.ok) {
    const data = await qRes.value.json();
    for (const q of (data.questions ?? []) as RawQuestion[]) {
      items.push({
        tag: "Q&A",
        text: q.title,
        meta: `@${q.author.username}`,
        href: `/questions/${q.id}`,
        time: q.createdAt,
      });
    }
  }
  if (postRes.status === "fulfilled" && postRes.value.ok) {
    const data = await postRes.value.json();
    for (const p of (data.posts ?? []) as RawPost[]) {
      items.push({
        tag: "POST",
        text: p.body.slice(0, 60),
        meta: `@${p.author.username}`,
        href: `/feed`,
        time: p.createdAt,
      });
    }
  }

  return items
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 15);
}

const TAG_CLASS: Record<FeedTag, string> = {
  "ART":  "intel-tag intel-tag-art",
  "Q&A":  "intel-tag intel-tag-qa",
  "POST": "intel-tag intel-tag-post",
  "TEAM": "intel-tag intel-tag-team",
};

export default async function IntelligenceFeed() {
  const items = await fetchFeedItems();

  return (
    <>
      <div className="intel-feed-header">
        <span className="intel-feed-title">Intelligence Feed</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--fg-dim)" }}>
          {items.length} entries
        </span>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--fg-mute)", fontSize: "0.85rem" }}>
          まだ投稿がありません。
        </div>
      ) : (
        <ul className="intel-feed-list">
          {items.map((item, i) => (
            <li key={i}>
              <Link href={item.href} className="intel-feed-item">
                <span className={TAG_CLASS[item.tag]}>{item.tag}</span>
                <span className="intel-feed-text">{item.text}</span>
                <span className="intel-feed-meta">{item.meta} · {timeAgo(item.time)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
