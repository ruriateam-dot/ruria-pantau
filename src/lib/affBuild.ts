import "server-only";
import { q, exec } from "./db";

/* ===================================================================================
   Data affiliate dari 4 file upload → prioritas P1–P5 (aturan sama untuk semua klien & platform)
   TikTok : export pesanan affiliate (per pesanan) + Transaction Analysis kreator (video/LIVE/sampel per bulan)
   Shopee : laporan validasi komisi (per pesanan) + AMS Affiliate Performance (pembeli baru)
   Rentang 30/60/90 hari dihitung mundur dari KEMARIN (termasuk kemarin).
   P1: GMV bersih 30 hari > Rp3 jt · P2: GMV bersih 90 hari > Rp1 jt · P3: GMV bersih 90 hari ≤ Rp1 jt
   P4: tidak ada penjualan 60 hari, atau sampel di bawah ambang (JF 10×, lainnya 5×) · P5: GMV bersih 0 / akun platform
   =================================================================================== */

type Row = (string | number)[];
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const TIP = ["Video", "LIVE", "Showcase", "Trafik eksternal", "Belum ada penjualan", "Shopee Video", "Shopee Live", "Website", "Instagram", "Facebook", "Google", "WhatsApp", "YouTube", "X/Twitter", "ShopBack", "TikTok", "Lainnya", "Sumber tidak tercatat", "Agency/Platform"];
const TIP_ARTI: Record<string, string> = {
  Video: "TikTok: penjualan terbesar dari video kreator", LIVE: "TikTok: penjualan terbesar dari LIVE kreator", Showcase: "TikTok: penjualan terbesar dari showcase / kartu produk",
  "Trafik eksternal": "TikTok: penjualan terbesar dari Program Trafik Eksternal (link dari luar TikTok)", "Belum ada penjualan": "Sudah dapat sampel tapi belum ada penjualan",
  "Shopee Video": "Shopee: penjualan terbesar dari Shopee Video", "Shopee Live": "Shopee: penjualan terbesar dari Shopee Live", Website: "Shopee: penjualan terbesar dari link website",
  Instagram: "Shopee: dari Instagram", Facebook: "Shopee: dari Facebook", Google: "Shopee: dari Google Search", WhatsApp: "Shopee: dari WhatsApp", YouTube: "Shopee: dari YouTube",
  "X/Twitter": "Shopee: dari X/Twitter", ShopBack: "Shopee: dari aplikasi ShopBack", TikTok: "Shopee: dari TikTok", Lainnya: "Shopee: sumber lain", "Sumber tidak tercatat": "Kanal tidak tersedia di data",
  "Agency/Platform": "Akun platform, jaringan iklan atau agency (bukan kreator perorangan): evaluasi di level kerja sama",
};
const KONTEN: Record<string, number> = { Video: 0, "Siaran LIVE": 1, LIVE: 1, Showcase: 2, "Program Trafik Eksternal": 3 };
const KANAL: Record<string, number> = { "Shopeevideo-Shopee": 5, "Shopeelive-Shopee": 6, Websites: 7, Instagram: 8, Threads: 8, Facebook: 9, "Google Search": 10, WhatsApp: 11, YouTube: 12, Twitter: 13, ShopbackApp: 14, TikTok: 15 };
const NETS = new Set(["shpmedianetwork.id", "opear.adx", "more.valuable", "shopbackid_", "youtube_shopping_id", "interspaceindonesia", "involveasia_id", "globalpoinindonesia", "growhub.id", "interspaceindonesia2", "involveasiakol_id", "involve_id", "incashback.store", "involveasiapartner", "adspronesia", "kartik14534", "flatadsth419", "flatadsid", "xtend1234", "flip.deals", "platformrevinc", "cognioid", "baiduid", "prometheues", "influxtec_id", "influxtec_id_2", "ecomobiidkol", "bridgepulse_idnew", "shopee_id"]);
const AGACC = new Set(["fionda_1", "fionda_2", "putratiktech", "velanja.disini", "peekaboostore", "donaldjeremy", "ruangkerjanih"]); // akun milik agency Tiktech
const TTPF = /ifly|involveasia|appsmoon|shopback|^quk_id$|cleverads|scalex|bidnex|deeplkfc|deepleaper|thebestinflux|midder|taurusx|_dsp$|mediatama\.team/;
const AKS = [
  "P1: GMV bersih 30 hari terakhir > Rp3 jt, tawarkan komisi lebih tinggi / Target Collaboration",
  "P2: GMV bersih 90 hari terakhir > Rp1 jt, kirim produk + minta video baru",
  "P3: GMV bersih 90 hari terakhir ≤ Rp1 jt, undang ke campaign affiliate massal",
  "P4: tidak ada penjualan 60 hari terakhir, tahan dulu, cukup undang lewat campaign massal",
  "P4: sampel belum efektif (GMV sebelum + sesudah ÷ (HPP + ongkir) di bawah ambang), stop kirim sampel",
  "P5: GMV bersih 0, tidak perlu dihubungi",
  "P5: akun platform/jaringan, evaluasi di tab Agency/Jaringan",
];

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const addD = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
const kemarin = () => addD(new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10), -1);

