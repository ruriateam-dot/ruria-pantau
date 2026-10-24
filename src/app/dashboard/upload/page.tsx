import AppShell from "@/components/AppShell";
import { requireUser, allowedClients } from "@/lib/auth";
import { q } from "@/lib/db";
import Uploader from "./Uploader";
import { recentUploads } from "./actions";

export const dynamic = "force-dynamic";

const PANDUAN: [string, string, string][] = [
  ["Analisa Toko · Shopee", "Statistik toko (file …shopee-shop-stats…xlsx)", "Seller Centre → Data → Ringkasan Toko → Ekspor. GMV memakai \"Pesanan Siap Dikirim\"."],
  ["Analisa Toko · TikTok", "Key metrics / Overview Business Performance (xlsx)", "Seller Center → Analitik → Ringkasan → Ekspor data harian."],
  ["Analisa Produk", "Ekspor pesanan (Shopee Order.all…xlsx, TikTok Semua pesanan…csv)", "Pesanan Saya → Ekspor. Pesanan batal tidak dihitung."],
  ["Analisa Iklan · Shopee", "Data Keseluruhan Iklan (csv)", "Iklan Shopee → Laporan → Unduh semua iklan untuk satu periode."],
  ["Analisa Iklan · TikTok", "Campaign overview data (xlsx, per hari)", "Iklan GMV Max → Ekspor ringkasan kampanye per hari."],
  ["Livestream", "Laporan live (format Draft Livestream atau laporan host)", "Satu file bisa berisi Shopee dan TikTok; sesi yang bersamaan digabung otomatis."],
];

export default async function UploadPage() {
  const u = await requireUser();
  const ok = await allowedClients(u);
  const clients = ok.length ? await q<{ id: string; nama: string }>("select id, nama from clients where id in (?) order by nama", [ok]) : [];
  const stores = ok.length ? await q<{ id: string; client_id: string; brand: string; platform: string }>("select id, client_id, brand, platform from stores where client_id in (?) and platform <> 'CPAS' order by brand, platform", [ok]) : [];
  const recent = await recentUploads();
  return <AppShell user={u}>
    <header className="dh"><div className="wrap top ctitle"><h1>Upload data</h1></div></header>
    <main className="wrap dv tim">
      <p className="muted">Pilih klien dan toko, lalu masukkan file dari Seller Centre. Jenis file dikenali otomatis. Data di tanggal yang sama akan diperbarui, bukan dobel.</p>
      <Uploader clients={clients} stores={stores} />
      <div className="card"><h2>File yang dibutuhkan per tab</h2>
        <div className="tw"><table><thead><tr><th>Tab</th><th>File</th><th>Cara ambil</th></tr></thead>
          <tbody>{PANDUAN.map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td className="muted">{r[2]}</td></tr>)}</tbody></table></div>
        <p className="muted small">Agar status &quot;Aman&quot;, unggah data sampai kemarin (H-1) setiap hari.</p>
      </div>
      <div className="card"><h2>Riwayat upload terbaru</h2>
        {recent.length ? <div className="tw"><table><thead><tr><th>Waktu</th><th>Klien</th><th>Jenis</th><th>File</th><th>Periode</th><th>Oleh</th></tr></thead>
          <tbody>{recent.map((r, i) => <tr key={i}><td>{String(r.waktu).slice(0, 16)}</td><td>{r.klien}</td><td>{r.jenis}</td><td className="muted">{r.nama_file}</td><td>{r.dari ? `${r.dari} – ${r.sampai}` : "–"}</td><td>{r.oleh ?? "–"}</td></tr>)}</tbody></table></div>
          : <p className="muted">Belum ada upload.</p>}
      </div>
    </main>
  </AppShell>;
}
