export function SkeletonArticleCard() {
  return (
    <div className="article-card skeleton-card" aria-hidden="true">
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.85rem" }}>
        <div className="skeleton-box" style={{ width: 60, height: 22, borderRadius: 6 }} />
        <div className="skeleton-box" style={{ width: 80, height: 22, borderRadius: 6, marginLeft: "auto" }} />
      </div>
      <div className="skeleton-box" style={{ height: 22, borderRadius: 6, marginBottom: "0.5rem" }} />
      <div className="skeleton-box" style={{ height: 22, borderRadius: 6, width: "70%", marginBottom: "1rem" }} />
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <div className="skeleton-box" style={{ width: 48, height: 20, borderRadius: 12 }} />
        <div className="skeleton-box" style={{ width: 60, height: 20, borderRadius: 12 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div className="skeleton-box" style={{ width: 100, height: 18, borderRadius: 6 }} />
        <div className="skeleton-box" style={{ width: 80, height: 18, borderRadius: 6 }} />
      </div>
    </div>
  );
}

export function SkeletonPostCard() {
  return (
    <div className="post-card skeleton-card" aria-hidden="true">
      <div className="skeleton-box" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton-box" style={{ width: 120, height: 16, borderRadius: 6, marginBottom: "0.5rem" }} />
        <div className="skeleton-box" style={{ height: 16, borderRadius: 6, marginBottom: "0.35rem" }} />
        <div className="skeleton-box" style={{ height: 16, borderRadius: 6, width: "60%" }} />
      </div>
    </div>
  );
}

export function SkeletonQuestionCard() {
  return (
    <div className="question-card skeleton-card" style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "1.25rem" }} aria-hidden="true">
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <div className="skeleton-box" style={{ height: 32, borderRadius: 6 }} />
        <div className="skeleton-box" style={{ height: 32, borderRadius: 6 }} />
      </div>
      <div>
        <div className="skeleton-box" style={{ height: 20, borderRadius: 6, marginBottom: "0.5rem" }} />
        <div className="skeleton-box" style={{ height: 16, borderRadius: 6, width: "80%", marginBottom: "0.5rem" }} />
        <div className="skeleton-box" style={{ height: 16, borderRadius: 6, width: "50%" }} />
      </div>
    </div>
  );
}
