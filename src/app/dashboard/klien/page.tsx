import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { requireUser, isStaff } from "@/lib/auth";
import { q } from "@/lib/db";
import { logAct } from "@/lib/log";
import { ClientForm, AddStore, StoreRow } from "./Forms";
import { Links } from "../tim/Forms";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

export default async function KlienPage() {
  const me = await requireUser();
  if (me.peran !== "superadmin" || !isStaff(me)) redirect("/dashboard");
  const clients = (await q<{ id: string; nama: string; modul: string; target_roas: number | null; stok_selalu_ada: number; tab_klien: string | null; lap_temuan: string | null; lap_langkah: string | null }>("select id, nama, modul, target_roas, stok_selalu_ada, tab_klien, lap_temuan, lap_langkah from clients order by nama")).map((c) => ({ ...c, modul: c.modul.split(",") }));
  const stores = await q<{ id: string; client_id: string; brand: string; platform: string; akun: string | null; n: number }>(
    "select s.id, s.client_id, s.brand, s.platform, s.akun, (select count(*) from daily_sales d where d.store_id = s.id) + (select count(*) from ads a where a.store_id = s.id) n from stores s order by s.brand, s.platform");
  const links = await q<{ token: string; client_id: string; label: string | null; dibuat: string }>("select token, client_id, label, dibuat from share_links where aktif = 1 order by dibuat desc");
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  await logAct(me, "lihat", null, "Kelola klien");
  return <AppShell user={me}>
    <header className="dh"><div className="wrap top ctitle"><h1>Kelola klien</h1><span className="muted small">Klien, modul, target ROAS, dan toko</span></div></header>
    <main className="wrap dv tim">
      <details className="card"><summary><b>+ Tambah klien baru</b></summary><ClientForm /></details>
      {clients.map((c) => { const st = stores.filter((s) => s.client_id === c.id);
        return <details key={c.id} className="card kcard">
          <summary><b>{c.nama}</b> <span className="muted small">{c.modul.join(" · ")}{c.target_roas ? ` · target ROAS ${c.target_roas}` : ""} · {st.length} toko</span></summary>
          <h3 className="ksec">1 · Info, modul &amp; tab klien</h3>
          <ClientForm c={c} />
          <h3 className="ksec">2 · Toko</h3>
          {st.length ? <div className="tw"><table><thead><tr><th>Nama toko · akun</th><th>Platform</th><th className="n">Baris data</th><th></th></tr></thead>
            <tbody>{st.map((s) => <StoreRow key={s.id} s={s} />)}</tbody></table></div> : <p className="muted small">Belum ada toko.</p>}
          <AddStore client={c.id} />
          <p className="muted small">Akun = username Shopee (mis. pepico.id). Dipakai untuk mencegah file toko lain terunggah ke toko ini. Toko yang sudah punya data tidak bisa dihapus.</p>
          <h3 className="ksec">3 · Link klien (tanpa login)</h3>
          <Links clients={[{ id: c.id, nama: c.nama }]} links={links.filter((l) => l.client_id === c.id)} origin={origin} />
        </details>; })}
    </main>
  </AppShell>;
}