/* Data perkiraan dari rekap bulanan lama (order_id "hist-…") diganti data asli begitu file asli untuk rentang tanggal itu di-upload */
async function clearHist(storeId: string, ds: string[]) {
  const s = ds.filter(Boolean).sort(); if (!s.length) return;
  await exec("delete from aff_orders where store_id = ? and order_id like 'hist-%' and tanggal between ? and ?", [storeId, s[0], s[s.length - 1]]);
}

/* ---------- 1. Simpan data mentah dari file upload ---------- */
export async function ingestAff(storeId: string, jenis: string, dari: string, data: { rows: Row[] }) {
  const R = data.rows;
  const chunk = <T,>(a: T[], n = 1000) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  if (jenis === "aff-pesanan-tiktok") {
    // [id, tanggal, kreator, sku, nilai, qty, status, refund_penuh, konten, komisi, id_sku]
    await clearHist(storeId, R.map((r) => String(r[1] || "")));
    const V = R.filter((r) => r[1] && r[2]).map((r) => [storeId, "T", String(r[0]).slice(0, 40), String(r[10] || r[3] || "-").slice(0, 80), String(r[2]).trim().slice(0, 120), null, r[1],
      +r[4] || 0, String(r[6]) === "Tidak memenuhi syarat" || /^ya/i.test(String(r[7])) ? 1 : 0, 0, String(r[8] || "").slice(0, 40), null, +r[9] || 0]);
    for (const c of chunk(V)) await exec("insert into aff_orders (store_id, platform, order_id, item, kreator, nama, tanggal, nilai, gagal, retur, konten, mcn, komisi) values ? on duplicate key update tanggal = values(tanggal), nilai = values(nilai), gagal = values(gagal), konten = values(konten), komisi = values(komisi)", [c]);
    return V.length;
  }
  if (jenis === "validasi-shopee") {
    // [kode, item, tanggal, username, nama, nilai, pengembalian, status, kanal, mcn, komisi]
    await clearHist(storeId, R.map((r) => String(r[2] || "")));
    const V = R.filter((r) => r[2] && r[3]).map((r) => [storeId, "S", String(r[0]).slice(0, 40), String(r[1]).slice(0, 80), String(r[3]).trim().slice(0, 120), String(r[4] || "").slice(0, 160) || null, r[2],
      +r[5] || 0, String(r[7]) === "Dibatalkan" ? 1 : 0, +r[6] || 0, String(r[8] || "").slice(0, 40), String(r[9] || "").trim().slice(0, 120) || null, +r[10] || 0]);
    for (const c of chunk(V)) await exec("insert into aff_orders (store_id, platform, order_id, item, kreator, nama, tanggal, nilai, gagal, retur, konten, mcn, komisi) values ? on duplicate key update tanggal = values(tanggal), nilai = values(nilai), gagal = values(gagal), retur = values(retur), konten = values(konten), mcn = values(mcn), nama = values(nama), komisi = values(komisi)", [c]);
    return V.length;
  }
  if (jenis === "aff-tiktok") {
    // [kreator, gmv, gmv_live, gmv_video, refund, pesanan, terjual, terjual_refund, sampel, impresi, tayangan, komisi, video, live, konten_sampel]
    const bulan = dari.slice(0, 7);
    const V = R.filter((r) => r[0]).map((r) => [storeId, bulan, String(r[0]).trim().slice(0, 120), +r[12] || 0, +r[13] || 0, +r[8] || 0, +r[14] || 0, +r[1] || 0]);
    for (const c of chunk(V)) await exec("insert into aff_ta (store_id, bulan, kreator, video, live, sampel, konten_sampel, gmv) values ? on duplicate key update video = values(video), live = values(live), sampel = values(sampel), konten_sampel = values(konten_sampel), gmv = values(gmv)", [c]);
    return V.length;
  }
  if (jenis === "aff-shopee") {
    // [username, nama, omzet, terjual, pesanan, klik, komisi, roi, pembeli, pembeli_baru]
    const V = R.filter((r) => r[0]).map((r) => [storeId, String(r[0]).trim().slice(0, 120), String(r[1] || "").slice(0, 160), +r[9] || 0]);
    for (const c of chunk(V)) await exec("insert into aff_ams (store_id, kreator, nama, pembeli_baru) values ? on duplicate key update nama = values(nama), pembeli_baru = greatest(pembeli_baru, values(pembeli_baru))", [c]);
    return V.length;
  }
  return 0;
}

