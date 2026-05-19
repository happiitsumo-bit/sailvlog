"use client";

import { useEffect, useState } from "react";
import { getUser } from "@/lib/auth";
import AcceptButton from "./AcceptButton";

interface Props {
  questionAuthorId: number;
  questionId: number;
  answerId: number;
  isAccepted: boolean;
}

export default function AcceptGate({ questionAuthorId, questionId, answerId, isAccepted }: Props) {
  const [isAuthor, setIsAuthor] = useState(false);

  useEffect(() => {
    const user = getUser();
    setIsAuthor(user?.id === questionAuthorId);
  }, [questionAuthorId]);

  if (isAccepted) {
    return (
      <div title="Accepted Answer" style={{ color: "var(--sage)", fontSize: "1.5rem", marginTop: "0.4rem" }}>✓</div>
    );
  }

  if (!isAuthor) return null;

  return (
    <AcceptButton questionId={questionId} answerId={answerId} isAccepted={false} />
  );
}
