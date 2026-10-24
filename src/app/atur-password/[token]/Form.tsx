"use client";
import { useActionState } from "react";
import { setPassword } from "./actions";

export default function Form({ token, nama, email }: { token: string; nama: string; email: string }) {
  const [err, action, pending] = useActionState(setPassword, null);
  return <form action={action} className="auth-card">
    <h1>Ruria Pantau</h1>
    <p className="muted">Halo {nama}, buat password untuk akun <b>{email}</b>.</p>
    <input type="hidden" name="token" value={token} />
    <input type="email" name="username" value={email} autoComplete="username" readOnly hidden />
    <label>Password baru<input name="password" type="password" minLength={10} required autoComplete="new-password" /></label>
    <label>Ulangi password<input name="password2" type="password" minLength={10} required autoComplete="new-password" /></label>
    <p className="muted small">Minimal 10 karakter. Gabungan beberapa kata mudah diingat, mis. kopi-pagi-senin.</p>
    {err && <p className="err" role="alert">{err}</p>}
    <button disabled={pending}>{pending ? "Menyimpan…" : "Simpan & masuk"}</button>
  </form>;
}
