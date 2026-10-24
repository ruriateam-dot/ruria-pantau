import { hasUsers } from "@/lib/auth";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let setup = false, err = "";
  try {
    if (await getUser()) redirect("/dashboard");
    setup = !(await hasUsers());
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    err = "Database belum tersambung. Periksa pengaturan DB_HOST, DB_NAME, DB_USER, DB_PASSWORD di Hostinger.";
  }
  if (err) return <main className="auth"><div className="auth-card"><h1>Ruria Pantau</h1><p className="err">{err}</p></div></main>;
  return <LoginForm setup={setup} />;
}
