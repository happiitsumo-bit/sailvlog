"use client";

import { useEffect, useId, useState } from "react";
import { api } from "@/lib/api";
import { Annotation } from "@/types";
import { formatClockTime } from "@/lib/utils";
import { isSummaryValid, LEARNING_SUMMARY_MAX } from "@/lib/publish";

// UI-DESIGN §5.2 公開昇格ダイアログ。SPEC-share1-phase1.md §3.1 F-1〜F-3の入力3点
// （学びの要約・注釈選別・公開範囲）をここに集約する。§7の必須修正10項目を満たす:
// label関連付け(#5)・role="status"にあたるアラート箇所はrole="alert"で即時通知(#6)・
// alert()/prompt()不使用(#6)・checkbox/radioのタップ対象は<label>全体をクリック可能にして
// 実質のヒット領域を24px以上確保(#7)。

export interface PublishResult {
  publicSlug: string;
  publicUrl: string;
  visibility: "unlisted" | "public";
  publishedAt: string;
}

interface PublishDialogProps {
  sessionId: string;
  annotations: Annotation[];
  onClose: () => void;
  onPublished: (result: PublishResult) => void;
}

export function PublishDialog({ sessionId, annotations, onClose, onPublished }: PublishDialogProps) {
  const headingId = useId();
  const summaryId = useId();
  const visibilityGroupName = useId();

  // 注釈チェックは既定で全オフ（UI-DESIGN §5.2「一括公開は事故の入口になるため、
  // 1件ずつ選ばせる摩擦を意図的に残す」）。「全選択」ボタンは置かない。
  const [summary, setSummary] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [visibility, setVisibility] = useState<"unlisted" | "public">("unlisted");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function toggleAnnotation(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const summaryLen = summary.trim().length;
  const summaryEmpty = summaryLen === 0;
  const summaryTooLong = summaryLen > LEARNING_SUMMARY_MAX;
  const canSubmit = isSummaryValid(summary) && !submitting;

  async function handleSubmit() {
    if (!isSummaryValid(summary) || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.post<PublishResult>(`/api/sessions/${sessionId}/publish`, {
        visibility,
        learningSummary: summary.trim(),
        publicAnnotationIds: [...selectedIds],
      });
      onPublished(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "公開に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={headingId} className="dialog-title">このセッションを公開する</h2>

        <div className="form-group">
          <label htmlFor={summaryId}>
            学びの要約（必須）
            <span className="dialog-char-count" aria-hidden="true">
              {" "}{summaryLen}/{LEARNING_SUMMARY_MAX}
            </span>
          </label>
          <textarea
            id={summaryId}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="この練習で何が分かったか。部外の人が最初に読む本文です"
            rows={4}
            aria-describedby={`${summaryId}-hint`}
          />
          <p id={`${summaryId}-hint`} className="dialog-hint">部外の人が最初に読む文章です</p>
          {(summaryEmpty || summaryTooLong) && (
            <p className="form-error" role="alert">
              {summaryEmpty
                ? "学びの要約は必須です"
                : `学びの要約は${LEARNING_SUMMARY_MAX}字以内にしてください（現在${summaryLen}字）`}
            </p>
          )}
        </div>

        <fieldset className="dialog-fieldset">
          <legend>公開するメモを選ぶ</legend>
          <p className="dialog-hint dialog-warning">
            反省会のメモは既定で非公開です。選んだものだけが外から見えます。
          </p>
          {annotations.length === 0 ? (
            <p className="dialog-hint">このセッションにはまだメモがありません。</p>
          ) : (
            <ul className="dialog-annotation-list">
              {annotations.map((a) => {
                const checkboxId = `${summaryId}-ann-${a.id}`;
                return (
                  <li key={a.id} className="dialog-annotation-item">
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={selectedIds.has(a.id)}
                      onChange={() => toggleAnnotation(a.id)}
                    />
                    <label htmlFor={checkboxId}>
                      {formatClockTime(a.tSec)} — {a.body}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <fieldset className="dialog-fieldset">
          <legend>だれが見られるか</legend>
          <label className="dialog-radio-item" htmlFor={`${visibilityGroupName}-unlisted`}>
            <input
              id={`${visibilityGroupName}-unlisted`}
              type="radio"
              name={visibilityGroupName}
              checked={visibility === "unlisted"}
              onChange={() => setVisibility("unlisted")}
            />
            リンクを知っている人だけ（URLを知る人は誰でも見られます・検索には出ません）
          </label>
          <label className="dialog-radio-item" htmlFor={`${visibilityGroupName}-public`}>
            <input
              id={`${visibilityGroupName}-public`}
              type="radio"
              name={visibilityGroupName}
              checked={visibility === "public"}
              onChange={() => setVisibility("public")}
            />
            だれでも（検索にも出ます）
          </label>
        </fieldset>

        <p className="dialog-hint dialog-warning">
          航跡の先頭・末尾に陸上の移動（自宅周辺など）が含まれていないか確認してください
        </p>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            キャンセル
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit}>
            {submitting ? "公開しています…" : "公開する"}
          </button>
        </div>
      </div>
    </div>
  );
}
