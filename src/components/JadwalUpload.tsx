/* Pengingat jadwal upload hari ini untuk tim (berdasarkan tanggal WIB; belum mengecek file yang sudah masuk) */
const B = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"], H = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const tg = (d: Date) => `${d.getUTCDate()} ${B[d.getUTCMonth()]}`;
const add = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const PANDUAN = "https://claude.ai/artifact/KcLiA3FgzVkWbrb6GYuwM2";
const JADWAL_PESANAN = [1, 6, 11, 16, 21, 26, 30];

export function jadwalHariIni(now = new Date()) {
  const t = new Date(now.getTime() + 7 * 36e5); // WIB
  const d = t.getUTCDate(), kmrn = add(t, -1), bl = B[(t.getUTCMonth() + 11) % 12];
  const L: { j: string; isi: string[] }[] = [
    { j: `Harian · data ${tg(kmrn)}`, isi: ["Shopee: Statistik Toko, Performa Produk, Data Keseluruhan Iklan", "TikTok: Analitik toko, Analitik produk, Iklan GMV Max", `Live Shopee & TikTok: 7 hari terakhir (${tg(add(t, -7))}–${tg(kmrn)})`, "Sampel affiliate yang dikirim: tab Affiliate → Input Sampel"] },
  ];
  if (JADWAL_PESANAN.includes(d)) {
    const i = JADWAL_PESANAN.indexOf(d), dari = d === 1 ? null : new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), JADWAL_PESANAN[i - 1]));
    L.push({ j: `Pesanan · ${dari ? `${tg(dari)}–${tg(kmrn)}` : `bulan ${bl}`}`, isi: ["Semua Pesanan Shopee (Order.all) & TikTok (CSV, filter tanggal)", "Pesanan Affiliate TikTok"] });
  }
  if (t.getUTCDay() === 1) L.push({ j: `Mingguan · ${tg(add(t, -8))}–${tg(add(t, -2))}`, isi: ["Performa Affiliate Shopee & TikTok (pilih 7 hari terakhir)"] });
  if (d === 1) L.push({ j: `Bulanan · ${bl}`, isi: ["Statistik toko, produk, iklan, live, pesanan (bulan penuh)", "Penghasilan Shopee & TikTok"] });
  if (d === 3) L.push({ j: `Bulanan affiliate · ${bl}`, isi: ["Performa Affiliate Shopee & TikTok bulan penuh"] });
  if (d >= 10 && d <= 20) L.push({ j: "Validasi tagihan", isi: ["Cek Shopee Affiliate → Validation Bill; jika bulan terbaru sudah terbit, View Reports lalu upload"] });
  return { judul: `${H[t.getUTCDay()]}, ${d} ${B[t.getUTCMonth()]} ${t.getUTCFullYear()}`, L };
}

export default function JadwalUpload() {
  const { judul, L } = jadwalHariIni();
  return (
    <details className="card jadwal-up" open>
      <summary><b>Jadwal upload hari ini</b> <span className="muted small">{judul} · upload sebelum 09:30</span></summary>
      <div className="insg">{L.map((x) => <div className="insc" key={x.j}><h3>{x.j}</h3><ul>{x.isi.map((s) => <li key={s}>{s}</li>)}</ul></div>)}</div>
      <p className="small muted" style={{ margin: "8px 0 0" }}>Semua toko yang kamu pegang. Abaikan yang sudah diupload. <a href={PANDUAN} target="_blank" rel="noreferrer">Buka panduan</a> · <a href="/dashboard/upload">Upload data</a></p>
    </details>
  );
}
