import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { requireUser, isStaff, PERAN_LABEL } from "@/lib/auth";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

/* Log aktivitas semua peran. Hanya superadmin & admin yang bisa membuka. */
export default async function LogPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser();
  if (!isStaff(me)) redirect("/dashboard");
  const sp = await searchParams;
  const where: string[] = [], args: unknown[] = [];
  if (sp.u) { if (sp.u === "tamu") where.push("l.user_id is null"); else { where.push("l.user_id = ?"); args.push(Number(sp.u)); } }
  if (sp.c) { where.push("l.client_id = ?"); args.push(sp.c); }
  if (sp.a) { where.push("l.aksi = ?"); args.push(sp.a); }
  if (sp.d && /^\d{4}-\d{2}-\d{2}$/.test(sp.d)) { where.push("date(l.waktu) = ?"); args.push(sp.d); }
  const rows = await q<{ waktu: string; nama: string; peran: string; aksi: string; klien: string | null; detail: string; ip: string | null }>(
    `select l.waktu, l.nama, l.peran, l.aksi, c.nama klien, l.detail, l.ip from activity_log l left join clients c on c.id = l.client_id
     ${where.length ? "where " + where.join(" and ") : ""} order by l.id desc limit 500`, args);
  const users = await q<{ id: number; nama: string }>("select id, nama from users order by nama");
  const clients = await q<{ id: string; nama: string }>("select id, nama from clients order by nama");
  const aksi = (await q<{ aksi: string }>("select distinct aksi from activity_log order by aksi")).map((x) => x.aksi);
  return <AppShell user={me}>
    <header className="dh"><div className="wrap top ctitle"><h1>Log aktivitas</h1><span className="muted small">Semua peran tercatat · hanya terlihat oleh superadmin & admin</span></div></header>
    <main className="wrap dv tim">
      <form className="card filters" method="get">
        <select name="u" defaultValue={sp.u ?? ""}><option value="">Semua orang</option>{users.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}<option value="tamu">Link klien / tamu</option></select>
        <select name="c" defaultValue={sp.c ?? ""}><option value="">Semua klien</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.nama}</option>)}</select>
        <select name="a" defaultValue={sp.a ?? ""}><option value="">Semua aktivitas</option>{aksi.map((a) => <option key={a}>{a}</option>)}</select>
        <input type="date" name="d" defaultValue={sp.d ?? ""} style={{ width: "auto" }} />
        <button>Terapkan</button>
      </form>
      {(() => {
        const ts = (w: unknown) => { const d = w instanceof Date ? w : new Date(String(w).replace(" ", "T")); return isNaN(+d) ? String(w).slice(0, 19) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`; };
        const HR = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"], BL = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        const tglL = (t: string) => { const d = new Date(t + "T00:00:00"); return `${HR[d.getDay()]}, ${d.getDate()} ${BL[d.getMonth()]} ${d.getFullYear()}`; };
        const D = new Map<string, Map<string, (typeof rows[number] & { t: string })[]>>();
        for (const r of rows) { const t = ts(r.waktu), k = t.slice(0, 10), u = `${r.nama}|${r.peran}`; if (!D.has(k)) D.set(k, new Map()); const m = D.get(k)!; if (!m.has(u)) m.set(u, []); m.get(u)!.push({ ...r, t }); }
        if (!rows.length) return <div className="card"><p className="muted">Belum ada aktivitas untuk filter ini.</p></div>;
        return <>{[...D].map(([tgl, U]) => <section className="card" key={tgl}>
          <h2>{tglL(tgl)} <span className="muted small">{[...U.values()].reduce((a, x) => a + x.length, 0)} aktivitas · {U.size} orang</span></h2>
          {[...U].sort((a, b) => b[1].length - a[1].length).map(([u, L]) => { const [nama, peran] = u.split("|"); const cnt = new Map<string, number>(); L.forEach((x) => cnt.set(x.aksi, (cnt.get(x.aksi) ?? 0) + 1));
            return <details key={u} className="logu">
              <summary><b>{nama}</b> <span className="muted small">{PERAN_LABEL[peran] ?? peran}</span> · {L.length} aktivitas · <span className="small">{L[L.length - 1].t.slice(11, 16)}–{L[0].t.slice(11, 16)}</span>
                <div className="muted small">{[...cnt].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${v}×`).join(" · ")}</div></summary>
              <div className="tbl"><table><thead><tr><th>Jam</th><th>Aktivitas</th><th>Klien</th><th>Detail</th><th>IP</th></tr></thead>
                <tbody>{L.map((r, i) => <tr key={i}><td>{r.t.slice(11, 19)}</td><td>{r.aksi}</td><td>{r.klien ?? "–"}</td><td className="wrapcell">{r.detail}</td><td className="muted small">{r.ip ?? ""}</td></tr>)}</tbody></table></div>
            </details>; })}
        </section>)}<p className="muted small">Menampilkan 500 aktivitas terbaru.</p></>;
      })()}
    </main>
  </AppShell>;
}
