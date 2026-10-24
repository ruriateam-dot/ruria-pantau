"use client";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="auth">
      <form action={action} className="auth-card">
        <h1>Ruria Pantau</h1>
        <p className="muted">Masuk dengan akun tim Ruria.</p>
        <label>
          Email
          <input id="email" name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input id="password" name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && <p className="err" role="alert">{error}</p>}
        <button type="submit" disabled={pending}>{pending ? "Masuk…" : "Masuk"}</button>
      </form>
    </main>
  );
}