/* ---------- 2. Hitung ulang file ruang kerja affiliate klien ---------- */
type O = { store_id: string; platform: string; order_id: string; kreator: string; nama: string | null; tanggal: string; nilai: number; gagal: number; retur: number; konten: string | null; mcn: string | null; komisi: number };
type Agg = { u: string; nama: string; g: number[]; gk: number; gx: number; l30: number; l60: number; l90: number; kont: Map<string, number>; br: Set<string>; mcn: Map<string, number>; batal: number; n: number };

export async function seedAffRaw(RAW: { T: Row[]; S: Row[]; TA: Row[]; AMS: Row[] }) {
  const chunk = <T,>(a: T[], n = 1000) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  for (const c of chunk(RAW.T)) await exec("insert ignore into aff_orders (store_id, platform, order_id, item, kreator, nama, tanggal, nilai, gagal, retur, konten, mcn, komisi) values ?", [c.map((r) => [r[0], "T", r[1], r[2], r[3], null, r[4], r[5], r[6], 0, r[7], null, r[8]])]);
  for (const c of chunk(RAW.S)) await exec("insert ignore into aff_orders (store_id, platform, order_id, item, kreator, nama, tanggal, nilai, gagal, retur, konten, mcn, komisi) values ?", [c.map((r) => [r[0], "S", r[1], r[2], r[3], r[4] || null, r[5], r[6], r[7], r[8], r[9], r[10] || null, r[11]])]);
  for (const c of chunk(RAW.TA)) await exec("insert ignore into aff_ta (store_id, bulan, kreator, video, live, sampel, konten_sampel, gmv) values ?", [c]);
  for (const c of chunk(RAW.AMS)) await exec("insert ignore into aff_ams (store_id, kreator, nama, pembeli_baru) values ?", [c]);
}

