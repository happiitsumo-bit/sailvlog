"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: { id: number; username: string; email: string } }>(
        "/api/auth/login",
        { email, password }
      );
      saveAuth(res.token, res.user);
      router.push("/sessions");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-page">
      <h1 className="form-title">⛵ ログイン</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="login-email">メールアドレス</label>
          <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="login-password">パスワード</label>
          <input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary form-submit" disabled={loading}>
          {loading ? "ログイン中..." : "ログイン"}
        </button>
      </form>
      <p className="form-divider"><span>または</span></p>
      <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-muted)" }}>
        アカウントをお持ちでない方は <Link href="/register" className="form-link">新規登録</Link>
      </p>
    </div>
  );
}
