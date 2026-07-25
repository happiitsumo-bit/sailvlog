"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { saveAuth } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post<{ token: string; user: { id: number; username: string; email: string } }>(
        "/api/auth/register",
        form
      );
      saveAuth(res.token, res.user);
      router.push("/sessions");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-page">
      <h1 className="form-title">⛵ 新規登録</h1>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="register-username">ユーザー名</label>
          <input id="register-username" name="username" value={form.username} onChange={onChange} required minLength={3} maxLength={50} />
        </div>
        <div className="form-group">
          <label htmlFor="register-email">メールアドレス</label>
          <input id="register-email" type="email" name="email" value={form.email} onChange={onChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="register-password">パスワード</label>
          <input id="register-password" type="password" name="password" value={form.password} onChange={onChange} required minLength={8} />
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn-primary form-submit" disabled={loading}>
          {loading ? "登録中..." : "アカウントを作成"}
        </button>
      </form>
      <p className="form-divider"><span>または</span></p>
      <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-muted)" }}>
        既にアカウントをお持ちの方は <Link href="/login" className="form-link">ログイン</Link>
      </p>
    </div>
  );
}
