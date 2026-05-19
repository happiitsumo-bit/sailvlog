"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Props {
  questionId: number;
  answerId: number;
  isAccepted: boolean;
}

export default function AcceptButton({ questionId, answerId, isAccepted }: Props) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAccept() {
    setLoading(true);
    try {
      await api.put(`/api/questions/${questionId}/answers/${answerId}/accept`, {});
      router.refresh();
    } catch {
      // 権限なし等は無視
    } finally {
      setLoading(false);
    }
  }

  if (isAccepted) {
    return (
      <div title="Accepted Answer" style={{ color: "var(--sage)", fontSize: "1.5rem", marginTop: "0.4rem" }}>✓</div>
    );
  }

  return (
    <button
      onClick={handleAccept}
      disabled={loading}
      title="ベストアンサーに選ぶ"
      style={{
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: 4,
        color: "var(--fg-mute)",
        fontSize: "1.2rem",
        cursor: "pointer",
        padding: "0.2rem 0.4rem",
        marginTop: "0.4rem",
        lineHeight: 1,
      }}
    >
      ✓
    </button>
  );
}
