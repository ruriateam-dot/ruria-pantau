import { createClient } from "@/lib/supabase/server";
import { logout } from "../login/actions";

export default async function Dashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("nama, peran").eq("id", user!.id).single();
  const { data: clients } = await supabase.from("clients").select("id, nama, modul").order("nama");
  return (
    <main className="wrap">
      <header className="top">
        <b>Ruria Pantau</b>
        <span className="muted">{profile?.nama} · {profile?.peran}</span>
        <form action={logout}><button type="submit">Keluar</button></form>
      </header>
      <h2>Klien</h2>
      <ul>
        {(clients ?? []).map((c) => (
          <li key={c.id}>{c.nama} <span className="muted">({c.modul.join(", ")})</span></li>
        ))}
      </ul>
    </main>
  );
}
