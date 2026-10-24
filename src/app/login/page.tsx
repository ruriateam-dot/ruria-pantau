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
    const x = e as { code?: string; message?: string };
    console.error("DB error", x.code, x.message);
    const why: Record<string, string> = {
      ER_ACCESS_DENIED_ERROR: "user atau password database ditolak. Cek DB_USER dan DB_PASSWORD (tanpa spasi di awal/akhir).",
      ER_BAD_DB_ERROR: "nama database tidak ditemukan. Cek DB_NAME.",
      ER_DBACCESS_DENIED_ERROR: "user tidak punya akses ke database ini. Cek DB_NAME dan DB_USER berpasangan.",
      ECONNREFUSED: "server database menolak sambungan. Cek DB_HOST dan DB_PORT.",
      ENOTFOUND: "alamat DB_HOST tidak dikenal.",
      ETIMEDOUT: "sambungan ke database habis waktu. Cek DB_HOST.",
    };
    const set = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"].filter((k) => !process.env[k]);
    err = "Database belum tersambung: " + (set.length ? `variabel ${set.join(", ")} belum terbaca. Simpan di Variabel environment lalu terapkan ulang.` : why[x.code ?? ""] ?? `${x.code ?? ""} ${x.message ?? ""}`.trim());
  }
  if (err) return <main className="auth"><div className="auth-card"><h1>Ruria Report</h1><p className="err">{err}</p></div></main>;
  return <LoginForm setup={setup} />;
}