export async function rebuildAff(clientId: string): Promise<string> {
  const stores = await q<{ id: string; brand: string; platform: string }>("select id, brand, platform from stores where client_id = ?", [clientId]);
  if (!stores.length) return "";
  const brandOf = new Map(stores.map((s) => [s.id, s.brand]));
  const brands = [...new Set(stores.filter((s) => s.platform === "Shopee" || s.platform === "TikTok").map((s) => s.brand))];
  const Y = kemarin(), d30 = addD(Y, -29), d60 = addD(Y, -59), d90 = addD(Y, -89);
  const ids = stores.map((s) => s.id);
  const cov = await q<{ platform: string; a: string; b: string }>("select platform, date_format(min(tanggal), '%Y-%m-%d') a, date_format(max(tanggal), '%Y-%m-%d') b from aff_orders where store_id in (?) group by platform", [ids]);
  // Jendela 30/60/90 hari per platform dihitung mundur dari tanggal data terakhir platform itu (maks. kemarin)
  const ank = (pl: string) => { const c = cov.find((x) => x.platform === pl); return c && c.b < Y ? c.b : Y; };
  const W = (pl: string) => { const e = ank(pl); return { e, d30: addD(e, -29), d60: addD(e, -59), d90: addD(e, -89) }; };
  const ok = (pl: string) => { const c = cov.find((x) => x.platform === pl); return !!c && c.a <= W(pl).d90; };
  const doT = ok("T"), doS = ok("S");
  const ket = (pl: string, nm: string) => { const c = cov.find((x) => x.platform === pl); return !c ? `${nm}: belum ada data` : c.a <= W(pl).d90 ? `${nm}: dihitung ulang (${c.a} s/d ${c.b})` : `${nm}: data baru mulai ${c.a}, perlu data sejak ${W(pl).d90} (90 hari terakhir) untuk menghitung ulang`; };
  if (!doT && !doS) return `Prioritas affiliate belum dihitung ulang. ${ket("T", "TikTok")}. ${ket("S", "Shopee")}.`;

  // Bulan yang ditampilkan: Januari tahun ini s.d. bulan kemarin (minimal 6 bulan)
  const yE = +Y.slice(0, 4), mE = +Y.slice(5, 7);
  const months: string[] = []; { let y = yE, m = mE; const n = Math.max(6, mE); for (let i = 0; i < n; i++) { months.unshift(`${y}-${String(m).padStart(2, "0")}`); m--; if (!m) { m = 12; y--; } } }
  const mi = (d: string) => months.indexOf(d.slice(0, 7));
  const M = months.map((x) => BLN[+x.slice(5) - 1]);

  const cur = await q<{ isi: string }>("select isi from aff_files where client_id = ? and nama = 'aff-jf.json'", [clientId]);
  const OLD = cur[0] ? JSON.parse(cur[0].isi) : null;
  const hasil = await q<{ isi: string }>("select isi from aff_files where client_id = ? and nama = 'sampel_hasil.json'", [clientId]);
  const HAS: Record<string, number[]> = hasil[0] ? JSON.parse(hasil[0].isi).d ?? {} : {};
  const ROI = clientId === "jf" ? 10 : 5;

  const O = await q<O>("select store_id, platform, order_id, kreator, nama, date_format(tanggal, '%Y-%m-%d') tanggal, nilai, gagal, retur, konten, mcn, komisi from aff_orders where store_id in (?) and tanggal >= ?", [ids, months[0] + "-01"]);
  const agg = (pl: string) => {
    const { e: Ye, d30, d60, d90 } = W(pl);
    const A = new Map<string, Agg>();
    for (const o of O) {
      if (o.platform !== pl) continue;
      const k = o.kreator.toLowerCase(); const a = A.get(k) ?? { u: o.kreator, nama: o.nama ?? "", g: months.map(() => 0), gk: 0, gx: 0, l30: 0, l60: 0, l90: 0, kont: new Map(), br: new Set(), mcn: new Map(), batal: 0, n: 0 };
      const v = +o.nilai, ret = +o.retur, bad = +o.gagal === 1;
      const bersih = bad ? 0 : v - ret, i = mi(o.tanggal);
      a.gk += v; a.gx += bad ? v : ret; a.n++; if (bad) a.batal++;
      if (i >= 0) a.g[i] += pl === "T" ? v : bersih;     // TikTok per bulan = kotor, Shopee = bersih (sama seperti sebelumnya)
      if (o.tanggal >= d30 && o.tanggal <= Ye) a.l30 += bersih;
      if (o.tanggal >= d60 && o.tanggal <= Ye) a.l60 += bersih;
      if (o.tanggal >= d90 && o.tanggal <= Ye) a.l90 += bersih;
      if (o.konten) a.kont.set(o.konten, (a.kont.get(o.konten) ?? 0) + v);
      a.br.add(brandOf.get(o.store_id) ?? "");
      if (o.mcn) a.mcn.set(o.mcn, (a.mcn.get(o.mcn) ?? 0) + v);
      if (o.nama && !a.nama) a.nama = o.nama;
      A.set(k, a);
    }
    return A;
  };
  const prio = (pl: "T" | "S", a: Agg): [number, number] => {
    const gb = a.gk - a.gx, u = a.u.toLowerCase();
    if ((pl === "S" && (NETS.has(u) || AGACC.has(u))) || (pl === "T" && TTPF.test(u))) return [5, 6];
    if (gb <= 0) return [5, 5];
    if (a.l30 > 3_000_000) return [1, 0];
    if (a.l60 <= 0) return [4, 3];
    const h = HAS[pl + "|" + u]; if (h && h[3] && (h[0] + h[2]) / h[3] <= ROI) return [4, 4];
    if (a.l90 > 1_000_000) return [2, 1];
    return [3, 2];
  };
  const top = (m: Map<string, number>) => { let k = "", v = -1; for (const [a, b] of m) if (b > v) { k = a; v = b; } return [k, v] as const; };
  const catOf = (a: Agg, extra = "") => [extra, brands.length > 1 ? [...a.br].filter(Boolean).sort((x, y) => brands.indexOf(x) - brands.indexOf(y)).join(", ") : ""].filter(Boolean).join(" · ");

  // TikTok
  let TT: Row[] = OLD?.tt ?? [];
  if (doT) {
    const ta = await q<{ kreator: string; video: number; live: number; sampel: number }>("select kreator, sum(video) video, sum(live) live, sum(sampel) sampel from aff_ta where store_id in (?) group by kreator", [ids]);
    const TA = new Map(ta.map((x) => [x.kreator.toLowerCase(), x]));
    TT = [...agg("T").values()].map((a) => {
      const [kt, kv] = top(a.kont), t = TA.get(a.u.toLowerCase()); const [pr, ak] = prio("T", a);
      const tip = TTPF.test(a.u.toLowerCase()) ? 18 : a.gk ? (KONTEN[kt] ?? 0) : 4, samp = +(t?.sampel ?? 0);
      return [a.u, tip, ...a.g.map(Math.round), +(t?.video ?? 0), +(t?.live ?? 0), a.gk ? +(a.gx / a.gk).toFixed(3) : 0, samp, catOf(a, samp ? `Sampel ${samp}x` : ""), pr, ak, Math.round(a.gk), Math.round(a.gk - a.gx), Math.round(a.gx), 0, a.gk ? Math.round((kv / a.gk) * 100) : 0];
    });
    // Kreator yang sudah dapat sampel tapi belum punya pesanan: tetap masuk daftar (P5, GMV 0)
    const ada = new Set(TT.map((r) => String(r[0]).toLowerCase()));
    for (const t of ta) if (+t.sampel > 0 && !ada.has(t.kreator.toLowerCase()))
      TT.push([t.kreator, 4, ...months.map(() => 0), +t.video, +t.live, 0, +t.sampel, `Sampel ${+t.sampel}x`, 5, 5, 0, 0, 0, 0, 0]);
    TT.sort((x, y) => (y[y.length - 5] as number) - (x[x.length - 5] as number));
  }
  // Shopee
  let SH: Row[] = OLD?.sh ?? [];
  const SA = doS ? agg("S") : new Map<string, Agg>();
  if (doS) {
    const ams = await q<{ kreator: string; pb: number }>("select kreator, max(pembeli_baru) pb from aff_ams where store_id in (?) group by kreator", [ids]);
    const PB = new Map(ams.map((x) => [x.kreator.toLowerCase(), +x.pb]));
    SH = [...SA.values()].map((a) => {
      const [kt, kv] = top(a.kont); const [pr, ak] = prio("S", a); const isNet = NETS.has(a.u.toLowerCase()) || AGACC.has(a.u.toLowerCase());
      const tip = isNet ? 18 : a.gk ? (KANAL[kt] ?? 16) : 17; const [mc] = top(a.mcn);
      return [a.u, a.nama || a.u, tip, tip === 6 ? "Shopeelive-Shopee" : "", ...a.g.map(Math.round), PB.get(a.u.toLowerCase()) ?? 0, a.n ? +(a.batal / a.n).toFixed(3) : 0, 0, catOf(a, mc ? `Anggota agency ${mc}` : ""), pr, ak, Math.round(a.gk), Math.round(a.gk - a.gx), Math.round(a.gx), 0, a.gk ? Math.round((kv / a.gk) * 100) : 0];
    });
    // Affiliate yang tercatat di AMS tapi belum punya pesanan: tetap masuk daftar (P5, GMV 0)
    const adaS = new Set(SH.map((r) => String(r[0]).toLowerCase()));
    const amsN = await q<{ kreator: string; nama: string | null; pb: number }>("select kreator, max(nama) nama, max(pembeli_baru) pb from aff_ams where store_id in (?) group by kreator", [ids]);
    for (const x of amsN) if (!adaS.has(x.kreator.toLowerCase())) SH.push([x.kreator, x.nama || x.kreator, 17, "", ...months.map(() => 0), +x.pb, 0, 0, "", 5, 5, 0, 0, 0, 0, 0]);
    SH.sort((x, y) => (y[y.length - 5] as number) - (x[x.length - 5] as number));
  }

  // Agency (MCN Shopee) & jaringan/platform
  let A: Row[] = OLD?.A ?? [], C: Row[] = OLD?.C ?? [], B: Row[] = OLD?.B ?? [];
  if (doS) {
    const byM = new Map<string, Agg[]>(); for (const a of SA.values()) { const [mc] = top(a.mcn); if (mc) byM.set(mc, [...(byM.get(mc) ?? []), a]); }
    A = []; C = [];
    for (const [m, xs] of byM) {
      xs.sort((a, b) => (b.gk - b.gx) - (a.gk - a.gx)); const om = xs.reduce((s, a) => s + a.gk - a.gx, 0), ok = xs.reduce((s, a) => s + a.n - a.batal, 0), n = xs.reduce((s, a) => s + a.n, 0);
      const pr = om >= 20e6 ? 1 : om >= 3e6 ? 2 : 3;
      A.push([m, Math.round(om), ok, n ? +(xs.reduce((s, a) => s + a.batal, 0) / n).toFixed(3) : 0, `${xs[0].u} (${xs[0].nama || xs[0].u})`, xs.slice(0, 12).map((a) => a.u).join(", "), pr,
        pr === 1 ? "Prioritas: ajak kerja sama agency, minta lebih banyak anggota ikut campaign" : pr === 2 ? "Ajak anggota agency ikut campaign & tawarkan sampel ke anggota teratas" : "Pantau: kontribusi agency masih kecil"]);
      for (const a of xs) C.push([m, a.u, a.nama || a.u, Math.round(a.gk - a.gx), a.n - a.batal, Math.round(a.gk - a.gx)]);
    }
    A.sort((a, b) => (b[1] as number) - (a[1] as number));
  }
  if (doS || doT) {
    B = [];
    if (doS) for (const a of SA.values()) if (NETS.has(a.u.toLowerCase())) B.push([a.nama || a.u, "", a.u, 0, Math.round(a.gk - a.gx), "Jaringan/platform affiliate", 2, "Hubungi tim partnership: minta laporan per kreator & tawarkan komisi campaign"]);
    if (doT) for (const a of agg("T").values()) if (TTPF.test(a.u.toLowerCase()) && a.gk - a.gx >= 300_000) B.push([a.u, a.u, "", Math.round(a.gk - a.gx), 0, "Program Trafik Eksternal TikTok", 2, "Agency/platform: evaluasi di level kerja sama, bukan per orang"]);
    if (!doS) B.push(...(OLD?.B ?? []).filter((b: Row) => b[2])); if (!doT) B.push(...(OLD?.B ?? []).filter((b: Row) => !b[2]));
    B.sort((a, b) => ((b[3] as number) + (b[4] as number)) - ((a[3] as number) + (a[4] as number)));
  }

  // Ringkasan per bulan
  const per = (pl: string, f: (o: O) => number, uniq?: (o: O) => string) => months.map((m) => { const xs = O.filter((o) => o.platform === pl && o.tanggal.startsWith(m)); return uniq ? new Set(xs.map(uniq)).size : Math.round(xs.reduce((s, o) => s + f(o), 0)); });
  const MT = doT ? { cols: M, rows: [["GMV affiliate (kotor)", per("T", (o) => +o.nilai), "rp"], ["Tidak memenuhi syarat / retur", per("T", (o) => (+o.gagal ? +o.nilai : 0)), "rp"], ["Pesanan", per("T", () => 0, (o) => o.order_id), "n"], ["Kreator yang jualan", per("T", () => 0, (o) => o.kreator.toLowerCase()), "nt"], ["Perkiraan komisi", per("T", (o) => +o.komisi), "rp"]] } : OLD?.M?.tt;
  const MS = doS ? { cols: M, rows: [["GMV affiliate", per("S", (o) => (+o.gagal ? 0 : +o.nilai - +o.retur)), "rp"], ["Pesanan", per("S", () => 0, (o) => (+o.gagal ? "" : o.order_id)), "n"], ["Affiliate yang jualan", per("S", () => 0, (o) => o.kreator.toLowerCase()), "nt"], ["Estimasi komisi", per("S", (o) => (+o.gagal ? 0 : +o.komisi)), "rp"]] } : OLD?.M?.sh;

  // Kalau hanya satu platform dihitung ulang, bulan platform lain tetap memakai susunan lama
  const D = { ...(OLD ?? {}), tip: TIP, tipArti: TIP_ARTI, tt: TT, sh: SH, A, B, C, M: { tt: MT, sh: MS }, X: OLD?.X ?? [], HAL: OLD?.HAL ?? null,
    TT_M: doT ? M : OLD?.TT_M, SH_M: doS ? M : OLD?.SH_M, ...(brands.length > 1 ? { BRANDS: brands } : {}), DIHITUNG: { kemarin: Y, tiktok: doT, shopee: doS, sd_tiktok: ank("T"), sd_shopee: ank("S") } };
  // aksi: daftar baru untuk platform yang dihitung ulang; platform lama tetap menunjuk indeks daftar lama
  if (doT && doS) D.aks = AKS;
  else { const base = (OLD?.aks ?? []).length; D.aks = [...(OLD?.aks ?? []), ...AKS]; const shift = (rows: Row[], pi: number) => rows.forEach((r) => { r[pi] = (r[pi] as number) + base; });
    if (doT) shift(TT, TT[0] ? TT[0].length - 6 : 0); if (doS) shift(SH, SH[0] ? SH[0].length - 6 : 0); }
  await exec("insert into aff_files (client_id, nama, isi) values (?, 'aff-jf.json', ?) on duplicate key update isi = values(isi)", [clientId, JSON.stringify(D)]);
  // Riwayat prioritas harian (untuk melihat siapa yang naik/turun)
  const snap: Record<string, number> = {}; for (const r of TT) snap["T|" + String(r[0]).toLowerCase()] = r[r.length - 7] as number; for (const r of SH) snap["S|" + String(r[0]).toLowerCase()] = r[r.length - 7] as number;
  await exec("insert into aff_docs (client_id, coll, id, data) values (?, 'prio_hist', ?, ?) on duplicate key update data = values(data)", [clientId, Y, JSON.stringify(snap)]);
  return `Prioritas affiliate dihitung ulang (30/60/90 hari s.d. ${Y}). ${ket("T", "TikTok")}. ${ket("S", "Shopee")}.`;
}
