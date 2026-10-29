(async()=>{let D;try{D=await (await fetch(window.AFF_SRC("aff-jf.json"))).json()}catch(e){document.getElementById("aff-root").insertAdjacentHTML("afterbegin","<p>Data affiliate gagal dimuat. Muat ulang halaman.</p>");return}
window.AFF_BRANDS = D.BRANDS || null; if (window.__fillToko) window.__fillToko();
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
const RESP = ['Belum ada respon','Tertarik','Tanya detail/komisi','Minta sampel dulu','Minta fee/rate card','Tidak tertarik','Akun/nomor tidak aktif'];
const STAT = ['Belum dihubungi','Sudah dihubungi','Setuju','Menolak','Tidak respon','Produk dikirim','Sudah posting'];
const PRIO = {1:'Hubungi duluan',2:'Hubungi minggu ini',3:'Undang ke campaign pendaftaran',4:'Tahan / evaluasi dulu',5:'Tidak perlu dihubungi'};
const TT_M = D.TT_M || ['Mei','Jun','Jul','Agu','Sep','Okt'], SH_M = D.SH_M || ['Mei','Jun','Jul','Agu','Sep','Okt'];
const NT = TT_M.length, NS = SH_M.length, oT = NT - 6, oS = NS - 6;
const PAGE = 50;

/* ---------- rows ---------- */
const TT = D.tt.map(r => {
  const g = r.slice(2,2+NT); return {k:'tt', key:r[0], u:r[0], tipe:D.tip[r[1]], g, okt:g[NT-1], tot:g.reduce((a,b)=>a+b,0), bln:g.filter(v=>v>0).length,
    vid:r[8+oT], live:r[9+oT], gagal:r[10+oT], samp:r[11+oT], cat:r[12+oT], pr:r[13+oT], aksi:D.aks[r[14+oT]], gk:r[15+oT]||0, gb:r[16+oT]||0, gx:r[17+oT]||0, gest:r[18+oT]?1:0, tp:r[19+oT]};
});
const SH = D.sh.map(r => {
  const g = r.slice(4,4+NS); return {k:'sh', key:r[0], u:r[0], nama:r[1], tipe:D.tip[r[2]], ch:r[3], g, okt:g[NS-1], tot:g.reduce((a,b)=>a+b,0), bln:g.filter(v=>v>0).length,
    pb:r[10+oS], batal:r[11+oS], samp:r[12+oS], cat:r[13+oS], pr:r[14+oS], aksi:D.aks[r[15+oS]], gk:r[16+oS]||0, gb:r[17+oS]||0, gx:r[18+oS]||0, gest:r[19+oS]?1:0, tp:r[20+oS]};
});
/* bulan aktif: penyebut = bulan yang ada datanya, plus bulan kontribusi terbesar */
const availOf = rows => { const n = rows[0] ? rows[0].g.length : 0; const t = Array(n).fill(0); rows.forEach(r => r.g.forEach((v,i) => { t[i] += v||0; })); return t.map(v => v > 0); };
const AV_TT = availOf(TT), AV_SH = availOf(SH);
[[TT, AV_TT, TT_M], [SH, AV_SH, SH_M]].forEach(([rows, av, lbl]) => rows.forEach(r => {
  r.bln = r.g.filter((v,i) => av[i] && v > 0).length; r.blnN = av.filter(Boolean).length;
  let mi = -1, mv = 0; r.g.forEach((v,i) => { if (v > mv) { mv = v; mi = i; } });
  const pos = r.g.reduce((a,v) => a + (v > 0 ? v : 0), 0);
  r.blnTop = mi >= 0 && pos > 0 ? String(lbl[mi]).split(' ')[0] + ' ' + Math.round(mv / pos * 100) + '%' : '';
}));
/* label platform + nama toko (toko hanya untuk klien dengan lebih dari satu brand) */
const ptags = r => `<div class="ptags"><span class="plt ${r.k}">${r.k==='tt'?'TIKTOK':'SHOPEE'}</span>${(D.BRANDS||[]).filter(b => String(r.cat||'').includes(b)).map(b => `<span class="brt">${esc(b)}</span>`).join('')}</div>`;
const blnCell = r => `${r.bln}/${r.blnN ?? r.g.length}${r.blnTop ? `<br><small class="muted" title="Bulan dengan kontribusi GMV terbesar">${r.blnTop}</small>` : ''}`;
const MEM = {}; D.C.forEach(c => (MEM[c[0]] ||= []).push({u:c[1], nama:c[2], om:c[3], ok:c[4], all:c[5]}));
const AGA = D.A.map(r => ({k:'ag', key:'A '+r[0], grp:'A', nama:r[0], om:r[1], ok:r[2], batal:r[3], top:r[4], pr:r[6], aksi:r[7], mem:MEM[r[0]]||[]}));
const AGB = D.B.map(r => ({k:'ag', key:'B '+r[0], grp:'B', nama:r[0], att:r[1], ash:r[2], gt:r[3], gs:r[4], tot:r[3]+r[4], cat:r[5], pr:r[6], aksi:r[7]}));

/* ---------- follow-up store ---------- */
const FU = {tt:{}, sh:{}, ag:{}};
const COLL = {tt:'jf_fu_tt', sh:'jf_fu_sh', ag:'jf_fu_ag'};
let db = null, me = null, userApi = null, dbState = 'wait';
const docId = key => { let s = String(key).replace(/[^A-Za-z0-9_\-~:@+.]/g,'_'); if (s==='.'||s==='..'||!s) s = '_'+s; return s.slice(0,190); };
const fuOf = row => FU[row.k][docId(row.key)] || null;
const statusOf = row => (fuOf(row)?.status) || 'Belum dihubungi';
const NOCONTACT = 'Tidak perlu dihubungi (P4–P5)';
// nomor HP: ada deret angka 9–15 digit (boleh diawali +62/62/0, dengan spasi/titik/strip)
const waNum = k => { for (const m of (String(k||'').match(/\+?\d[\d\s.\-()]{7,}\d/g) || [])) { let d = m.replace(/\D/g, ''); if (d.length < 9 || d.length > 15) continue; if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d; return d; } return null; };
const kontakHtml = (k, r, tp) => { const n = waNum(k); if (!n) return `<small class="kt-x" title="Belum ada nomor HP">${/@/.test(k) && /\./.test(k) ? 'Email' : 'Kontak'}: ${esc(k)} · belum ada no. HP</small>`;
  return `<a class="wa" href="https://wa.me/${n}${waText(r, tp)}" target="_blank" rel="noopener" title="Buka chat WhatsApp ${esc(k)}"><svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3a.4.4 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.2c0-.1-.2-.2-.5-.3z"/></svg>${esc(k)}</a>`; };
const hasPhone = row => { const k = fuOf(row)?.kontak; if (!k) return false; return (String(k).match(/\+?\d[\d\s.\-()]{7,}\d/g) || []).some(m => { const d = m.replace(/\D/g, ''); return d.length >= 9 && d.length <= 15; }); };
const RO = () => !!document.getElementById('aff-root')?.classList.contains('ro');
const kerjaTxt = r => { const f = fuOf(r); const p = [dispStatus(r)]; if (f?.respon) p.push(f.respon); if (f?.tglLast) p.push('dihubungi ' + fdate(f.tglLast)); return p.join(' · '); };
const aksiTd = r => RO() ? `<td class="aksi">${esc(kerjaTxt(r))}</td>` : `<td class="aksi">${esc(r.aksi)}</td>`;
const aksiLbl = () => RO() ? 'Status kerja Ruria' : 'Saran aksi';
const dispStatus = row => (row.pr >= 4 && statusOf(row) === 'Belum dihubungi') ? NOCONTACT : statusOf(row);
const STAT_ALL = () => [...STAT, NOCONTACT];
const daysSince = iso => { if (!iso) return null; const d = new Date(iso+'T00:00:00'); if (isNaN(d)) return null; return Math.round((TODAY - d)/86400000); };
const needsFU = row => { const f = fuOf(row); if (!f) return false; if (f.next && f.next <= isoToday()) return true; const h = daysSince(f.tglLast); return f.respon === 'Belum ada respon' && h !== null && h >= 3; };

/* ---------- format ---------- */
const nf = new Intl.NumberFormat('id-ID');
const rp = v => v ? 'Rp' + nf.format(Math.round(v)) : '–';
const rpShort = v => { if (!v) return '–'; if (v >= 1e9) return 'Rp' + (v/1e9).toLocaleString('id-ID',{maximumFractionDigits:1}) + ' M'; if (v >= 1e6) return 'Rp' + (v/1e6).toLocaleString('id-ID',{maximumFractionDigits:1}) + ' jt'; if (v>=1e3) return 'Rp' + Math.round(v/1e3) + ' rb'; return 'Rp' + v; };
const pct = v => (v === null || v === undefined || v === '') ? '–' : Math.round(v*100) + '%';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fdate = iso => { if (!iso) return ''; const d = new Date(iso+'T00:00:00'); return isNaN(d) ? iso : d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); };
const isoToday = () => { const d = new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const prioChip = p => `<span class="chip p${p}" title="${esc(PRIO[p])}">P${p}</span>`;
const tipeR = r => tipeChip(r.tipe) + (r.tp ? ` <small class="muted">${r.tp}%</small>` : '');
const tipeChip = t => t === 'Agency/Platform' ? `<span class="chip ag">Agency/Platform</span>` : `<span class="muted">${esc(t)}</span>`;
const statClass = s => ({'Sudah dihubungi':'s-act','Setuju':'s-ok','Produk dikirim':'s-ok','Sudah posting':'s-ok','Menolak':'s-bad','Tidak respon':'s-warn','Tidak perlu dihubungi (P4–P5)':'s-skip'}[s] || '');
const statChip = s => `<span class="chip ${statClass(s)}">${esc(s)}</span>`;
const lastCell = row => { const f = fuOf(row); if (!f || !f.tglLast) return '<span class="muted">–</span>'; const h = daysSince(f.tglLast); const late = needsFU(row);
  return `<span class="${late?'late':''}">${esc(fdate(f.tglLast))}</span><br><small class="muted">${h===0?'hari ini':h+' hari lalu'}</small>`; };

/* ---------- state ---------- */
const S = {
  tab: 'ringkasan',
  f: { tiktok:{q:'',pr:'',tipe:'',st:'',resp:'',kontak:'',samp:'',jual:'',due:false,p5:false,sort:'pr',dir:'',page:0}, shopee:{q:'',pr:'',tipe:'',st:'',resp:'',kontak:'',samp:'',jual:'',due:false,p5:false,sort:'pr',dir:'',page:0}, agency:{q:'', pl:''} },
  open: null
};
try { const s = JSON.parse(localStorage.getItem('jf-filters')||'null'); if (s) { Object.assign(S.f.tiktok, s.tiktok||{}, {page:0}); Object.assign(S.f.shopee, s.shopee||{}, {page:0}); } } catch(e){}
const saveFilters = () => { try { localStorage.setItem('jf-filters', JSON.stringify({tiktok:S.f.tiktok, shopee:S.f.shopee})); localStorage.setItem('jf-dbpl', S.dbpl || ''); } catch(e){} };
try { S.dbpl = localStorage.getItem('jf-dbpl') || ''; } catch(e) { S.dbpl = ''; }

/* ---------- tabs ---------- */
const view = document.getElementById('view');
function setTab(t, push=true){
  if (t === 'agency') t = 'shopee';
  if (t === 'tiktok' || t === 'shopee') { S.dbpl = t === 'tiktok' ? 'TikTok' : 'Shopee'; t = 'db'; }
  if (t === 'rekap' || t === 'efektif') t = 'ringkasan';
  if (!['ringkasan','kerja','db','tiktok','shopee','input','log'].includes(t)) t = 'ringkasan';
  S.tab = t;
  document.querySelectorAll('nav.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t ? 'true':'false'));
  if (push) { try { history.replaceState(null,'','#'+t); } catch(e){} }
  const showS = t === 'input' || t === 'ringkasan';
  document.querySelector('#aff-root main').hidden = t === 'input';
  const sr = document.getElementById('sampel-root'); if (sr) sr.hidden = !showS;
  if (showS) { if (window.__sampelShow) window.__sampelShow(t); else window.__sampelPending = t; }
  if (t === 'input') return;
  render();
}
document.querySelectorAll('nav.tabs button').forEach(b => b.addEventListener('click', () => { setTab(b.dataset.tab); window.scrollTo(0,0); }));
document.getElementById('n-tiktok').textContent = nf.format(TT.length);
document.getElementById('n-db').textContent = nf.format(TT.length + SH.length);
document.getElementById('n-shopee').textContent = nf.format(SH.length);

function render(){
  { const np = document.getElementById('navplat'); if (np) np.innerHTML = ''; }
  { const mw = document.getElementById('meet-wrap'); if (mw) { mw.hidden = S.tab !== 'ringkasan'; if (mw.hidden) mw.innerHTML = ''; } }
  if (S.tab === 'ringkasan') renderSummary();
  else if (S.tab === 'kerja') renderKerja();
  else if (S.tab === 'tiktok') { renderList('tiktok'); appendAgency('tiktok'); }
  else if (S.tab === 'shopee') { renderList('shopee'); appendAgency('shopee'); }
  else if (S.tab === 'db') { renderDb(); appendAgency(S.dbpl === 'TikTok' ? 'tiktok' : S.dbpl === 'Shopee' ? 'shopee' : 'semua'); }
  else if (S.tab === 'log') renderLog();
  else if (S.tab === 'weekly') renderWeekly();
}
let rTimer = null;
function rerenderSoon(){ clearTimeout(rTimer); rTimer = setTimeout(() => { const a = document.activeElement; const keep = a && a.id && view.contains(a) ? {id:a.id, s:a.selectionStart, e:a.selectionEnd} : null; render(); if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { el.setSelectionRange(keep.s, keep.e); } catch(e){} } } if (S.open) refreshDrawerMeta(); }, 120); }

function bannerHtml(){
  if (dbState === 'ok') return '';
  if (dbState === 'wait') return '';
  return `<div class="banner">Catatan follow-up tidak bisa dimuat di tampilan ini, jadi kolom follow-up hanya bisa dibaca. Buka halaman ini di Claude saat sudah login untuk mengisi.</div>`;
}

/* ---------- summary ---------- */
function countBy(rows, fn){ const m = {}; rows.forEach(r => { const k = fn(r); m[k] = (m[k]||0)+1; }); return m; }
function renderSummary(){
  const stTT = countBy(TT, dispStatus), stSH = countBy(SH, dispStatus), stAG = countBy([...AGA,...AGB], dispStatus);
  const need = rows => rows.filter(r => r.pr <= 3), skip = rows => rows.filter(r => r.pr >= 4).length;
  const nTT = need(TT).length, nSH = need(SH).length, nAG = need([...AGA,...AGB]).length;
  const sTT = skip(TT), sSH = skip(SH), sAG = skip([...AGA,...AGB]);
  const rTT = countBy(TT.filter(fuOf), r => fuOf(r).respon||''), rSH = countBy(SH.filter(fuOf), r => fuOf(r).respon||''), rAG = countBy([...AGA,...AGB].filter(fuOf), r => fuOf(r).respon||'');
  const dueTT = TT.filter(needsFU).length, dueSH = SH.filter(needsFU).length, dueAG = [...AGA,...AGB].filter(needsFU).length;
  const contacted = (rows) => rows.filter(r => statusOf(r) !== 'Belum dihubungi').length;
  const cTT = contacted(need(TT)), cSH = contacted(need(SH)), cAG = contacted(need([...AGA,...AGB]));
  const pTT = countBy(TT, r=>r.pr), pSH = countBy(SH, r=>r.pr);
  const tTT = countBy(TT, r=>r.tipe), tSH = countBy(SH, r=>r.tipe);
  const tipeArti = D.tipArti || {'Kreator konten':'Kreator individu yang jualan lewat video/LIVE','Agency/Platform':'Kumpulan banyak kreator (mis. YouTube Shopping, Involve Asia). Tidak bisa dirinci per kreator','Jaringan/website':'Shopee: jualan lewat link website/aplikasi luar','Product card / iklan':'TikTok: jualan dari kartu produk tanpa konten','Belum diketahui':'Shopee: affiliate baru, channel belum tercatat','Akun internal':'Akun JustFluff sendiri'};
  const mt = (blk) => `<div class="tscroll"><table class="mini"><thead><tr><th>Metrik</th>${blk.cols.map(c=>`<th class="num">${esc(c)}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>${
    blk.rows.map(([n,v,t]) => `<tr><td>${esc(n)}</td>${v.map(x=>`<td class="num">${x===null?'–':(t==='rp'?rpShort(x):nf.format(x))}</td>`).join('')}<td class="num"><b>${t==='nt'?'–':(t==='rp'?rpShort(v.reduce((a,b)=>a+b,0)):nf.format(v.reduce((a,b)=>a+b,0)))}</b></td></tr>`).join('')}</tbody></table></div>`;
  const K = (window.__sampelKpi && window.__sampelKpi()) || {};
  const kv = (v) => (v === undefined || v === null) ? '…' : v;
  view.innerHTML = `${bannerHtml()}
  ${todayPanel()}
  <section class="panel">
    <h2>Angka kunci</h2>
    <div class="stat-row">
      <div class="stat"><b>${nf.format(cTT+cSH+cAG)}</b><span>sudah dihubungi dari ${nf.format(nTT+nSH+nAG)} kreator, affiliate &amp; agency yang perlu dihubungi (P1–P3)</span></div>
      <div class="stat"><b>${nf.format(sTT+sSH+sAG)}</b><span>tidak perlu dihubungi dulu (P4 tahan/evaluasi, P5 tidak perlu)</span></div>
      <div class="stat hot"><b>${dueTT+dueSH+dueAG}</b><span>perlu di-follow-up (belum respon ≥3 hari)</span></div>
      <div class="stat"><b>${esc(kv(K.sampelBulan))}</b><span>sampel terkirim ${esc(K.bulanLbl || 'sejak Mei 2026')}${K.sampelWeb ? ' · ' + esc(K.sampelWeb) + ' dari form' : ''}</span></div>
      <div class="stat"><b>${esc(kv(K.laku))}</b><span>sampel yang menghasilkan order dalam 30 hari (${esc(K.efPer || 'semua sampel')}, TikTok &amp; Shopee)</span></div>
      <div class="stat"><b>${esc(kv(K.roi))}</b><span>GMV per Rp1 biaya sampel</span></div>
    </div>
    <p class="note">Data penjualan: TikTok s.d. 21 Okt (kreator) dan 30 Sep (efektivitas sampel), Shopee s.d. 21 Okt. Rekap dan efektivitas sampel lengkap ada di bawah halaman ini.</p>
  </section>
  <section class="panel">
    <h2>Progres follow-up</h2>
    <div class="stat-row">
      <div class="stat"><b>${nf.format(cTT)}</b><span>dari ${nf.format(nTT)} kreator TikTok P1–P3 sudah dihubungi</span><span class="muted">+${nf.format(sTT)} P4–P5 tidak perlu dihubungi</span></div>
      <div class="stat"><b>${nf.format(cSH)}</b><span>dari ${nf.format(nSH)} affiliate Shopee P1–P3 sudah dihubungi</span><span class="muted">+${nf.format(sSH)} P4–P5 tidak perlu dihubungi</span></div>
      <div class="stat"><b>${cAG}</b><span>dari ${nAG} agency/jaringan P1–P3 sudah dihubungi</span><span class="muted">+${sAG} P4–P5 tidak perlu dihubungi</span></div>
      <div class="stat hot"><b>${dueTT+dueSH+dueAG}</b><span>perlu di-follow-up: belum ada respon dan sudah ≥3 hari</span>
        ${dueTT+dueSH ? `<button class="btn sm" id="go-due">Lihat daftarnya →</button>` : ''}</div>
    </div>
    <div class="grid">
      <div class="tscroll"><table class="mini"><thead><tr><th>Status</th><th class="num">TikTok</th><th class="num">Shopee</th><th class="num">Agency</th></tr></thead><tbody>
        ${STAT_ALL().map(s => `<tr${s === NOCONTACT ? ' style="border-top:2px solid var(--line)"' : ''}><td>${statChip(s)}</td><td class="num">${nf.format(stTT[s]||0)}</td><td class="num">${nf.format(stSH[s]||0)}</td><td class="num">${stAG[s]||0}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="tscroll"><table class="mini"><thead><tr><th>Respon</th><th class="num">TikTok</th><th class="num">Shopee</th><th class="num">Agency</th></tr></thead><tbody>
        ${RESP.map(s => `<tr><td>${esc(s)}</td><td class="num">${rTT[s]||0}</td><td class="num">${rSH[s]||0}</td><td class="num">${rAG[s]||0}</td></tr>`).join('')}
      </tbody></table></div>
    </div>
  </section>
  <div class="grid">
    <section class="panel"><h2>Jumlah per prioritas</h2>
      <div class="tscroll"><table class="mini"><thead><tr><th>Prioritas</th><th>Arti</th><th class="num">TikTok</th><th class="num">Ada no. HP</th><th class="num">Shopee</th><th class="num">Ada no. HP</th></tr></thead><tbody>
      ${[1,2,3,4,5].map(p => { const ht = TT.filter(r => r.pr === p && hasPhone(r)).length, hs = SH.filter(r => r.pr === p && hasPhone(r)).length, nt = pTT[p]||0, ns = pSH[p]||0;
        const cell = (h, n) => `<td class="num"><b>${nf.format(h)}</b>${n ? ` <small class="muted">${pct(h/n)}</small>` : ''}</td>`;
        return `<tr><td>${prioChip(p)}</td><td>${PRIO[p]}</td><td class="num">${nf.format(nt)}</td>${cell(ht, nt)}<td class="num">${nf.format(ns)}</td>${cell(hs, ns)}</tr>`; }).join('')}
      </tbody></table></div>
      <p class="note">"Ada no. HP" = kolom Kontak di catatan follow-up berisi nomor telepon (9–15 digit, mis. 0812…, +62…). Kontak yang hanya berisi email atau username tidak dihitung.</p></section>
    <section class="panel"><h2>Jumlah per tipe akun</h2>
      <div class="tscroll"><table class="mini"><thead><tr><th>Tipe</th><th class="num">TikTok</th><th class="num">Shopee</th></tr></thead><tbody>
      ${Object.keys(tipeArti).map(t => `<tr><td>${tipeChip(t)}<br><small class="muted">${esc(tipeArti[t])}</small></td><td class="num">${nf.format(tTT[t]||0)}</td><td class="num">${nf.format(tSH[t]||0)}</td></tr>`).join('')}
      </tbody></table></div></section>
  </div>
  <section class="panel"><h2>TikTok per bulan</h2>${mt(D.M.tt)}
    <p class="note">GMV TikTok di laporan ini masih kotor. Dari export order, 39–52% GMV per bulan tidak dibayar (batal/COD gagal), jauh di atas "Pengembalian dana" yang tercatat.</p></section>
  <section class="panel"><h2>Shopee per bulan</h2>${mt(D.M.sh)}
    <p class="note">Omzet Shopee sudah tanpa pesanan batal. Sumber: laporan validasi komisi Shopee (Mei–Jul, pesanan selesai) dan AMS Affiliate Performance (Agu, Sep, 1–21 Okt). Pembeli baru tidak tersedia di laporan validasi.</p></section>
  <section class="panel"><h2>Cara pakai</h2>
    <p class="note">Buka tab TikTok Kreator atau Shopee Affiliate (Agency &amp; MCN ada di bagian bawah tab Shopee), lalu klik satu baris untuk mencatat kontak, tanggal dihubungi, respon, dan status. Kalau status diubah jadi "Produk dikirim", form Input Sampel langsung terbuka dengan username kreatornya; sebaliknya, setiap sampel yang diinput otomatis mengubah status kreator itu jadi "Produk dikirim". Catatan tersimpan otomatis dan langsung terlihat oleh semua orang yang membuka halaman ini. Tombol "Download Excel" mengunduh semua tab beserta catatan follow-up terbaru.</p></section>`;
  { const mw = document.getElementById('meet-wrap'); const rt = document.getElementById('sampel-root'); if (rt && mw.nextElementSibling === rt) rt.after(mw); mw.innerHTML = halPanel() + meetPanel(); }
  wireToday();
  wireMeet({cTT, cSH, cAG, nTT, nSH, nAG, sTT, sSH, sAG, due: dueTT+dueSH+dueAG, stTT, stSH, stAG, rTT, rSH, rAG, pTT, pSH, tTT, tSH, K});
  const g = document.getElementById('go-due');
  if (g) g.onclick = () => { const t = dueTT >= dueSH ? 'tiktok' : 'shopee'; Object.assign(S.f[t], {q:'',pr:'',tipe:'',st:'',resp:'',due:true,page:0}); setTab(t); };
}

/* ---------- list (TikTok / Shopee) ---------- */
const SORT_TXT = {num:['Terbesar dulu','Terkecil dulu'], txt:['Z–A','A–Z'], pr:['P5 dulu','P1 dulu'], last:['Paling lama dulu','Paling baru dulu'], list:['Urutan terbalik','Urutan daftar']};
const SORT_MAIN = ['pr','okt','gb','sroi','last','u'];
const sortOpts = (defs, cur) => SORT_MAIN.concat(defs[cur] && !SORT_MAIN.includes(cur) ? [cur] : []).filter(k => defs[k]).map(k => opt(k, k === 'sroi' ? 'Efektivitas sampel' : defs[k].lbl, cur)).join('');
function sortDefs(which){
  const isTT = which === 'tiktok', months = isTT ? TT_M : SH_M, pre = isTT ? 'GMV ' : 'Omzet ';
  const d = {
    pr:{lbl:'Prioritas', fn:r=>r.pr, t:'pr', dir:'asc'},
    okt:{lbl:pre+'30 hari terakhir', fn:r=>r.okt, t:'num', dir:'desc'},
    tot:{lbl:pre+'Mei–Okt', fn:r=>r.tot, t:'num', dir:'desc'},
    bln:{lbl:'Bulan aktif', fn:r=>r.bln, t:'num', dir:'desc'},
  };
  months.forEach((m,i) => { if (m !== 'Okt') d['m'+i] = {lbl:pre+m, fn:r=>r.g[i], t:'num', dir:'desc'}; });
  if (isTT) { d.vid = {lbl:'Jumlah video', fn:r=>r.vid, t:'num', dir:'desc'}; d.live = {lbl:'Jumlah LIVE', fn:r=>r.live, t:'num', dir:'desc'}; d.gagal = {lbl:'Porsi order gagal', fn:r=>r.gagal, t:'num', dir:'desc'}; }
  else { d.pb = {lbl:'Pembeli baru', fn:r=>r.pb, t:'num', dir:'desc'}; d.batal = {lbl:'Porsi batal', fn:r=>r.batal, t:'num', dir:'desc'}; }
  d.u = {lbl:'Username', fn:r=>r.u.toLowerCase(), t:'txt', dir:'asc'};
  d.st = {lbl:'Status', fn:r=>STAT_ALL().indexOf(dispStatus(r)), t:'list', dir:'asc'};
  d.sn = {lbl:'Jumlah sampel', fn:r=>sampStat(r).n, t:'num', dir:'desc'};
  d.sroi = {lbl:'Efektivitas sampel (GMV sebelum+sesudah ÷ biaya)', fn:r=>sampRoi(sampStat(r)), t:'num', dir:'desc'};
  d.resp = {lbl:'Respon', fn:r=>{ const x = fuOf(r)?.respon; return x ? RESP.indexOf(x) : null; }, t:'list', dir:'asc'};
  d.last = {lbl:'Terakhir dihubungi', fn:r=>daysSince(fuOf(r)?.tglLast), t:'last', dir:'desc'};
  return d;
}
function filtered(which){
  const f = S.f[which], rows = which === 'tiktok' ? TT : SH, q = f.q.trim().toLowerCase();
  let out = rows.filter(r => {
    if (q && !(r.u.toLowerCase().includes(q) || (r.nama||'').toLowerCase().includes(q) || (fuOf(r)?.kontak||'').toLowerCase().includes(q))) return false;
    if (f.pr && String(r.pr) !== f.pr) return false;
    if (f.tipe && r.tipe !== f.tipe) return false;
    if (f.st && dispStatus(r) !== f.st) return false;
    if (f.resp === '(kosong)' ? !!fuOf(r)?.respon : (f.resp && (fuOf(r)?.respon||'') !== f.resp)) return false;
    if (f.kontak === 'ada' && !hasPhone(r)) return false;
    if (f.kontak === 'lain' && (hasPhone(r) || !fuOf(r)?.kontak)) return false;
    if (f.kontak === 'belum' && hasPhone(r)) return false;
    if (f.samp) { const st = sampStat(r);
      if (f.samp === 'ya' && !st.n) return false;
      if (f.samp === 'tidak' && st.n) return false;
      if (f.samp === 'laku' && !(st.has && st.ord)) return false;
      if (f.samp === 'nol' && !(st.has && !st.ord)) return false;
      if (f.samp === 'blk' && !st.blk) return false;
      if (f.samp === 'boleh' && !(st.n && sampOk(st))) return false;
      if (f.samp === 'belum10' && !(st.n && !st.blk && !sampOk(st))) return false; }
    const reak = r.cat === 'Aktif Mei–Jul, belum jualan Agu–Okt';
    if (f.jual === 'reak' ? !reak : (f.jual !== 'semua' && reak)) return false;
    if (!f.p5 && !f.pr && r.pr === 5) return false;
    if (f.jual === 'nolj' && r.tot > 0) return false;
    if (f.jual === 'okt' && !(r.okt > 0)) return false;
    if (f.jual === 'tidakokt' && r.okt > 0) return false;
    if (f.due && !needsFU(r)) return false;
    return true;
  });
  const defs = sortDefs(which), sd = defs[f.sort] || defs.pr, dir = (f.dir || sd.dir) === 'asc' ? 1 : -1;
  if (f.sort !== 'pr' || dir !== 1) out = out.slice().sort((a,b) => {
    const x = sd.fn(a), y = sd.fn(b), xn = x === null || x === undefined, yn = y === null || y === undefined;
    if (xn || yn) return xn === yn ? 0 : (xn ? 1 : -1);
    return x < y ? -dir : x > y ? dir : 0;
  });
  return out;
}
const FILTER_KEYS = ['q','pr','tipe','st','resp','kontak','samp','jual','due','akt'];
const activeFilters = f => FILTER_KEYS.filter(k => f[k]).length;
const opt = (v, label, cur) => `<option value="${esc(v)}"${String(cur)===String(v)?' selected':''}>${esc(label)}</option>`;
function renderList(which){
  const f = S.f[which], isTT = which === 'tiktok', rows = isTT ? TT : SH;
  const defs = sortDefs(which); if (!defs[f.sort]) { f.sort = 'pr'; f.dir = ''; }
  const sd = defs[f.sort], dir = f.dir || sd.dir;
  const tipes = [...new Set(rows.map(r => r.tipe))];
  const list = filtered(which), pages = Math.max(1, Math.ceil(list.length / PAGE));
  if (f.page >= pages) f.page = pages - 1;
  const slice = list.slice(f.page*PAGE, f.page*PAGE + PAGE);
  const mLbl = isTT ? 'GMV 30 hari terakhir' : 'Omzet 30 hari terakhir', tLbl = isTT ? 'GMV Mei–Okt' : 'Omzet Mei–Okt';
  const nAct = activeFilters(f);
  const th = (key, label, cls='') => { const on = f.sort === key; const arrow = on ? (dir === 'asc' ? '▲' : '▼') : '↕'; const G_ = GLOS_AFF_F(), gl = G_[label] ? `<i class="ii" title="${esc(G_[label])}">i</i>` : '';
    label = label + gl;
    return `<th class="${cls}" aria-sort="${on ? (dir==='asc'?'ascending':'descending') : 'none'}"><button class="sorth${on?' on':''}" data-sort="${key}" title="Urutkan menurut ${esc(defs[key].lbl)}">${label}<span class="arr" aria-hidden="true">${arrow}</span></button></th>`; };
  view.innerHTML = `${bannerHtml()}
  <div class="toolbar">
    <div class="grow"><input type="search" id="${which}-q" placeholder="Cari username${isTT?'':', nama'} atau kontak" value="${esc(f.q)}" aria-label="Cari"></div>
    <button class="btn" id="${which}-xl">Download Excel</button>
  </div>
  <div class="filters">
    <span class="flabel">Filter</span>
    <select id="${which}-pr" aria-label="Prioritas" class="${f.pr?'act':''}">${opt('','Semua prioritas',f.pr)}${[1,2,3,4,5].map(p=>opt(p,'P'+p+' · '+PRIO[p],f.pr)).join('')}</select>
    <select id="${which}-kontak" aria-label="Kontak" class="${f.kontak?'act':''}">${opt('','Kontak: semua',f.kontak)}${opt('belum','Belum ada no. HP',f.kontak)}${opt('ada','Sudah ada no. HP',f.kontak)}${opt('lain','Kontak lain (email/DM), tanpa no. HP',f.kontak)}</select>
    <select id="${which}-jual" aria-label="Penjualan bulan terakhir" class="${f.jual?'act':''}">${opt('','Jualan: ada penjualan 90 hari terakhir',f.jual)}${opt('okt','Ada jualan bulan terakhir',f.jual)}${opt('tidakokt','Belum jualan bulan terakhir',f.jual)}${isTT?'':opt('reak','Reaktivasi: aktif Mei–Jul, berhenti',f.jual)}${opt('nolj','Belum ada penjualan (penerima sampel)',f.jual)}${opt('semua','Semua termasuk reaktivasi',f.jual)}</select>
    <select id="${which}-samp" aria-label="Sampel" class="${f.samp?'act':''}">${opt('','Sampel: semua',f.samp)}${opt('ya','Pernah dapat sampel',f.samp)}${opt('tidak','Belum pernah dapat sampel',f.samp)}${opt('laku','Sampel menghasilkan order',f.samp)}${opt('nol','Sampel tanpa order',f.samp)}${opt('boleh','Boleh sampel lagi (>'+ROI_MIN+'×)',f.samp)}${opt('belum10','Pernah sampel, belum >'+ROI_MIN+'×',f.samp)}${opt('blk','Diblokir dari sampel',f.samp)}</select>
    <select id="${which}-tipe" aria-label="Tipe akun" class="${f.tipe?'act':''}">${opt('','Semua tipe',f.tipe)}${tipes.map(t=>opt(t,t,f.tipe)).join('')}</select>
    <select id="${which}-st" aria-label="Status" class="${f.st?'act':''}">${opt('','Semua status',f.st)}${STAT_ALL().map(s=>opt(s,s,f.st)).join('')}</select>
    <select id="${which}-resp" aria-label="Respon" class="${f.resp?'act':''}">${opt('','Semua respon',f.resp)}${opt('(kosong)','Respon belum diisi',f.resp)}${RESP.map(s=>opt(s,s,f.resp)).join('')}</select>
    <label class="chk"><input type="checkbox" id="${which}-due"${f.due?' checked':''}> Perlu follow-up</label>
    <label class="chk"><input type="checkbox" id="${which}-p5"${f.p5?' checked':''}> Tampilkan P5 (tidak perlu dihubungi)</label>
    ${nAct ? `<button class="btn sm" id="${which}-reset">Hapus ${nAct} filter</button>` : ''}
  </div>
  <div class="filters">
    <span class="flabel">Urutkan</span>
    <select id="${which}-sort" aria-label="Urutkan menurut">${sortOpts(defs, f.sort)}</select>
    <button class="btn sm" id="${which}-dir" aria-label="Balik urutan">${dir === 'asc' ? '▲ ' + SORT_TXT[sd.t][1] : '▼ ' + SORT_TXT[sd.t][0]}</button>
    <span class="count">${nf.format(list.length)} dari ${nf.format(rows.length)} ${isTT?'kreator':'affiliate'} · klik judul kolom untuk mengurutkan, klik baris untuk mencatat</span>
  </div>
  <div class="tscroll"><table>
    <thead><tr>${th('pr','Prio')}${th('u', isTT?'Username':'Affiliate')}<th>Tipe</th>${th('okt',mLbl,'num')}${th('tot',tLbl,'num')}${th('bln','Bulan aktif','num')}${th('sn','Sampel (all time)','num')}${th('sroi','Efektivitas sampel (all time)','num')}<th>${aksiLbl()}</th>${th('st','Status')}${th('resp','Respon')}${th('last','Terakhir dihubungi')}</tr></thead>
    <tbody>${slice.length ? slice.map((r,i) => `<tr class="click" tabindex="0" data-i="${f.page*PAGE+i}">
      <td>${prioChip(r.pr)}</td>
      <td class="u">${esc(r.u)}${!isTT && r.nama && r.nama !== r.u ? `<small>${esc(r.nama)}</small>` : ''}${fuOf(r)?.kontak ? `<small class="kt">☎ ${esc(fuOf(r).kontak)}</small>`:''}</td>
      <td class="t">${tipeR(r)}</td>
      <td class="num">${rpShort(r.okt)}</td><td class="num">${rpShort(r.tot)}</td><td class="num">${blnCell(r)}</td><td class="num wrapn">${sampCell(r)}</td><td class="num wrapn">${hasilCell(r)}</td>
      ${aksiTd(r)}
      <td>${statChip(dispStatus(r))}</td>
      <td>${esc(fuOf(r)?.respon || '') || '<span class="muted">–</span>'}</td>
      <td>${lastCell(r)}</td></tr>`).join('') : `<tr><td colspan="12" class="muted">Tidak ada yang cocok dengan filter ini.</td></tr>`}</tbody>
  </table></div>
  <div class="pager"><span>Halaman ${f.page+1} dari ${pages}</span><span class="legend"><span class="chip ag">Agency/Platform</span> = kumpulan banyak kreator, data tidak bisa dirinci</span><span class="btns">
    <button class="btn sm" id="${which}-prev"${f.page===0?' disabled':''}>Sebelumnya</button>
    <button class="btn sm" id="${which}-next"${f.page>=pages-1?' disabled':''}>Berikutnya</button></span></div>`;
  const bind = (id, key, ev='change', get = el => el.value) => { const el = document.getElementById(which+'-'+id); el.addEventListener(ev, () => { f[key] = get(el); f.page = 0; saveFilters(); rerenderSoon(); }); };
  bind('q','q','input'); bind('pr','pr'); bind('tipe','tipe'); bind('st','st'); bind('resp','resp'); bind('kontak','kontak'); bind('samp','samp'); bind('jual','jual'); bind('due','due','change', el => el.checked); bind('p5','p5','change', el => el.checked);
  const setSort = key => { if (f.sort === key) f.dir = (dir === 'asc' ? 'desc' : 'asc'); else { f.sort = key; f.dir = ''; } f.page = 0; saveFilters(); render(); };
  document.getElementById(which+'-sort').addEventListener('change', e => { f.sort = e.target.value; f.dir = ''; f.page = 0; saveFilters(); render(); });
  document.getElementById(which+'-dir').onclick = () => { f.dir = dir === 'asc' ? 'desc' : 'asc'; f.page = 0; saveFilters(); render(); };
  view.querySelectorAll('button.sorth').forEach(b => b.onclick = () => { setSort(b.dataset.sort); const nb = view.querySelector(`button.sorth[data-sort="${b.dataset.sort}"]`); if (nb) nb.focus(); });
  const rs = document.getElementById(which+'-reset'); if (rs) rs.onclick = () => { FILTER_KEYS.forEach(k => f[k] = k === 'due' ? false : ''); f.page = 0; saveFilters(); render(); };
  document.getElementById(which+'-prev').onclick = () => { f.page--; render(); window.scrollTo(0,0); };
  document.getElementById(which+'-next').onclick = () => { f.page++; render(); window.scrollTo(0,0); };
  document.getElementById(which+'-xl').onclick = exportXlsx;
  view.querySelectorAll('tr.click').forEach(tr => { const open = () => openDrawer(list[+tr.dataset.i]); tr.addEventListener('click', open); tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }); });
}

/* ---------- database affiliate (TikTok + Shopee) ---------- */
const halOf = r => ((D.HAL && D.HAL.m[r.k === 'sh' ? 'S' : 'T']) || {})[r.u] || '';
const liveKind = r => r.k === 'tt' ? (r.live >= 5 ? 'rutin' : r.live >= 1 ? 'pernah' : '') : (r.ch === 'Shopeelive-Shopee' ? 'shlive' : '');
const liveChip = r => { const k = liveKind(r); if (!k) return '';
  const t = k === 'rutin' ? `LIVE rutin · ${r.live} sesi` : k === 'pernah' ? `Pernah LIVE · ${r.live} sesi` : 'Shopee Live';
  return ` <span class="chip live-${k}" title="${k === 'shlive' ? 'Penjualan paling banyak lewat Shopee Live' : 'Jumlah sesi LIVE yang menampilkan produk JustFluff, Mei–21 Okt'}">${t}</span>`; };
const tokoOk = r => { if (!S.dbtoko) return true; const [pl, br] = S.dbtoko.split('|'); return (pl === 'TikTok' ? r.k === 'tt' : r.k === 'sh') && String(r.cat || '').includes(br); };
const dbRows = () => (S.dbpl === 'TikTok' ? TT : S.dbpl === 'Shopee' ? SH : TT.concat(SH)).filter(tokoOk);
const dbF = () => S.dbpl === 'Shopee' ? S.f.shopee : S.f.tiktok;
function dbDefs(){
  const d = sortDefs('tiktok');
  d.okt.lbl = 'GMV 30 hari terakhir (kotor)'; delete d.tot;
  SH_M.forEach((m,i) => { if (d['m'+i]) d['m'+i].lbl = 'GMV ' + m + ' (kotor TikTok / bersih Shopee)'; });
  d.gk = {lbl:'GMV kotor', fn:r=>r.gk, t:'num', dir:'desc'};
  d.gb = {lbl:'GMV bersih', fn:r=>r.gb, t:'num', dir:'desc'};
  d.gx = {lbl:'GMV batal/retur', fn:r=>r.gx, t:'num', dir:'desc'};
  d.gxp = {lbl:'Porsi batal/retur', fn:r=>r.gk ? r.gx/r.gk : null, t:'num', dir:'desc'};
  d.vid = {lbl:'Jumlah video (TikTok)', fn:r=>r.k==='tt'?r.vid:null, t:'num', dir:'desc'};
  d.live = {lbl:'Jumlah sesi LIVE (TikTok)', fn:r=>r.k==='tt'?r.live:null, t:'num', dir:'desc'};
  delete d.gagal;
  d.pb = {lbl:'Pembeli baru (Shopee)', fn:r=>r.k==='sh'?r.pb:null, t:'num', dir:'desc'};
  return d;
}
function dbFiltered(){
  const f = dbF(), q = f.q.trim().toLowerCase(), save = S.f.__tmp;
  S.f.__db = f;
  const rows = dbRows();
  const keep = r => {
    if (q && !(r.u.toLowerCase().includes(q) || (r.nama||'').toLowerCase().includes(q) || (fuOf(r)?.kontak||'').toLowerCase().includes(q))) return false;
    if (f.pr && String(r.pr) !== f.pr) return false;
    if (f.tipe && r.tipe !== f.tipe) return false;
    if (f.st && dispStatus(r) !== f.st) return false;
    if (f.resp === '(kosong)' ? !!fuOf(r)?.respon : (f.resp && (fuOf(r)?.respon||'') !== f.resp)) return false;
    if (f.kontak === 'ada' && !hasPhone(r)) return false;
    if (f.kontak === 'lain' && (hasPhone(r) || !fuOf(r)?.kontak)) return false;
    if (f.kontak === 'belum' && hasPhone(r)) return false;
    if (f.samp) { const st = sampStat(r);
      if (f.samp === 'ya' && !st.n) return false;
      if (f.samp === 'tidak' && st.n) return false;
      if (f.samp === 'laku' && !(st.has && st.ord)) return false;
      if (f.samp === 'nol' && !(st.has && !st.ord)) return false;
      if (f.samp === 'blk' && !st.blk) return false;
      if (f.samp === 'boleh' && !(st.n && sampOk(st))) return false;
      if (f.samp === 'belum10' && !(st.n && !st.blk && !sampOk(st))) return false; }
    const reak = r.cat === 'Aktif Mei–Jul, belum jualan Agu–Okt';
    if (f.jual === 'reak' ? !reak : (f.jual !== 'semua' && f.jual !== 'nolj' && reak)) return false;
    if (!f.p5 && !f.pr && r.pr === 5) return false;
    if (f.jual === 'nolj' && r.tot > 0) return false;
    if (f.jual === 'okt' && !(r.okt > 0)) return false;
    if (f.jual === 'tidakokt' && r.okt > 0) return false;
    if (f.due && !needsFU(r)) return false;
    if (f.akt) { const k = liveKind(r);
      if (f.akt === 'live' && !k) return false;
      if (f.akt === 'rutin' && k !== 'rutin') return false;
      if (f.akt === 'pernah' && k !== 'pernah') return false;
      if (f.akt === 'shlive' && k !== 'shlive') return false;
      if (f.akt === 'video' && k) return false; }
    if (f.akt === 'haluan' && !halOf(r)) return false;
    if (f.akt === 'andalan' && !andalan(r)) return false;
    return true;
  };
  let out = rows.filter(keep);
  const defs = dbDefs(), sd = defs[f.sort] || defs.pr, dir = (f.dir || sd.dir) === 'asc' ? 1 : -1;
  if (f.sort !== 'pr' || dir !== 1) out = out.slice().sort((a,b) => {
    const x = sd.fn(a), y = sd.fn(b), xn = x === null || x === undefined, yn = y === null || y === undefined;
    if (xn || yn) return xn === yn ? 0 : (xn ? 1 : -1);
    return x < y ? -dir : x > y ? dir : 0;
  });
  return out;
}
function renderDb(){
  const f = dbF(), rows = dbRows(), W = 'db';
  const defs = dbDefs(); if (!defs[f.sort]) { f.sort = 'pr'; f.dir = ''; }
  const sd = defs[f.sort], dir = f.dir || sd.dir;
  const tipes = [...new Set(rows.map(r => r.tipe))];
  const list = dbFiltered(), pages = Math.max(1, Math.ceil(list.length / PAGE));
  if (f.page >= pages) f.page = Math.max(0, pages - 1);
  const slice = list.slice(f.page*PAGE, f.page*PAGE + PAGE);
  const nAct = activeFilters(f);
  const th = (key, label, cls='') => { const on = f.sort === key; const arrow = on ? (dir === 'asc' ? '▲' : '▼') : '↕'; const G_ = GLOS_AFF_F(), gl = G_[label] ? `<i class="ii" title="${esc(G_[label])}">i</i>` : '';
    label = label + gl;
    return `<th class="${cls}" aria-sort="${on ? (dir==='asc'?'ascending':'descending') : 'none'}"><button class="sorth${on?' on':''}" data-sort="${key}" title="Urutkan menurut ${esc(defs[key].lbl)}">${label}<span class="arr" aria-hidden="true">${arrow}</span></button></th>`; };
  const tot = k => list.reduce((a,r) => a + (r[k]||0), 0);
  const est = r => r.gest ? '<sup title="perkiraan">*</sup>' : '';
  view.innerHTML = `${bannerHtml()}
  <div class="pcs">${[1,2,3,4,5].map(p => { const rr = rows.filter(r => r.pr === p); return `<button class="pc p${p}${String(f.pr)===String(p)?' sel':''}" data-p="${p}"><span class="pt">P${p} · ${esc(PRIO[p])}</span><b>${nf.format(rr.length)}</b><span>akun · ${rpShort(rr.reduce((a,r)=>a+(r.gb||0),0))}</span></button>`; }).join('')}</div>
  <div class="toolbar">
    <div class="grow"><input type="search" id="${W}-q" placeholder="Cari username, nama atau kontak" value="${esc(f.q)}" aria-label="Cari"></div>
    <button class="btn" id="${W}-xl">Download Excel</button>
  </div>
  <div class="filters">
    <span class="flabel">Filter</span>
    <select id="${W}-pr" aria-label="Prioritas" class="${f.pr?'act':''}">${opt('','Semua prioritas',f.pr)}${[1,2,3,4,5].map(p=>opt(p,'P'+p+' · '+PRIO[p],f.pr)).join('')}</select>
    <select id="${W}-jual" aria-label="Penjualan" class="${f.jual?'act':''}">${opt('','Jualan: ada penjualan 90 hari terakhir',f.jual)}${opt('okt','Ada jualan bulan terakhir',f.jual)}${opt('tidakokt','Belum jualan bulan terakhir',f.jual)}${opt('nolj','Belum ada penjualan (penerima sampel)',f.jual)}${opt('semua','Semua termasuk reaktivasi',f.jual)}</select>
    <details class="more"${['kontak','samp','akt','tipe','st','resp','due'].some(k => f[k]) ? ' open' : ''}><summary class="btn sm">⚙ Filter lainnya${(n => n ? ' (' + n + ' aktif)' : '')(['kontak','samp','akt','tipe','st','resp','due'].filter(k => f[k]).length)}</summary><div class="morebox">
    <select id="${W}-kontak" aria-label="Kontak" class="${f.kontak?'act':''}">${opt('','Kontak: semua',f.kontak)}${opt('belum','Belum ada no. HP',f.kontak)}${opt('ada','Sudah ada no. HP',f.kontak)}${opt('lain','Kontak lain (email/DM), tanpa no. HP',f.kontak)}</select>
    <select id="${W}-samp" aria-label="Sampel" class="${f.samp?'act':''}">${opt('','Sampel: semua',f.samp)}${opt('ya','Pernah dapat sampel',f.samp)}${opt('tidak','Belum pernah dapat sampel',f.samp)}${opt('laku','Sampel menghasilkan order',f.samp)}${opt('nol','Sampel tanpa order',f.samp)}${opt('boleh','Boleh sampel lagi (>'+ROI_MIN+'×)',f.samp)}${opt('belum10','Pernah sampel, belum >'+ROI_MIN+'×',f.samp)}${opt('blk','Diblokir dari sampel',f.samp)}</select>
    <select id="${W}-akt" aria-label="Aktivitas LIVE" class="${f.akt?'act':''}">${opt('','Aktivitas: semua',f.akt||'')}${opt('live','Semua yang LIVE',f.akt||'')}${opt('rutin','LIVE rutin (≥5 sesi, TikTok)',f.akt||'')}${opt('pernah','Pernah LIVE (1–4 sesi, TikTok)',f.akt||'')}${opt('shlive','Shopee Live',f.akt||'')}${opt('video','Video saja (tanpa LIVE)',f.akt||'')}</select>
    <select id="${W}-tipe" aria-label="Tipe akun" class="${f.tipe?'act':''}">${opt('','Semua tipe',f.tipe)}${tipes.map(t=>opt(t,t,f.tipe)).join('')}</select>
    <select id="${W}-st" aria-label="Status" class="${f.st?'act':''}">${opt('','Semua status',f.st)}${STAT_ALL().map(s=>opt(s,s,f.st)).join('')}</select>
    <select id="${W}-resp" aria-label="Respon" class="${f.resp?'act':''}">${opt('','Semua respon',f.resp)}${opt('(kosong)','Respon belum diisi',f.resp)}${RESP.map(s=>opt(s,s,f.resp)).join('')}</select>
    <label class="chk"><input type="checkbox" id="${W}-due"${f.due?' checked':''}> Perlu follow-up</label>
    </div></details>
    <label class="chk"><input type="checkbox" id="${W}-p5"${f.p5?' checked':''}> Tampilkan P5 (tidak perlu dihubungi)</label>
    ${nAct ? `<button class="btn sm" id="${W}-reset">Hapus ${nAct} filter</button>` : ''}
  </div>
  <div class="filters">
    <span class="flabel">Urutkan</span>
    <select id="${W}-sort" aria-label="Urutkan menurut">${sortOpts(defs, f.sort)}</select>
    <button class="btn sm" id="${W}-dir" aria-label="Balik urutan">${dir === 'asc' ? '▲ ' + SORT_TXT[sd.t][1] : '▼ ' + SORT_TXT[sd.t][0]}</button>
    <span class="count">${nf.format(list.length)} dari ${nf.format(rows.length)} akun · GMV kotor ${rpShort(tot('gk'))} · bersih ${rpShort(tot('gb'))} · batal/retur ${rpShort(tot('gx'))}</span>
  </div>
  <div class="tscroll"><table>
    <thead><tr>${th('pr','Prio')}${th('u','Username')}<th>Tipe</th>${th('okt','GMV 30 hari terakhir','num')}${th('gb','GMV bersih','num')}${th('bln','Bulan aktif','num')}${th('sn','Sampel (all time)','num')}${th('sroi','Efektivitas sampel (all time)','num')}<th>${aksiLbl()}</th>${th('st','Status')}${th('resp','Respon')}${th('last','Terakhir dihubungi')}</tr></thead>
    <tbody>${slice.length ? slice.map((r,i) => `<tr class="click" tabindex="0" data-i="${f.page*PAGE+i}">
      <td>${prioChip(r.pr)}</td>
      <td class="u">${esc(r.u)}${liveChip(r)}${andalan(r) ? ' <span class="chip p1" title="Kreator andalan: jualan ≥5 dari 6 bulan, GMV bersih ≥Rp3 jt, masih jualan bulan terakhir. Pertahankan dengan komisi khusus/prioritas produk baru">Andalan</span>' : ''}${halOf(r) ? ` <span class="chip" title="Peserta acara Haluan ClickConnect Semarang (${esc(halOf(r))}), dapat 1 sampel">Haluan</span>` : ''}${r.k==='sh' && r.nama && r.nama !== r.u ? `<small>${esc(r.nama)}</small>` : ''}${ptags(r)}${fuOf(r)?.kontak ? `<br>${kontakHtml(fuOf(r).kontak, r)}`:''}</td>
      <td class="t">${tipeR(r)}</td>
      <td class="num">${rpShort(r.okt)}</td><td class="num"><b>${rpShort(r.gb)}</b>${est(r)}<small class="${r.gk && r.gx/r.gk>=.4?'late':'muted'}">kotor ${rpShort(r.gk)} · batal ${r.gk ? pct(r.gx/r.gk) : '0%'}</small></td>
      <td class="num">${blnCell(r)}</td><td class="num wrapn">${sampCell(r)}</td><td class="num wrapn">${hasilCell(r)}</td>
      ${aksiTd(r)}
      <td>${statChip(dispStatus(r))}</td>
      <td>${esc(fuOf(r)?.respon || '') || '<span class="muted">–</span>'}</td>
      <td>${lastCell(r)}</td></tr>`).join('') : `<tr><td colspan="12" class="muted">Tidak ada yang cocok dengan filter ini.</td></tr>`}</tbody>
  </table></div>
  <div class="pager"><span>Halaman ${f.page+1} dari ${pages}</span><span class="btns">
    <button class="btn sm" id="${W}-prev"${f.page===0?' disabled':''}>Sebelumnya</button>
    <button class="btn sm" id="${W}-next"${f.page>=pages-1?' disabled':''}>Berikutnya</button></span></div>
  <details class="srcnote"><summary class="note">Sumber data <i class="ii">i</i></summary>  <p class="note">GMV kotor, bersih dan batal/retur: periode Mei–21 Okt. <b>TikTok</b>: GMV kotor dari laporan performa kreator; bersih dan batal/retur dihitung dari porsi order gagal tiap kreator di export pesanan (Mei–Sep). <b>Shopee</b>: GMV bersih = omzet tanpa pesanan batal (validasi komisi Mei–Jul, AMS Agu–Okt); batal hanya bisa dihitung untuk Agu–Okt. <sup>*</sup> = perkiraan: TikTok memakai rata-rata 36% order gagal karena kreator tidak punya data order sendiri; Shopee berarti batal Mei–Jul tidak tercatat. Efektivitas sampel dihitung dari GMV bersih. <span class="chip ag">Agency/Platform</span> = kumpulan banyak kreator, data tidak bisa dirinci.</p></details>`;
  const np = document.getElementById('navplat');
  if (np) { np.innerHTML = `<span class="seg" role="radiogroup" aria-label="Platform">${[['','Semua',TT.length+SH.length],['TikTok','TikTok',TT.length],['Shopee','Shopee',SH.length]].map(([p,l,n]) => `<button class="db-pl${(S.dbpl||'')===p?' on':''}" data-pl="${p}" role="radio" aria-checked="${(S.dbpl||'')===p}">${p ? `<i class="pdot ${p==='TikTok'?'tt':'sh'}"></i>` : ''}${l} <span class="n">${nf.format(n)}</span></button>`).join('')}</span>`;
    if (D.BRANDS && D.BRANDS.length > 1) { const opts = ['Shopee','TikTok'].flatMap(pl => D.BRANDS.map(b => [pl + '|' + b, pl + ' · ' + b]));
      np.insertAdjacentHTML('beforeend', `<select class="tokosel${S.dbtoko ? ' act' : ''}" aria-label="Toko"><option value="">Toko: Semua toko</option>${opts.map(([v, l]) => `<option value="${esc(v)}"${S.dbtoko === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`);
      np.querySelector('.tokosel').onchange = e => { S.dbtoko = e.target.value; const f = dbF(); f.page = 0; saveFilters(); render(); }; }
    np.querySelectorAll('button.db-pl').forEach(b => b.onclick = () => { S.dbpl = b.dataset.pl; saveFilters(); render(); }); }
  view.querySelectorAll('.pcs button.pc').forEach(b => b.onclick = () => { f.pr = String(f.pr) === b.dataset.p ? '' : b.dataset.p; f.page = 0; saveFilters(); render(); });
  const bind = (id, key, ev='change', get = el => el.value) => { const el = document.getElementById(W+'-'+id); el.addEventListener(ev, () => { f[key] = get(el); f.page = 0; saveFilters(); rerenderSoon(); }); };
  bind('q','q','input'); bind('pr','pr'); bind('tipe','tipe'); bind('st','st'); bind('resp','resp'); bind('kontak','kontak'); bind('samp','samp'); bind('jual','jual'); bind('due','due','change', el => el.checked); bind('p5','p5','change', el => el.checked); bind('akt','akt');
  const setSort = key => { if (f.sort === key) f.dir = (dir === 'asc' ? 'desc' : 'asc'); else { f.sort = key; f.dir = ''; } f.page = 0; saveFilters(); render(); };
  document.getElementById(W+'-sort').addEventListener('change', e => { f.sort = e.target.value; f.dir = ''; f.page = 0; saveFilters(); render(); });
  document.getElementById(W+'-dir').onclick = () => { f.dir = dir === 'asc' ? 'desc' : 'asc'; f.page = 0; saveFilters(); render(); };
  view.querySelectorAll('button.sorth').forEach(b => b.onclick = () => { setSort(b.dataset.sort); const nb = view.querySelector(`button.sorth[data-sort="${b.dataset.sort}"]`); if (nb) nb.focus(); });
  const rs = document.getElementById(W+'-reset'); if (rs) rs.onclick = () => { FILTER_KEYS.forEach(k => f[k] = k === 'due' ? false : ''); f.page = 0; saveFilters(); render(); };
  document.getElementById(W+'-prev').onclick = () => { f.page--; render(); window.scrollTo(0,0); };
  document.getElementById(W+'-next').onclick = () => { f.page++; render(); window.scrollTo(0,0); };
  document.getElementById(W+'-xl').onclick = exportXlsx;
  view.querySelectorAll('tr.click').forEach(tr => { const open = () => openDrawer(list[+tr.dataset.i]); tr.addEventListener('click', e => { if (e.target.closest('a')) return; open(); }); tr.addEventListener('keydown', e => { if (e.target.closest('a')) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }); });
}

/* ---------- agency ---------- */
const agPl = r => r.grp === 'A' ? ['Shopee'] : [r.att ? 'TikTok' : null, r.ash ? 'Shopee' : null].filter(Boolean);
const plChip = p => `<span class="chip ${p === 'TikTok' ? 'pl-tt' : 'pl-sh'}">${p}</span>`;
function appendAgency(which){
  const pl = which === 'tiktok' ? 'TikTok' : which === 'shopee' ? 'Shopee' : '';
  if (S.f.agency.tab !== which) { S.f.agency.tab = which; S.f.agency.pl = pl; }
  const nPl = [...AGA, ...AGB].filter(r => !pl || agPl(r).includes(pl)).length;
  const box = document.createElement('details'); box.className = 'panel agbox'; box.open = !!S.f.agency.open;
  box.innerHTML = `<summary><h2 style="display:inline">Agency &amp; jaringan affiliate</h2> <span class="muted">· ${nPl} ${pl ? 'yang punya akun ' + pl : 'agency dan jaringan, TikTok &amp; Shopee'}</span></summary><div id="agency-host" style="display:flex;flex-direction:column;gap:14px;margin-top:12px"></div>`;
  view.append(box);
  box.addEventListener('toggle', () => { S.f.agency.open = box.open; });
  renderAgency(box.querySelector('#agency-host'));
}
function renderAgency(host){
  const q = S.f.agency.q.trim().toLowerCase();
  const match = r => !q || r.nama.toLowerCase().includes(q) || (r.mem||[]).some(m => m.u.toLowerCase().includes(q)) || (r.att||'').toLowerCase().includes(q) || (r.ash||'').toLowerCase().includes(q) || (fuOf(r)?.kontak||'').toLowerCase().includes(q);
  const pf = S.f.agency.pl;
  const A = AGA.filter(match).filter(r => !pf || agPl(r).includes(pf)), B = AGB.filter(match).filter(r => !pf || agPl(r).includes(pf));
  host.innerHTML = `
  <div class="filters"><span class="flabel">Platform</span>${['', 'TikTok', 'Shopee'].map(p => `<button class="btn sm ag-pl${pf===p?' pri':''}" data-pl="${p}">${p || 'Semua'}</button>`).join('')}
    <span class="legend">${plChip('TikTok')} akun di TikTok · ${plChip('Shopee')} akun di Shopee</span></div>
  <div class="toolbar"><div class="grow"><input type="search" id="agency-q" placeholder="Cari agency, jaringan, atau username anggota" value="${esc(S.f.agency.q)}" aria-label="Cari"></div>
    <button class="btn" id="agency-xl">Download Excel</button></div>
  <section class="panel">
    <h2>A. Agency/MCN Shopee dengan anggota yang sudah jualan</h2>
    <p class="note">Dari kolom "MCN Terhubung" di laporan konversi Shopee (1 Agu–12 Okt). Omzet anggota dihitung sampai 21 Okt. Data TikTok tidak mencatat agency/MCN kreator. Klik baris untuk melihat anggota dan mencatat follow-up.</p>
    <div class="tscroll"><table><thead><tr><th>Prio</th><th>Platform</th><th>Agency / MCN</th><th class="num">Anggota jualan</th><th class="num">Omzet anggota</th><th class="num">Pesanan berhasil</th><th class="num">Batal</th><th>Anggota terlaris</th><th>Saran aksi</th><th>Status</th><th>Terakhir dihubungi</th></tr></thead>
    <tbody>${A.map(r => `<tr class="click" tabindex="0" data-g="A" data-n="${esc(r.nama)}"><td>${prioChip(r.pr)}</td><td>${agPl(r).map(plChip).join(' ')}</td><td class="u">${esc(r.nama)}${fuOf(r)?.kontak?`<small>${esc(fuOf(r).kontak)}</small>`:''}</td><td class="num">${r.mem.length}</td><td class="num">${rpShort(r.om)}</td><td class="num">${nf.format(r.ok)}</td><td class="num ${r.batal>=.5?'late':''}">${pct(r.batal)}</td><td>${esc(r.top)}</td>${aksiTd(r)}<td>${statChip(dispStatus(r))}</td><td>${lastCell(r)}</td></tr>`).join('') || `<tr><td colspan="11" class="muted">${pf === 'TikTok' ? 'Laporan TikTok tidak mencatat agency/MCN kreator, jadi bagian ini hanya berisi data Shopee.' : 'Tidak ada yang cocok.'}</td></tr>`}</tbody></table></div>
  </section>
  <section class="panel">
    <h2>B. Jaringan affiliate / platform (TikTok &amp; Shopee)</h2>
    <p class="note">Akun yang jualan atas nama banyak kreator, jadi datanya tidak bisa dirinci per kreator. YouTube Shopping dan Shopee Media Network tidak dimasukkan karena program milik platform. GMV TikTok masih kotor.</p>
    <div class="tscroll"><table><thead><tr><th>Prio</th><th>Platform</th><th>Jaringan</th><th class="num">GMV TikTok</th><th class="num">Omzet Shopee</th><th class="num">Total</th><th>Akun</th><th>Saran aksi</th><th>Status</th><th>Terakhir dihubungi</th></tr></thead>
    <tbody>${B.map(r => `<tr class="click" tabindex="0" data-g="B" data-n="${esc(r.nama)}"><td>${prioChip(r.pr)}</td><td style="white-space:nowrap">${agPl(r).map(plChip).join(' ')}</td><td class="u">${esc(r.nama)}${r.cat?`<small>${esc(r.cat)}</small>`:''}</td><td class="num">${rpShort(r.gt)}</td><td class="num">${rpShort(r.gs)}</td><td class="num"><b>${rpShort(r.tot)}</b></td><td style="min-width:180px;font-size:12.5px">${esc([r.att,r.ash].filter(Boolean).join(', '))}</td>${aksiTd(r)}<td>${statChip(dispStatus(r))}</td><td>${lastCell(r)}</td></tr>`).join('') || `<tr><td colspan="10" class="muted">Tidak ada yang cocok.</td></tr>`}</tbody></table></div>
  </section>`;
  host.querySelectorAll('button.ag-pl').forEach(b => b.onclick = () => { S.f.agency.pl = b.dataset.pl; rerenderSoon(); });
  const qi = document.getElementById('agency-q'); qi.addEventListener('input', () => { S.f.agency.q = qi.value; rerenderSoon(); });
  document.getElementById('agency-xl').onclick = exportXlsx;
  host.querySelectorAll('tr.click').forEach(tr => { const r = (tr.dataset.g === 'A' ? AGA : AGB).find(x => x.nama === tr.dataset.n); const open = () => openDrawer(r);
    tr.addEventListener('click', open); tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }); });
}

/* ---------- drawer ---------- */
const root = document.getElementById('drawer-root');
let lastFocus = null;
function detailHtml(r){
  if (r.k === 'tt' || r.k === 'sh') {
    const months = r.k === 'tt' ? TT_M : SH_M, mx = Math.max(1, ...r.g);
    return `<div class="kv">
      <div><span>Prioritas</span><b>${prioChip(r.pr)}</b></div>
      <div><span>Sumber penjualan terbesar</span><b>${tipeR(r)}</b></div>
      <div><span>GMV kotor Mei–Okt${r.gest ? '*' : ''}</span><b>${rp(r.gk)}</b></div>
      <div><span>GMV bersih${r.gest ? '*' : ''}</span><b>${rp(r.gb)}</b></div>
      <div><span>GMV batal/retur${r.gest ? '*' : ''}</span><b>${rp(r.gx)}${r.gk ? ' (' + pct(r.gx / r.gk) + ')' : ''}</b></div>
      <div><span>${r.k==='tt'?'GMV Mei–Okt':'Omzet Mei–Okt'}</span><b>${rp(r.tot)}</b></div>
      ${r.k==='tt' ? `<div><span>Video / LIVE</span><b>${nf.format(r.vid)} / ${nf.format(r.live)}</b></div><div class="noshare"><span>Porsi order gagal</span><b>${pct(r.gagal)}</b></div>`
                   : `<div><span>Channel utama</span><b>${esc(r.ch||'–')}</b></div><div><span>Pembeli baru</span><b>${nf.format(r.pb)}</b></div><div class="noshare"><span>Porsi batal</span><b>${pct(r.batal)}</b></div>`}
      ${(() => { const st = sampStat(r), roi = sampRoi(st); return `<div><span>Sampel diterima</span><b>${st.n ? st.n + '×' + (st.last ? ' · terakhir ' + esc(fdate(st.last)) : '') : 'Belum pernah'}</b></div>
      <div><span>Efektivitas sampel</span><b>${!st.n ? '–' : !st.has ? 'belum ada data penjualan' : roi == null ? 'biaya sampel Rp0' : `${roi.toLocaleString('id-ID',{maximumFractionDigits:1})}× biaya`}</b></div>
      ${st.has ? `<div><span>GMV sejak sampel pertama</span><b>${st.gmv ? rp(st.gmv) : 'Rp0'}</b></div>` : ''}
      ${st.has ? `<div><span>Order sejak sampel pertama</span><b>${nf.format(st.ord)}</b></div><div><span>Total biaya semua sampel</span><b>${rp(st.biaya)}</b></div><div><span>GMV sebelum sampel pertama</span><b>${st.bef ? rp(st.bef) : 'Rp0'}</b></div>` : ''}
      ${st.n ? `<div><span>Boleh dapat sampel lagi?</span><b>${st.blk ? '<span class="chip s-bad">Tidak, diblokir</span>' : sampOk(st) ? '<span class="chip s-ok">Ya, (GMV sebelum + sesudah) &gt;10× biaya</span>' : '<span class="chip s-warn">Belum, perlu &gt;10× biaya</span>'}</b></div>` : ''}`; })()}
      ${r.cat ? `<div style="grid-column:1/-1"><span>Catatan data</span><b>${esc(r.cat)}</b></div>`:''}
    </div>
    <div><h3 style="margin-bottom:8px">${r.k==='tt'?'GMV':'Omzet'} per bulan</h3><div class="months">${months.map((m,i)=>`<span>${m}</span><div class="bar" style="width:${Math.max(1,r.g[i]/mx*100)}%;opacity:${r.g[i]?1:.25}"></div><span>${rpShort(r.g[i])}</span>`).join('')}</div></div>
    <div class="callout"><b>${aksiLbl()}</b>${esc(RO() ? kerjaTxt(r) : r.aksi)}</div>`;
  }
  if (r.grp === 'A') return `<div class="kv"><div><span>Prioritas</span><b>${prioChip(r.pr)}</b></div><div><span>Omzet anggota</span><b>${rp(r.om)}</b></div><div><span>Pesanan berhasil</span><b>${nf.format(r.ok)}</b></div><div class="noshare"><span>Porsi batal</span><b>${pct(r.batal)}</b></div></div>
    <div class="callout"><b>${aksiLbl()}</b>${esc(RO() ? kerjaTxt(r) : r.aksi)}</div>
    <div><h3 style="margin-bottom:8px">Anggota yang sudah jualan (${r.mem.length})</h3><div class="tscroll"><table class="mini"><thead><tr><th>Username Shopee</th><th class="num">Omzet</th><th class="num">Pesanan</th></tr></thead><tbody>
    ${r.mem.map(m => `<tr><td class="u">${esc(m.u)}${m.nama && m.nama!==m.u?`<small>${esc(m.nama)}</small>`:''}</td><td class="num">${rpShort(m.om)}</td><td class="num">${m.ok}/${m.all}</td></tr>`).join('')}</tbody></table></div></div>`;
  return `<div class="kv"><div><span>Prioritas</span><b>${prioChip(r.pr)}</b></div><div><span>GMV TikTok</span><b>${rp(r.gt)}</b></div><div><span>Omzet Shopee</span><b>${rp(r.gs)}</b></div><div><span>Total</span><b>${rp(r.tot)}</b></div></div>
    ${r.att?`<div><h3>Akun TikTok</h3><p>${esc(r.att)}</p></div>`:''}${r.ash?`<div><h3>Akun Shopee</h3><p>${esc(r.ash)}</p></div>`:''}${r.cat?`<p class="note">${esc(r.cat)}</p>`:''}
    <div class="callout"><b>${aksiLbl()}</b>${esc(RO() ? kerjaTxt(r) : r.aksi)}</div>`;
}
function openDrawer(r){
  if (!r) return;
  S.open = r; lastFocus = document.activeElement;
  const f = fuOf(r) || {}, ro = dbState !== 'ok';
  const title = r.k === 'ag' ? r.nama : r.u;
  const link = r.k === 'tt' ? `<a href="https://www.tiktok.com/@${encodeURIComponent(r.u)}" target="_blank" rel="noopener">Buka profil TikTok</a>` : (r.k==='sh' && r.nama ? `<span class="muted">${esc(r.nama)}</span>` : `<span class="muted">${r.grp==='A'?'Agency/MCN':'Jaringan affiliate'}</span>`);
  root.innerHTML = `<div class="scrim" id="scrim"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dtitle">
    <div class="dhead"><div><h2 id="dtitle">${esc(title)}</h2>${link}</div><button class="btn sm x" id="dclose">Tutup</button></div>
    <div class="dbody">
      ${detailHtml(r)}
      <div style="display:flex;flex-direction:column;gap:10px">
        <h3>Catatan follow-up</h3>
        ${ro ? `<div class="banner">${dbState==='wait'?'Catatan follow-up sedang dimuat…':'Catatan follow-up hanya bisa dibaca di tampilan ini.'}</div>` : ''}
        <form class="fu" id="fuform">
          <label class="full">${r.k==='ag'?'PIC / Kontak agency':'Kontak (WA/email)'}<input type="text" id="fu-kontak" value="${esc(f.kontak||'')}" placeholder="mis. 0812xxxx atau email">${waNum(f.kontak) ? `<span>${kontakHtml(f.kontak)}</span>` : ''}</label>
          <label>Tgl pertama dihubungi<input type="date" id="fu-tgl1" value="${esc(f.tgl1||'')}"></label>
          <label>Terakhir dihubungi<input type="date" id="fu-tglLast" value="${esc(f.tglLast||'')}"></label>
          <label>Respon<select id="fu-respon">${opt('','–',f.respon||'')}${RESP.map(s=>opt(s,s,f.respon||'')).join('')}</select></label>
          <label>Status<select id="fu-status">${STAT.map(s=>opt(s,s,f.status||'Belum dihubungi')).join('')}</select></label>
          <label class="full nextfu">Follow-up berikutnya *<span class="nfrow"><input type="date" id="fu-next" value="${esc(f.next||'')}"><button type="button" class="btn sm" data-add="1">+1 hari</button><button type="button" class="btn sm" data-add="3">+3 hari</button><button type="button" class="btn sm" data-add="7">+7 hari</button></span><small class="muted">Wajib diisi, kecuali status "Belum dihubungi" atau respon "Tidak tertarik" / "Akun/nomor tidak aktif".</small></label>
          <label class="full">Keterangan<textarea id="fu-ket" placeholder="Isi percakapan, janji posting, produk yang dikirim…">${esc(f.ket||'')}</textarea></label>
          <div class="fbar full">
            <button type="submit" class="btn pri" id="fu-save">Simpan</button>
            <button type="button" class="btn" id="fu-today">Dihubungi hari ini</button>
            ${r.k !== 'ag' ? `<button type="button" class="btn" id="fu-sampel">Input sampel</button>` : ''}
            <span class="saved" id="fu-meta"></span>
          </div>
        </form>
      </div>
    </div>
  </aside>`;
  const form = document.getElementById('fuform');
  if (ro) form.querySelectorAll('input,select,textarea,button').forEach(el => el.disabled = true);
  document.getElementById('dclose').onclick = closeDrawer;
  document.getElementById('scrim').onclick = closeDrawer;
  document.getElementById('fu-today').onclick = () => {
    const t = isoToday();
    document.getElementById('fu-tglLast').value = t;
    if (!document.getElementById('fu-tgl1').value) document.getElementById('fu-tgl1').value = t;
    const st = document.getElementById('fu-status'); if (st.value === 'Belum dihubungi') st.value = 'Sudah dihubungi';
    const rs = document.getElementById('fu-respon'); if (!rs.value) rs.value = 'Belum ada respon';
  };
  form.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { document.getElementById('fu-next').value = addDays(isoToday(), +b.dataset.add); });
  form.addEventListener('submit', e => { e.preventDefault(); saveFU(r); });
  const fs = document.getElementById('fu-sampel'); if (fs) { fs.disabled = false; fs.onclick = () => goInputSampel(r); }
  refreshDrawerMeta();
  document.getElementById('dclose').focus();
}
async function refreshDrawerMeta(){
  const el = document.getElementById('fu-meta'); if (!el || !S.open) return;
  const f = fuOf(S.open); if (!f || !f.updatedAt) { el.textContent = ''; return; }
  let who = '';
  if (f.by && userApi) { try { const ps = await userApi.profiles([f.by]); who = (ps && ps[f.by] && ps[f.by].name) || ''; } catch(e){} }
  const d = new Date(f.updatedAt);
  el.textContent = 'Terakhir disimpan ' + d.toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) + (who ? ' oleh ' + who : '');
}
function closeDrawer(){ S.open = null; root.innerHTML = ''; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.open) closeDrawer(); });

function toast(msg){ const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role','status'); t.textContent = msg; document.getElementById('aff-root').appendChild(t); setTimeout(() => t.remove(), 2400); }

async function saveFU(r){
  if (!db) return;
  const v = id => document.getElementById(id).value;
  const body = { key: String(r.key), kontak: v('fu-kontak').trim(), tgl1: v('fu-tgl1'), tglLast: v('fu-tglLast'), respon: v('fu-respon'), status: v('fu-status'), next: v('fu-next'), ket: v('fu-ket').trim(), updatedAt: new Date().toISOString() };
  const bebas = body.status === 'Belum dihubungi' || body.respon === 'Tidak tertarik' || body.respon === 'Akun/nomor tidak aktif';
  if (!body.next && !bebas) { toast('Isi tanggal follow-up berikutnya dulu.'); document.getElementById('fu-next').focus(); return; }
  if (me) body.by = me;
  const btn = document.getElementById('fu-save'); btn.disabled = true; btn.textContent = 'Menyimpan…';
  const id = docId(r.key);
  const prev = fuOf(r) || {};
  FU[r.k][id] = body; rerenderSoon();
  try {
    await db.collection(COLL[r.k]).doc(id).set(body);
    logFollowup(r, prev, body);
    if (body.status === 'Produk dikirim' && r.k !== 'ag') { toast('Tersimpan. Lengkapi data sampelnya.'); goInputSampel(r); }
    else { toast('Tersimpan'); closeDrawer(); }
  } catch (e) {
    let msg = 'Belum tersimpan. Coba simpan lagi.';
    if (e && e.code === 'quota_exceeded') msg = 'Penyimpanan penuh, catatan baru tidak bisa ditambah.';
    if (e && (e.code === 'revoked' || e.code === 'not_granted')) msg = 'Akses penyimpanan tidak tersedia di tampilan ini.';
    toast(msg); btn.disabled = false; btn.textContent = 'Simpan';
  }
}

async function markSampleSent(plat, user){
  const list = plat === 'Shopee' ? SH : TT;
  const u = String(user || '').toLowerCase().replace(/^@+/, '');
  const r = list.find(x => x.u.toLowerCase() === u);
  if (!r || !db) return false;
  const f = fuOf(r) || {};
  if (f.status === 'Produk dikirim' || f.status === 'Sudah posting') return true;
  const body = Object.assign({key:String(r.key), kontak:'', tgl1:'', tglLast:'', respon:'', ket:''}, f, {status:'Produk dikirim', updatedAt:new Date().toISOString()});
  if (me) body.by = me;
  const id = docId(r.key); FU[r.k][id] = body; rerenderSoon();
  try { await db.collection(COLL[r.k]).doc(id).set(body); logFollowup(r, f, body, 'otomatis dari input sampel'); } catch(e) {}
  return true;
}
function goInputSampel(r){
  closeDrawer();
  setTab('input'); window.scrollTo(0,0);
  if (window.__sampelPrefill) window.__sampelPrefill(r.k === 'sh' ? 'Shopee' : 'TikTok', r.u);
}

/* ---------- sampel per kreator ---------- */
const sampStat = r => {
  const st = window.__sampelStat ? window.__sampelStat(r.k === 'sh' ? 'Shopee' : 'TikTok', r.u) : null;
  return st || {n: r.samp ? 1 : 0, last: '', has: false, gmv: 0, biaya: 0, ord: 0, bef: 0, blk: false};
};
const sampRoi = st => st.has && st.biaya ? (st.gmv + st.bef) / st.biaya : null; // efektivitas = GMV sebelum + sesudah sampel pertama ÷ total biaya sampel
const ROI_MIN = (typeof window !== 'undefined' && window.AFF_ROI_MIN) || 10; // syarat finance: (GMV sebelum + sesudah sampel) harus > 10× total biaya sampel untuk dapat sampel lagi
const sampOk = st => !st.blk && (!st.n || (sampRoi(st) ?? 0) > ROI_MIN);
const sampCell = r => { const st = sampStat(r); if (!st.n) return '<span class="muted">Belum</span>';
  return `<b>${st.n}×</b>${st.last ? `<br><small class="muted">terakhir ${esc(fdate(st.last))}</small>` : ''}${st.blk ? '<br><span class="chip s-bad">Diblokir</span>' : sampOk(st) ? '<br><span class="chip s-ok">Boleh sampel lagi</span>' : `<br><span class="chip s-warn">Belum &gt;${ROI_MIN}×</span>`}`; };
const hasilCell = r => { const st = sampStat(r); if (!st.n) return '<span class="muted">–</span>';
  if (!st.has) return '<span class="muted">belum ada data penjualan</span><br><small class="muted">sampel baru dari form</small>';
  const roi = sampRoi(st);
  const tot = st.gmv + st.bef;
  return `<span class="${roi > ROI_MIN ? 'kt' : (tot ? '' : 'late')}"><b>${roi == null ? 'biaya Rp0' : roi.toLocaleString('id-ID',{maximumFractionDigits:1}) + '×'}</b> · ${tot ? rpShort(tot) : 'Rp0'}</span><br><small class="muted">sebelum ${rpShort(st.bef) === '–' ? 'Rp0' : rpShort(st.bef)} · sesudah ${rpShort(st.gmv) === '–' ? 'Rp0' : rpShort(st.gmv)} · biaya ${rpShort(st.biaya)}</small>`; };

/* ---------- log aktivitas ---------- */
const LOGTYPE = {kontak:'Kontak', followup:'Follow-up', status:'Status kreator', sampel:'Input sampel', sampel_hapus:'Hapus sampel', posting:'Status posting', blokir:'Blokir sampel'};
const LOG = {}; const LOGSUB = {}; const NAMES = {};
const platOf = r => r.k === 'tt' ? 'TikTok' : r.k === 'sh' ? 'Shopee' : 'Agency';
const wibDay = (d = new Date()) => new Date(d.getTime() + 7*3600e3).toISOString().slice(0,10);
async function myId(){ if (me) return me; if (userApi) { try { me = await userApi.id(); } catch(e){} } return me; }
async function logActivity(e){
  if (!db) return;
  try { const sv = JSON.parse(localStorage.getItem('jf-pic2') || 'null'); if (!sv || sv.day !== wibDay()) { PIC = ''; drawPic(); } } catch(err) {}
  if (!PIC) { toast('Pilih nama petugas di kanan atas supaya aktivitas tercatat atas namamu.'); picSel.classList.add('need'); }
  const uid = await myId(); if (!uid) return;
  const now = new Date();
  const entry = Object.assign({at: now.toISOString(), day: wibDay(now), by: uid, pic: PIC || ''}, e);
  try {
    await db.doc('jf_log/' + uid).set({last: entry.at});
    await db.collection('jf_log/' + uid + '/entries').add(entry);
  } catch(err) {}
}
function logFollowup(r, prev, body, via){
  const who = r.k === 'ag' ? r.nama : r.u, base = {platform: platOf(r), target: String(who)};
  const tasks = [];
  if ((body.kontak||'') !== (prev.kontak||'')) tasks.push({type:'kontak', detail: prev.kontak ? `Kontak diubah: ${prev.kontak} → ${body.kontak || '(dihapus)'}` : `Kontak diisi: ${body.kontak}`});
  if ((body.status||'Belum dihubungi') !== (prev.status||'Belum dihubungi')) tasks.push({type:'status', detail: `Status: ${prev.status||'Belum dihubungi'} → ${body.status}` + (via ? ` (${via})` : '')});
  const fu = [];
  if ((body.respon||'') !== (prev.respon||'')) fu.push(`respon: ${body.respon || '(kosong)'}`);
  if ((body.tglLast||'') !== (prev.tglLast||'') && body.tglLast) fu.push(`dihubungi ${fdate(body.tglLast)}`);
  if ((body.ket||'') !== (prev.ket||'') && body.ket) fu.push(`catatan: ${body.ket.length > 80 ? body.ket.slice(0,80) + '…' : body.ket}`);
  if (fu.length) tasks.push({type:'followup', detail: fu.join(' · ')});
  tasks.forEach(t => logActivity(Object.assign({}, base, t)));
}
function subscribeLog(){
  if (!db) return;
  db.collection('jf_log').onSnapshot(snap => {
    snap.docs.forEach(d => {
      if (!d.exists || LOGSUB[d.id]) return;
      LOGSUB[d.id] = db.collection('jf_log/' + d.id + '/entries').orderBy('at','desc').limit(1000).onSnapshot(s2 => {
        LOG[d.id] = s2.docs.filter(x => x.exists).map(x => x.data());
        if (S.tab === 'log') rerenderSoon();
      }, () => {});
    });
    resolveNames(snap.docs.map(d => d.id));
  }, () => {});
}
async function resolveNames(ids){
  if (!userApi || !ids.length) return;
  try { const ps = await userApi.profiles(ids); ids.forEach(id => { NAMES[id] = (ps && ps[id] && ps[id].name) || ''; }); if (S.tab === 'log') rerenderSoon(); } catch(e) {}
}
const nameOf = id => NAMES[id] || (id === me ? 'Kamu' : 'Anggota tim ' + String(id).slice(-4));
const whoOf = e => e.pic || (nameOf(e.by) + ' (petugas belum dipilih)');
/* ---------- petugas ---------- */
let PIC = ''; let TEAM = ['Mita', 'Shakun'];
try { const sv = JSON.parse(localStorage.getItem('jf-pic2') || 'null'); if (sv && sv.day === wibDay()) PIC = sv.pic || ''; } catch(e) {}
const picSel = document.getElementById('pic');
function drawPic(){
  const names = [...new Set([...TEAM, ...(PIC && !TEAM.includes(PIC) ? [PIC] : [])])];
  picSel.replaceChildren(new Option('Pilih nama…', ''), ...names.map(n => new Option(n, n)));
  picSel.value = PIC; picSel.classList.toggle('need', !PIC);
}
picSel.addEventListener('change', async () => {
  PIC = picSel.value; drawPic();
  try { localStorage.setItem('jf-pic2', JSON.stringify({pic: PIC, day: wibDay()})); } catch(e) {}
  if (PIC) toast('Aktivitas hari ini di perangkat ini dicatat atas nama ' + PIC);
});
drawPic();
function subscribeTeam(){
  if (!db) return;
  db.doc('jf_settings/team').onSnapshot(d => { const m = d.exists && d.data().members; if (Array.isArray(m) && m.length) TEAM = m.map(String); drawPic(); if (S.tab === 'log') rerenderSoon(); }, () => {});
}
async function saveTeam(list){ if (!db) return; try { await db.doc('jf_settings/team').set({members: list}); } catch(e) { toast('Daftar petugas gagal disimpan.'); } }
function renderLog(){
  const L = S.f.log || (S.f.log = {from: wibDay(), to: wibDay(), who: '', type: ''});
  const all = Object.values(LOG).flat();
  const rows = all.filter(e => e.day >= L.from && e.day <= L.to && (!L.who || whoOf(e) === L.who) && (!L.type || e.type === L.type)).sort((a,b) => a.at < b.at ? 1 : -1);
  const people = [...new Set([...TEAM, ...all.map(whoOf)])];
  const per = {}; rows.forEach(e => { const p = per[whoOf(e)] ||= {}; p[e.type] = (p[e.type]||0) + 1; });
  const types = Object.keys(LOGTYPE);
  const tm = iso => new Date(iso).toLocaleString('id-ID', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Jakarta'});
  const ro = dbState !== 'ok';
  view.innerHTML = `${bannerHtml()}
  <section class="panel">
    <h2>Log aktivitas harian</h2>
    <div class="team"><span class="flabel">Petugas</span>${TEAM.map(n => `<span class="chip s-act">${esc(n)}<button data-rm="${esc(n)}" aria-label="Hapus ${esc(n)} dari daftar petugas" title="Hapus">×</button></span>`).join('')}
      <input type="text" id="team-new" placeholder="Nama petugas baru" style="max-width:12rem" aria-label="Nama petugas baru"><button class="btn sm" id="team-add">Tambah petugas</button></div>
    <p class="note">Nama petugas dipilih per perangkat dan per hari: setiap hari, sebelum bekerja, pilih nama di kotak <b>Petugas</b> di kanan atas. Pilihan berlaku sampai akhir hari di perangkat itu saja, lalu kosong lagi besok. Petugas yang dihapus dari daftar tetap terlihat di log lamanya.</p>
    <p class="note">Mencatat otomatis siapa melakukan apa: mengisi atau mengubah kontak, mengubah status atau respon follow-up, input sampel, mengubah status posting, menghapus sampel, dan membuka blokir. Aktivitas sebelum fitur ini dipasang (23 Okt 2026 malam) tidak tercatat.</p>
    <div class="filters">
      <span class="flabel">Periode</span>
      <input type="date" id="log-from" value="${esc(L.from)}" aria-label="Dari tanggal"> <span class="muted">s.d.</span> <input type="date" id="log-to" value="${esc(L.to)}" aria-label="Sampai tanggal">
      <button class="btn sm" id="log-today">Hari ini</button><button class="btn sm" id="log-7">7 hari</button>
      <select id="log-who" aria-label="Orang">${opt('','Semua orang',L.who)}${people.map(n => opt(n, n, L.who)).join('')}</select>
      <select id="log-type" aria-label="Jenis">${opt('','Semua jenis',L.type)}${types.map(t => opt(t, LOGTYPE[t], L.type)).join('')}</select>
      <button class="btn sm" id="log-xl">Download Excel</button>
    </div>
    <div class="tscroll"><table class="mini"><thead><tr><th>Orang</th>${types.map(t => `<th class="num">${esc(LOGTYPE[t])}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
      ${Object.keys(per).length ? Object.entries(per).map(([id,c]) => `<tr><td class="u">${esc(id)}</td>${types.map(t => `<td class="num">${c[t]||0}</td>`).join('')}<td class="num"><b>${Object.values(c).reduce((a,b)=>a+b,0)}</b></td></tr>`).join('') : `<tr><td colspan="${types.length+2}" class="muted">${ro ? 'Log hanya bisa dibaca oleh anggota tim yang login.' : 'Belum ada aktivitas di periode ini.'}</td></tr>`}
    </tbody></table></div>
  </section>
  <section class="panel">
    <h2>Rincian <span class="count">${nf.format(rows.length)} aktivitas</span></h2>
    <div class="tscroll" style="max-height:34rem;overflow:auto"><table><thead><tr><th>Waktu (WIB)</th><th>Orang</th><th>Jenis</th><th>Platform</th><th>Kreator</th><th>Detail</th></tr></thead><tbody>
      ${rows.slice(0, 1000).map(e => `<tr><td class="t">${esc(tm(e.at))}</td><td>${esc(whoOf(e))}</td><td><span class="chip">${esc(LOGTYPE[e.type]||e.type)}</span></td><td>${e.platform==='TikTok'||e.platform==='Shopee' ? plChip(e.platform) : esc(e.platform||'')}</td><td class="u">${esc(e.target||'')}</td><td>${esc(e.detail||'')}</td></tr>`).join('') || `<tr><td colspan="6" class="muted">Tidak ada aktivitas.</td></tr>`}
    </tbody></table></div>
  </section>`;
  const set = (k, v) => { L[k] = v; rerenderSoon(); };
  view.querySelectorAll('button[data-rm]').forEach(b => b.onclick = () => { const n = b.dataset.rm; if (TEAM.length <= 1) { toast('Minimal satu petugas.'); return; } saveTeam(TEAM.filter(x => x !== n)); });
  document.getElementById('team-add').onclick = () => { const el = document.getElementById('team-new'); const n = el.value.trim(); if (!n) return; if (TEAM.some(x => x.toLowerCase() === n.toLowerCase())) { toast('Nama sudah ada.'); return; } saveTeam([...TEAM, n]); el.value = ''; };
  const okDate = el => el.value && el.validity.valid;
  document.getElementById('log-from').addEventListener('change', e => { if (okDate(e.target)) set('from', e.target.value); });
  document.getElementById('log-to').addEventListener('change', e => { if (okDate(e.target)) set('to', e.target.value); });
  document.getElementById('log-today').onclick = () => { L.from = L.to = wibDay(); render(); };
  document.getElementById('log-7').onclick = () => { L.to = wibDay(); L.from = wibDay(new Date(Date.now() - 6*864e5)); render(); };
  document.getElementById('log-who').onchange = e => set('who', e.target.value);
  document.getElementById('log-type').onchange = e => set('type', e.target.value);
  document.getElementById('log-xl').onclick = async () => {
    let XLSX; try { XLSX = await loadXlsx(); } catch(e) { toast('Gagal memuat pembuat Excel. Coba lagi.'); return; }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['Waktu (WIB)','Orang','Jenis','Platform','Kreator','Detail'], ...rows.map(e => [tm(e.at), whoOf(e), LOGTYPE[e.type]||e.type, e.platform||'', e.target||'', e.detail||''])]);
    ws['!cols'] = [18,20,16,10,24,70].map(w => ({wch:w})); XLSX.utils.book_append_sheet(wb, ws, 'Log aktivitas');
    const dl = await claude.use('downloads'); if (!dl) { toast('Download tidak tersedia di tampilan ini.'); return; }
    try { await dl.save({filename:`log aktivitas ${L.from}${L.to!==L.from?' sd '+L.to:''}.xlsx`, data: new Blob([XLSX.write(wb, {bookType:'xlsx', type:'array'})])}); } catch(e) {}
  };
}


/* ---------- weekly report ---------- */
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0,10); };
const mondayOf = iso => { const d = new Date(iso + 'T00:00:00Z'); return addDays(iso, -((d.getUTCDay() + 6) % 7)); };
const fmtD = iso => new Date(iso + 'T00:00:00Z').toLocaleDateString('id-ID', {weekday:'short', day:'numeric', month:'short', year:'numeric', timeZone:'UTC'});
function renderWeekly(){
  const W = S.f.wk || (S.f.wk = {from: addDays(mondayOf(wibDay()), -7)});
  if (!W.to) W.to = addDays(W.from, 6);
  const from = W.from, to = W.to;
  const span = Math.round((new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 864e5) + 1;
  const days = [...Array(span)].map((_, i) => addDays(from, i));
  const ready = window.__sampelReady && window.__sampelReady();
  const samp = (window.__sampelRows ? window.__sampelRows() : []).filter(r => r.tgl && r.tgl.slice(0,10) >= from && r.tgl.slice(0,10) <= to).sort((a,b) => a.tgl < b.tgl ? -1 : 1);
  const logs = Object.values(LOG).flat().filter(e => e.day >= from && e.day <= to).sort((a,b) => a.at < b.at ? -1 : 1);
  const cnt = (arr, f) => arr.filter(f).length;
  const biaya = r => (r.hpp || 0) + (Number(r.ongkir) || 0);
  const totB = samp.reduce((a, r) => a + biaya(r), 0);
  const kreator = new Set(samp.map(r => r.platform + '|' + r.user_n)).size;
  const ditarget = new Set(logs.filter(e => e.type === 'followup' || e.type === 'status' || e.type === 'kontak').map(e => e.platform + '|' + String(e.target).toLowerCase())).size;
  const toStat = st => cnt(logs, e => e.type === 'status' && new RegExp('→ ' + st + '( \\(|$)').test(e.detail || ''));
  const stRows = STAT.slice(1).map(st => [st, toStat(st)]);
  const perProd = {}; samp.forEach(r => { const k = r.produk || 'Lainnya'; const o = perProd[k] ||= {n:0, b:0}; o.n++; o.b += biaya(r); });
  const prodRows = Object.entries(perProd).sort((a,b) => b[1].n - a[1].n);
  const perPic = {}; logs.forEach(e => { const p = perPic[whoOf(e)] ||= {}; p[e.type] = (p[e.type]||0) + 1; });
  const types = Object.keys(LOGTYPE);
  const daily = days.map(d => [d, cnt(samp, r => r.tgl.slice(0,10) === d && r.platform === 'TikTok'), cnt(samp, r => r.tgl.slice(0,10) === d && r.platform === 'Shopee'), cnt(logs, e => e.day === d && e.type === 'kontak'), cnt(logs, e => e.day === d && (e.type === 'followup' || e.type === 'status')), cnt(logs, e => e.day === d)]);
  const kpi = (l, v, sub) => `<div class="kpi"><div class="kl">${esc(l)}</div><div class="kv">${v}</div>${sub ? `<div class="ks">${sub}</div>` : ''}</div>`;
  const rp = v => 'Rp' + nf.format(Math.round(v));
  const tm = iso => new Date(iso).toLocaleString('id-ID', {weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Jakarta'});
  view.innerHTML = `${bannerHtml()}
  <section class="panel">
    <h2>Reporting</h2>
    <div class="filters">
      <button class="btn sm" id="wk-prev" aria-label="Periode sebelumnya">‹ Sebelumnya</button>
      <span class="flabel">Dari</span><input type="date" id="wk-from" value="${esc(from)}" max="${esc(to)}" aria-label="Tanggal awal">
      <span class="flabel">s.d.</span><input type="date" id="wk-to" value="${esc(to)}" min="${esc(from)}" aria-label="Tanggal akhir">
      <button class="btn sm" id="wk-next" aria-label="Periode berikutnya">Berikutnya ›</button>
      <button class="btn sm" id="wk-last">7 hari terakhir</button>
      <button class="btn sm" id="wk-week">Senin–Minggu lalu</button>
      <button class="btn" id="wk-xl">Download Excel</button>
      <button class="btn" id="wk-png">Download gambar untuk slide (PNG)</button>
    </div>
    <p class="note">Periode <b>${esc(fmtD(from))} – ${esc(fmtD(to))}</b> (${span} hari).${ready ? '' : ' Data sampel lama masih dimuat…'}</p>
    <p class="note">Aktivitas follow-up hanya tercatat sejak Log Aktivitas dipasang (23 Okt 2026). GMV per minggu belum bisa ditampilkan karena data penjualan yang ada masih per bulan; upload export pesanan mingguan kalau ingin GMV ikut masuk.</p>
    <div class="kpis">
      ${kpi('Sampel dikirim', nf.format(samp.length), `TikTok ${cnt(samp, r => r.platform === 'TikTok')} · Shopee ${cnt(samp, r => r.platform === 'Shopee')}`)}
      ${kpi('Kreator dapat sampel', nf.format(kreator))}
      ${kpi('Biaya sampel', rp(totB), 'HPP + ongkir')}
      ${kpi('Kontak baru diisi', nf.format(cnt(logs, e => e.type === 'kontak')))}
      ${kpi('Kreator di-follow-up', nf.format(ditarget))}
      ${kpi('Total aktivitas', nf.format(logs.length))}
    </div>
  </section>
  <section class="panel"><h2>Per hari</h2><div class="tscroll"><table class="mini"><thead><tr><th>Hari</th><th class="num">Sampel TikTok</th><th class="num">Sampel Shopee</th><th class="num">Kontak diisi</th><th class="num">Follow-up/status</th><th class="num">Semua aktivitas</th></tr></thead><tbody>
    ${daily.map(r => `<tr><td>${esc(fmtD(r[0]))}</td>${r.slice(1).map(v => `<td class="num">${v}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div></section>
  <section class="panel"><h2>Hasil follow-up</h2><p class="note">Jumlah perubahan status kreator ke status ini selama minggu tersebut.</p><div class="tscroll"><table class="mini"><thead><tr><th>Status baru</th><th class="num">Jumlah</th></tr></thead><tbody>
    ${stRows.map(r => `<tr><td><span class="chip ${statClass(r[0])}">${esc(r[0])}</span></td><td class="num">${r[1]}</td></tr>`).join('')}
  </tbody></table></div></section>
  <section class="panel"><h2>Sampel per produk</h2><div class="tscroll"><table class="mini"><thead><tr><th>Produk</th><th class="num">Sampel</th><th class="num">Biaya</th></tr></thead><tbody>
    ${prodRows.length ? prodRows.map(([k, o]) => `<tr><td>${esc(k)}</td><td class="num">${o.n}</td><td class="num">${rp(o.b)}</td></tr>`).join('') : '<tr><td colspan="3" class="muted">Tidak ada sampel minggu ini.</td></tr>'}
  </tbody></table></div></section>
  <section class="panel"><h2>Per petugas</h2><div class="tscroll"><table class="mini"><thead><tr><th>Petugas</th>${types.map(t => `<th class="num">${esc(LOGTYPE[t])}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>
    ${Object.keys(perPic).length ? Object.entries(perPic).map(([n, c]) => `<tr><td>${esc(n)}</td>${types.map(t => `<td class="num">${c[t]||0}</td>`).join('')}<td class="num"><b>${Object.values(c).reduce((a,b)=>a+b,0)}</b></td></tr>`).join('') : `<tr><td colspan="${types.length+2}" class="muted">Belum ada aktivitas tercatat.</td></tr>`}
  </tbody></table></div></section>
  <section class="panel"><h2>Daftar sampel <span class="count">${nf.format(samp.length)}</span></h2><div class="tscroll" style="max-height:30rem;overflow:auto"><table><thead><tr><th>Tanggal</th><th>Platform</th><th>Kreator</th><th>Produk</th><th>SKU</th><th class="num">Biaya</th><th>Posting</th></tr></thead><tbody>
    ${samp.map(r => `<tr><td class="t">${esc(r.tgl.slice(0,10))}</td><td>${plChip(r.platform)}</td><td class="u">${esc(r.username)}</td><td>${esc(r.produk||'')}</td><td>${esc(r.sku||'')}</td><td class="num">${rp(biaya(r))}</td><td>${esc(r.status||'')}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Tidak ada sampel minggu ini.</td></tr>'}
  </tbody></table></div></section>`;
  const go = (f, t) => { if (t < f) [f, t] = [t, f]; W.from = f; W.to = t; render(); };
  document.getElementById('wk-prev').onclick = () => go(addDays(from, -span), addDays(to, -span));
  document.getElementById('wk-next').onclick = () => go(addDays(from, span), addDays(to, span));
  document.getElementById('wk-last').onclick = () => go(addDays(wibDay(), -7), addDays(wibDay(), -1));
  document.getElementById('wk-week').onclick = () => { const m = addDays(mondayOf(wibDay()), -7); go(m, addDays(m, 6)); };
  document.getElementById('wk-from').addEventListener('change', e => { if (e.target.value) go(e.target.value, to); });
  document.getElementById('wk-to').addEventListener('change', e => { if (e.target.value) go(from, e.target.value); });
  document.getElementById('wk-png').onclick = async () => {
    const Wd = 1600, H = 900, c = document.createElement('canvas'); c.width = Wd; c.height = H; const g = c.getContext('2d');
    const F = 'Arial, sans-serif';
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, Wd, H);
    g.fillStyle = '#1f2430'; g.font = `bold 40px ${F}`; g.fillText('Reporting Affiliate JustFluff', 60, 80);
    g.fillStyle = '#6b7280'; g.font = `24px ${F}`; g.fillText(`${fmtD(from)} – ${fmtD(to)}  ·  ${span} hari`, 60, 120);
    const K = [['Sampel dikirim', nf.format(samp.length), `TikTok ${cnt(samp, r => r.platform === 'TikTok')} · Shopee ${cnt(samp, r => r.platform === 'Shopee')}`], ['Kreator dapat sampel', nf.format(kreator), ''], ['Biaya sampel', rp(totB), 'HPP + ongkir'], ['Kontak baru', nf.format(cnt(logs, e => e.type === 'kontak')), ''], ['Kreator di-follow-up', nf.format(ditarget), ''], ['Total aktivitas', nf.format(logs.length), '']];
    K.forEach(([l, v, sub], i) => { const x = 60 + i * 252, y = 160; g.fillStyle = '#f4f5f8'; g.fillRect(x, y, 232, 150); g.fillStyle = '#6b7280'; g.font = `20px ${F}`; g.fillText(l, x + 18, y + 38); g.fillStyle = '#1f2430'; g.font = `bold ${v.length > 8 ? 32 : 44}px ${F}`; g.fillText(v, x + 18, y + 95); if (sub) { g.fillStyle = '#6b7280'; g.font = `17px ${F}`; g.fillText(sub, x + 18, y + 130); } });
    const table = (x, y, title, head, rows, ws) => { g.fillStyle = '#1f2430'; g.font = `bold 24px ${F}`; g.fillText(title, x, y); y += 40; g.font = `bold 18px ${F}`; g.fillStyle = '#6b7280'; let cx = x; head.forEach((h, i) => { g.textAlign = i ? 'right' : 'left'; g.fillText(h, i ? cx + ws[i] : cx, y); cx += ws[i] + 14; }); g.textAlign = 'left'; g.font = `18px ${F}`; g.fillStyle = '#1f2430'; rows.forEach(r => { y += 32; cx = x; r.forEach((v, i) => { g.textAlign = i ? 'right' : 'left'; let t = String(v); while (i === 0 && g.measureText(t).width > ws[0] && t.length > 3) t = t.slice(0, -2) + '…'; g.fillText(t, i ? cx + ws[i] : cx, y); cx += ws[i] + 14; }); g.textAlign = 'left'; }); };
    const dRows = span <= 14 ? daily.map(r => [fmtD(r[0]), r[1], r[2], r[3], r[4]]) : (() => { const o = []; for (let i = 0; i < daily.length; i += 7) { const ch = daily.slice(i, i + 7); o.push([ch[0][0].slice(5) + ' s.d. ' + ch[ch.length-1][0].slice(5), ...[1,2,3,4].map(j => ch.reduce((a, r) => a + r[j], 0))]); } return o.slice(0, 14); })();
    table(60, 380, span <= 14 ? 'Per hari' : 'Per 7 hari', [span <= 14 ? 'Hari' : 'Periode', 'TikTok', 'Shopee', 'Kontak', 'Follow-up'], dRows, [230, 80, 80, 80, 100]);
    const pr = prodRows.slice(0, 10).map(([k, o]) => [k, o.n, rp(o.b)]);
    table(740, 380, 'Sampel per produk' + (prodRows.length > 10 ? ' (10 teratas)' : ''), ['Produk', 'Sampel', 'Biaya'], pr.length ? pr : [['Tidak ada sampel', '', '']], [340, 90, 160]);
    c.toBlob(async b => {
      const dl = await claude.use('downloads'); if (!dl) { toast('Download tidak tersedia di tampilan ini.'); return; }
      try { await dl.save({filename:`reporting affiliate ${from} sd ${to}.png`, data: b}); } catch (e) { if (e && e.code !== 'declined') toast('Download gagal.'); }
    }, 'image/png');
  };
  document.getElementById('wk-xl').onclick = async () => {
    let XLSX; try { XLSX = await loadXlsx(); } catch(e) { toast('Gagal memuat pembuat Excel. Coba lagi.'); return; }
    const wb = XLSX.utils.book_new();
    const add = (name, aoa, w) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = w.map(x => ({wch:x})); XLSX.utils.book_append_sheet(wb, ws, name); };
    add('Ringkasan', [['Reporting affiliate JustFluff'], ['Periode', `${from} s.d. ${to}`], [],
      ['Sampel dikirim', samp.length], ['  TikTok', cnt(samp, r => r.platform === 'TikTok')], ['  Shopee', cnt(samp, r => r.platform === 'Shopee')], ['Kreator dapat sampel', kreator], ['Biaya sampel (HPP + ongkir)', Math.round(totB)],
      ['Kontak baru diisi', cnt(logs, e => e.type === 'kontak')], ['Kreator di-follow-up', ditarget], ['Total aktivitas', logs.length], [],
      ['Status baru', 'Jumlah'], ...stRows, [], ['Produk', 'Sampel', 'Biaya'], ...prodRows.map(([k, o]) => [k, o.n, Math.round(o.b)]), [],
      ['Hari', 'Sampel TikTok', 'Sampel Shopee', 'Kontak diisi', 'Follow-up/status', 'Semua aktivitas'], ...daily], [30,16,14,14,16,16]);
    add('Sampel', [['Tanggal','Platform','Toko','Username','Produk','SKU','HPP','Ongkir','Biaya','ID pesanan','Ekspedisi','Status posting'], ...samp.map(r => [r.tgl.slice(0,10), r.platform, r.toko||'', r.username, r.produk||'', r.sku||'', Math.round(r.hpp||0), Number(r.ongkir)||0, Math.round(biaya(r)), r.id||'', r.ekspedisi||'', r.status||''])], [12,10,14,22,18,20,10,10,10,22,12,16]);
    add('Per petugas', [['Petugas', ...types.map(t => LOGTYPE[t]), 'Total'], ...Object.entries(perPic).map(([n, c]) => [n, ...types.map(t => c[t]||0), Object.values(c).reduce((a,b)=>a+b,0)])], [26,10,10,12,12,12,12,12,10]);
    add('Aktivitas', [['Waktu (WIB)','Petugas','Jenis','Platform','Kreator','Detail'], ...logs.map(e => [tm(e.at), whoOf(e), LOGTYPE[e.type]||e.type, e.platform||'', e.target||'', e.detail||''])], [20,22,16,10,24,70]);
    const dl = await claude.use('downloads'); if (!dl) { toast('Download tidak tersedia di tampilan ini.'); return; }
    try { await dl.save({filename:`reporting affiliate ${from} sd ${to}.xlsx`, data: new Blob([XLSX.write(wb, {bookType:'xlsx', type:'array'})])}); }
    catch (e) { if (e && e.code !== 'declined') toast('Download gagal.'); }
  };
}




/* ---------- template WA ---------- */
const WATPL = {
  '': ['Tanpa pesan', ''],
  ajak: ['Ajak campaign', 'Halo kak {nama}! Aku {pic} dari JustFluff. Kami lagi buka campaign affiliate Okt–Des dengan komisi spesial untuk kreator yang sudah pernah jualan JustFluff. Boleh aku kirim info lengkapnya, kak?'],
  fu: ['Follow-up', 'Halo kak {nama}, aku {pic} dari JustFluff, mau follow-up pesan sebelumnya ya. Kakak masih tertarik kerja sama affiliate dengan JustFluff? Kalau ada pertanyaan soal komisi atau produk, tanya aja kak.'],
  tagih: ['Tagih konten', 'Halo kak {nama}, aku {pic} dari JustFluff. Sampel {produk} yang kami kirim sudah sampai kan, kak? Kami tunggu videonya ya. Kalau ada kendala atau butuh brief, kabari aku aja.'],
  launch: ['Info launching', 'Halo kak {nama}! Aku {pic} dari JustFluff. Kami baru launching The Worst Marshmallow Ever dan lagi cari kreator untuk One Cube Challenge. Kakak mau ikutan dan dapat produknya? Balas ya kak, nanti aku kirim detailnya.'],
  andalan: ['Kreator andalan', 'Halo kak {nama}! Aku {pic} dari JustFluff. Terima kasih sudah rutin jualan JustFluff tiap bulan. Kami mau tawarkan komisi khusus dan prioritas produk baru untuk kakak. Boleh aku jelaskan detailnya?']
};
let WA_SEL = ''; try { WA_SEL = localStorage.getItem('jf-watpl') || ''; } catch(e) {}
if (!WATPL[WA_SEL]) WA_SEL = '';
const waText = (r, tp, extra) => { const t = WATPL[tp ?? WA_SEL]; if (!t || !t[1] || !r) return ''; const nama = (r.k === 'sh' && r.nama ? r.nama : r.u) || ''; const msg = t[1].replace('{nama}', nama).replace('{pic}', (typeof PIC !== 'undefined' && PIC) || 'tim affiliate').replace('{produk}', (extra && extra.produk) || 'JustFluff'); return '?text=' + encodeURIComponent(msg); };
(() => { const sel = document.getElementById('watpl'); if (!sel) return; Object.entries(WATPL).forEach(([k, v]) => sel.append(new Option(v[0], k))); sel.value = WA_SEL; sel.onchange = () => { WA_SEL = sel.value; try { localStorage.setItem('jf-watpl', WA_SEL); } catch(e) {} rerenderSoon(); }; })();
/* ---------- kreator andalan ---------- */
const andalan = r => r.k !== 'ag' && (D.tipArti ? true : r.tipe === 'Kreator konten') && r.bln >= 5 && r.gb >= 3e6 && r.okt > 0 && r.pr <= 3;
/* penjelasan istilah (ikon ⓘ) */
function GLOS_AFF_F(){ return { 'Prio': 'P1: GMV bersih 30 hari > Rp3 jt · P2: GMV bersih 90 hari > Rp1 jt · P3: ≤ Rp1 jt · P4: tidak jualan 60 hari / sampel belum efektif · P5: GMV 0 atau akun platform',
  'GMV bersih': 'Penjualan setelah dikurangi pesanan batal / tidak memenuhi syarat dan dana yang dikembalikan.',
  'GMV 30 hari terakhir': 'GMV bersih 30 hari terakhir sampai kemarin.',
  'Efektivitas sampel (all time)': '(GMV sebelum + sesudah sampel) ÷ (HPP + ongkir). Efektif bila di atas ambang klien.',
  'Bulan aktif': 'Jumlah bulan ada penjualan dari bulan yang ada datanya; di bawahnya bulan dengan kontribusi terbesar.' }; }

/* ---------- tab "Kerja hari ini": siapa yang dihubungi hari ini + riwayat prioritas ---------- */
var PHIST = null;
function kerjaRows(){
  const today = isoToday();
  return [...TT, ...SH].map(r => { const f = fuOf(r) || {}; let why = '';
    if (f.next && f.next <= today) why = f.next === today ? 'Jadwal follow-up hari ini' : 'Jadwal follow-up terlewat (' + fdate(f.next) + ')';
    else if (needsFU(r)) why = 'Belum respon ≥3 hari';
    else if (r.pr <= 2 && statusOf(r) === 'Belum dihubungi') why = r.pr === 1 ? 'P1 · GMV 30 hari ' + rpShort(r.okt) : 'P2 · belum dihubungi';
    return why ? { r, why } : null; }).filter(Boolean).sort((a, b) => a.r.pr - b.r.pr || (b.r.gb || 0) - (a.r.gb || 0));
}
function renderKerja(){
  const L = kerjaRows(), done = [...TT, ...SH].filter(r => { const f = fuOf(r); return f && f.tglLast === isoToday(); }).length;
  const hist = PHIST ? histHtml() : '<p class="muted">Memuat riwayat…</p>';
  view.innerHTML = `${bannerHtml()}<div class="kerja"><section class="panel"><h2>Hubungi hari ini · ${esc(fdate(isoToday()))} <span class="count">${nf.format(L.length)}</span></h2>
    <p class="note">Otomatis dari P1–P2 yang belum dihubungi dan follow-up yang jatuh tempo. Sudah dihubungi hari ini: <b>${nf.format(done)}</b>.</p>
    <div class="tscroll"><table><thead><tr><th>Prio</th><th>Username</th><th>Alasan</th><th>Terakhir dihubungi</th></tr></thead><tbody>
    ${L.slice(0, 200).map(({ r, why }, i) => `<tr class="click" tabindex="0" data-i="${i}"><td>${prioChip(r.pr)}</td><td class="u">${esc(r.u)}${r.k==='sh' && r.nama && r.nama !== r.u ? `<small>${esc(r.nama)}</small>` : ''}${ptags(r)}${fuOf(r)?.kontak ? `<br>${kontakHtml(fuOf(r).kontak, r)}` : ''}</td><td>${esc(why)}</td><td>${lastCell(r)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Tidak ada yang perlu dihubungi hari ini.</td></tr>'}
    </tbody></table></div></section>
    <section class="panel"><h2>Riwayat prioritas · 7 hari terakhir</h2>${hist}</section></div>`;
  view.querySelectorAll('tr.click').forEach(tr => { const open = () => openDrawer(L[+tr.dataset.i].r); tr.addEventListener('click', e => { if (e.target.closest('a')) return; open(); }); tr.addEventListener('keydown', e => { if (e.key === 'Enter') open(); }); });
  if (!PHIST && db) db.collection('prio_hist').get().then(sn => { PHIST = sn.docs.map(d => ({ id: d.id, m: d.data() || {} })).sort((a, b) => a.id < b.id ? -1 : 1); if (S.tab === 'kerja') render(); }).catch(() => { PHIST = []; });
}
function histHtml(){
  if (!PHIST.length) return '<p class="muted">Riwayat mulai tercatat sejak data affiliate di-upload. Perubahan akan terlihat setelah upload berikutnya.</p>';
  const last = PHIST[PHIST.length - 1], lim = addDays(last.id, -7), base = [...PHIST].reverse().find(x => x.id <= lim) || PHIST[0];
  if (base === last) return '<p class="muted">Baru ada satu catatan riwayat (' + esc(fdate(last.id)) + '). Perubahan terlihat setelah upload berikutnya.</p>';
  const idx = {}; [...TT, ...SH].forEach(r => { idx[(r.k === 'sh' ? 'S|' : 'T|') + r.u.toLowerCase()] = r; });
  const up = [], dn = []; for (const [k, p] of Object.entries(last.m)) { const o = base.m[k]; if (o == null || o === p) continue; (p < o ? up : dn).push({ k, o, p, r: idx[k] }); }
  const li = x => `<div class="small">${esc(x.r ? x.r.u : x.k.slice(2))} ${prioChip(x.o)} → ${prioChip(x.p)}</div>`;
  return `<p class="note">Dibanding ${esc(fdate(base.id))}.</p><p><b class="kt">▲ Naik (${up.length})</b></p>${up.slice(0, 15).map(li).join('')}${up.length > 15 ? `<div class="small muted">+${up.length - 15} lainnya</div>` : ''}
    <p style="margin-top:10px"><b class="late">▼ Turun (${dn.length})</b></p>${dn.slice(0, 15).map(li).join('')}${dn.length > 15 ? `<div class="small muted">+${dn.length - 15} lainnya</div>` : ''}`;
}

/* ---------- kerja hari ini ---------- */
function tagihRows(){
  const now = wibDay(), lo = addDays(now, -45), hi = addDays(now, -14);
  const idx = {}; [...TT, ...SH].forEach(r => { idx[(r.k === 'sh' ? 'Shopee' : 'TikTok') + '|' + r.u.toLowerCase()] = r; });
  const seen = new Set(), out = [];
  (window.__sampelRows ? window.__sampelRows() : []).filter(x => x.tgl && x.tgl.slice(0,10) >= lo && x.tgl.slice(0,10) <= hi && x.status !== 'SESUAI').sort((a,b) => a.tgl < b.tgl ? 1 : -1).forEach(x => {
    const key = x.platform + '|' + String(x.username || '').toLowerCase().replace(/^@+/, ''); if (seen.has(key)) return; seen.add(key);
    const r = idx[key]; if (r && (r.okt > 0 || statusOf(r) === 'Sudah posting')) return;
    out.push({x, r, hari: daysSince(x.tgl.slice(0,10))}); });
  return out;
}
function todayPanel(){
  const all = [...TT, ...SH], due = all.filter(needsFU).length;
  const p1 = all.filter(r => r.pr === 1 && statusOf(r) === 'Belum dihubungi').length, p2 = all.filter(r => r.pr === 2 && statusOf(r) === 'Belum dihubungi').length;
  const an = all.filter(andalan), anBelum = an.filter(r => statusOf(r) === 'Belum dihubungi').length;
  const tg = tagihRows(), ready = window.__sampelReady && window.__sampelReady();
  const sl = window.__syncLast;
  const syncTxt = sl ? `Sinkron terakhir ke spreadsheet: ${new Date(sl.at).toLocaleString('id-ID', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Jakarta'})} WIB · ${nf.format(Number(sl.disalin)||0)} sampel disalin · ${nf.format(Number(sl.status_diperbarui)||0)} status diperbarui · ${nf.format(Number(sl.gagal)||0)} gagal` : 'Status sinkron spreadsheet belum terbaca (jadwal tiap hari ±16.30 WIB).';
  const syncBad = sl && (Number(sl.gagal) > 0 || (Date.now() - new Date(sl.at)) > 36 * 3600e3);
  const btn = (id, n, lbl, sub) => `<div class="stat${n ? ' hot' : ''}"><b>${nf.format(n)}</b><span>${lbl}</span>${sub ? `<span class="muted">${sub}</span>` : ''}${n ? `<button class="btn sm" id="${id}">Lihat daftarnya →</button>` : ''}</div>`;
  return `<section class="panel"><h2>Kerja hari ini</h2>
    <div class="stat-row">
      ${btn('td-due', due, 'perlu di-follow-up (belum respon ≥3 hari)')}
      ${btn('td-p1', p1, 'P1 belum dihubungi')}
      ${btn('td-p2', p2, 'P2 belum dihubungi')}
      ${btn('td-tagih', ready ? tg.length : 0, ready ? 'sampel perlu ditagih kontennya' : 'sampel perlu ditagih (memuat…)', 'dikirim 14–45 hari lalu, belum SESUAI, belum jualan bulan terakhir')}
      ${btn('td-andalan', an.length, 'kreator andalan', `${anBelum} belum dihubungi · jualan ≥5 dari 6 bulan, GMV bersih ≥Rp3 jt, masih jualan bulan terakhir`)}
    </div>
    <p class="note" style="${syncBad ? 'color:var(--bad)' : ''}">${esc(syncTxt)}${syncBad ? ' · cek jadwal sinkron' : ''}</p>
    <div id="td-tagih-list" ${S.f.tagihOpen ? '' : 'hidden'}>${S.f.tagihOpen ? tagihTable(tg) : ''}</div>
  </section>`;
}
function tagihTable(tg){
  return `<h3 style="margin:12px 0 8px">Sampel perlu ditagih kontennya <span class="count">${tg.length}</span></h3><div class="tscroll" style="max-height:28rem;overflow:auto"><table class="mini"><thead><tr><th>Dikirim</th><th>Platform</th><th>Kreator</th><th>Produk</th><th class="num">Hari</th><th>Status posting</th><th>Kontak</th></tr></thead><tbody>
    ${tg.map(({x, r, hari}) => { const k = r && fuOf(r)?.kontak; return `<tr><td>${esc(x.tgl.slice(0,10))}</td><td>${plChip(x.platform)}</td><td class="u">${esc(x.username)}</td><td>${esc(x.produk || '')}</td><td class="num">${hari ?? ''}</td><td>${esc(x.status || 'belum dicek')}</td><td>${k ? kontakHtml(k, r, 'tagih').replace(encodeURIComponent('Sampel JustFluff'), encodeURIComponent('Sampel ' + (x.produk || 'JustFluff'))) : '<small class="muted">belum ada kontak</small>'}</td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Tidak ada.</td></tr>'}
  </tbody></table></div><p class="note">Tombol WA di daftar ini otomatis memakai template "Tagih konten". Ubah status posting jadi SESUAI di tab Input Sampel kalau videonya sudah ada.</p>`;
}
function wireToday(){
  const goDb = (patch) => { S.dbpl = ''; const f = S.f.tiktok; FILTER_KEYS.forEach(k => f[k] = k === 'due' ? false : ''); Object.assign(f, {page:0, p5:false}, patch); saveFilters(); setTab('db'); };
  const on = (id, fn) => { const e = document.getElementById(id); if (e) e.onclick = fn; };
  on('td-due', () => goDb({due:true}));
  on('td-p1', () => goDb({pr:'1', st:'Belum dihubungi'}));
  on('td-p2', () => goDb({pr:'2', st:'Belum dihubungi'}));
  on('td-andalan', () => goDb({akt:'andalan', sort:'gb', dir:'desc'}));
  on('td-tagih', () => { S.f.tagihOpen = !S.f.tagihOpen; render(); if (S.f.tagihOpen) document.getElementById('td-tagih-list')?.scrollIntoView({behavior:'smooth', block:'start'}); });
}
/* ---------- acara Haluan ---------- */
function halPanel(){
  if (!D.HAL) return '';
  const H = D.HAL, rows = [...TT, ...SH].filter(r => halOf(r));
  const gi = r => r.k === 'tt' ? r.g : r.g; // monthly gross Mei..Okt
  const ratio = r => r.gk ? r.gb / r.gk : 1;
  const bef = r => ((r.g||[]).slice(0,4).reduce((a,b)=>a+b,0) + ((r.g||[])[4]||0) * 0.5) * ratio(r);
  const aft = r => (((r.g||[])[4]||0) * 0.5 + ((r.g||[])[5]||0)) * ratio(r);
  const B = rows.reduce((a,r)=>a+bef(r),0), A = rows.reduce((a,r)=>a+aft(r),0), cost = H.n * H.cost;
  const baru = rows.filter(r => bef(r) <= 0 && aft(r) > 0).length;
  const rp = v => 'Rp' + nf.format(Math.round(v));
  return `<details class="hal-det" id="hal-det"${S.f.halOpen ? ' open' : ''} ontoggle="S.f.halOpen = this.open"><summary><h2>Acara Haluan</h2><span class="hal-note">ClickConnect Semarang (Sep 2026) · ${H.n} peserta · efektivitas ${((A+B)/cost).toLocaleString('id-ID',{maximumFractionDigits:1})}×</span></summary><div class="hal-body">
    <div class="stat-row">
      <div class="stat"><b>${nf.format(H.n)}</b><span>peserta, masing-masing dapat 1 sampel (Mix Alpha/MMF, dihitung Rp${nf.format(H.cost)})</span><span class="muted">${Object.entries(H.grp).map(([g,n]) => esc(g) + ': ' + n).join(' · ')}</span></div>
      <div class="stat"><b>${nf.format(new Set(rows.map(r => r.u)).size)}</b><span>peserta yang akunnya ada di data penjualan JustFluff (${rows.length} akun TikTok/Shopee)</span><span class="muted">sisanya belum pernah jualan JustFluff atau username-nya tidak cocok</span></div>
      <div class="stat"><b>${baru}</b><span>akun mulai jualan JustFluff setelah acara (sebelumnya Rp0)</span></div>
      <div class="stat"><b>${rp(A)}</b><span>GMV bersih setelah acara (pertengahan Sep–21 Okt)</span><span class="muted">sebelum acara (Mei–pertengahan Sep): ${rp(B)}</span></div>
      <div class="stat${(A+B)/cost > 10 ? '' : ' hot'}"><b>${((A+B)/cost).toLocaleString('id-ID',{maximumFractionDigits:1})}×</b><span>efektivitas acara: GMV bersih sebelum + sesudah ÷ biaya ${rp(cost)} (batas finance 10×)</span></div>
    </div>
    <div class="tscroll"><table class="mini"><thead><tr><th>Akun</th><th>Platform</th><th>Grup GMV</th><th class="num">GMV bersih sebelum</th><th class="num">GMV bersih sesudah</th><th class="num">Efektivitas</th><th>Prioritas</th></tr></thead><tbody>
      ${rows.sort((x,y) => (aft(y)+bef(y)) - (aft(x)+bef(x))).map(r => { const st = sampStat(r); const ro = st && sampRoi(st); return `<tr><td class="u">${esc(r.u)}</td><td>${plChip(r.k === 'sh' ? 'Shopee' : 'TikTok')}</td><td>${esc(halOf(r))}</td><td class="num">${rp(bef(r))}</td><td class="num">${rp(aft(r))}</td><td class="num">${ro == null ? '–' : ro.toLocaleString('id-ID',{maximumFractionDigits:1}) + '×'}</td><td>${prioChip(r.pr)}</td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="note">Peserta dicocokkan dari username IG/TikTok dan link Shopee di formulir pendaftaran. Link Shopee pendek (s.shopee/shp.ee) tidak bisa dibaca, jadi peserta yang jualan di Shopee dengan username berbeda mungkin belum terhitung. GMV bulanan dipecah setengah-setengah di bulan September. Filter "Peserta acara Haluan" ada di tab Database Affiliate.</p>
  </div></details>`;
}
/* ---------- meeting download (Ringkasan) ---------- */
function meetRange(){ const W = S.f.wk || (S.f.wk = {}); if (!W.from) { const m = addDays(mondayOf(wibDay()), -7); W.from = m; W.to = addDays(m, 6); } if (!W.to) W.to = addDays(W.from, 6); return W; }
function meetPanel(){
  const W = meetRange();
  return `<section class="panel"><h2>Download untuk meeting</h2>
    <div class="filters">
      <span class="flabel">Periode aktivitas</span><input type="date" id="mt-from" value="${esc(W.from)}" max="${esc(W.to)}" aria-label="Tanggal awal">
      <span class="flabel">s.d.</span><input type="date" id="mt-to" value="${esc(W.to)}" min="${esc(W.from)}" aria-label="Tanggal akhir">
      <button class="btn sm" id="mt-week">Senin–Minggu lalu</button>
      <button class="btn sm" id="mt-7">7 hari terakhir</button>
      <button class="btn" id="mt-png">Download gambar slide (PNG)</button>
      <button class="btn" id="mt-xl">Download Excel</button>
    </div>
    <p class="note">Isi unduhan: semua isi Ringkasan (angka kunci, progres follow-up, status, respon, prioritas, tipe akun, TikTok &amp; Shopee per bulan) ditambah sampel dan aktivitas pada periode yang dipilih. Gambar terdiri dari 3 slide 16:9. Status follow-up adalah posisi saat diunduh; GMV masih per bulan.</p>
  </section>`;
}
function meetCalc(from, to){
  const span = Math.round((new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 864e5) + 1;
  const days = [...Array(span)].map((_, i) => addDays(from, i));
  const samp = (window.__sampelRows ? window.__sampelRows() : []).filter(r => r.tgl && r.tgl.slice(0,10) >= from && r.tgl.slice(0,10) <= to).sort((a,b) => a.tgl < b.tgl ? -1 : 1);
  const logs = Object.values(LOG).flat().filter(e => e.day >= from && e.day <= to).sort((a,b) => a.at < b.at ? -1 : 1);
  const cnt = (arr, f) => arr.filter(f).length;
  const biaya = r => (r.hpp || 0) + (Number(r.ongkir) || 0);
  const perProd = {}; samp.forEach(r => { const k = r.produk || 'Lainnya'; const o = perProd[k] ||= {n:0, b:0}; o.n++; o.b += biaya(r); });
  const daily = days.map(d => [d, cnt(samp, r => r.tgl.slice(0,10) === d && r.platform === 'TikTok'), cnt(samp, r => r.tgl.slice(0,10) === d && r.platform === 'Shopee'), cnt(logs, e => e.day === d && e.type === 'kontak'), cnt(logs, e => e.day === d && (e.type === 'followup' || e.type === 'status')), cnt(logs, e => e.day === d)]);
  const perPic = {}; logs.forEach(e => { const p = perPic[whoOf(e)] ||= {}; p[e.type] = (p[e.type]||0) + 1; });
  return {from, to, span, samp, logs, biaya, cnt, daily, perPic,
    tt: cnt(samp, r => r.platform === 'TikTok'), sh: cnt(samp, r => r.platform === 'Shopee'),
    totB: samp.reduce((a, r) => a + biaya(r), 0), kreator: new Set(samp.map(r => r.platform + '|' + r.user_n)).size,
    kontak: cnt(logs, e => e.type === 'kontak'),
    ditarget: new Set(logs.filter(e => e.type === 'followup' || e.type === 'status' || e.type === 'kontak').map(e => e.platform + '|' + String(e.target).toLowerCase())).size,
    stRows: STAT.slice(1).map(st => [st, cnt(logs, e => e.type === 'status' && new RegExp('→ ' + st + '( \\(|$)').test(e.detail || ''))]),
    prodRows: Object.entries(perProd).sort((a,b) => b[1].n - a[1].n)};
}
function wireMeet(Z){
  const W = meetRange();
  const go = (f, t) => { if (t < f) [f, t] = [t, f]; W.from = f; W.to = t; render(); };
  document.getElementById('mt-from').addEventListener('change', e => { if (e.target.value) go(e.target.value, W.to); });
  document.getElementById('mt-to').addEventListener('change', e => { if (e.target.value) go(W.from, e.target.value); });
  document.getElementById('mt-week').onclick = () => { const m = addDays(mondayOf(wibDay()), -7); go(m, addDays(m, 6)); };
  document.getElementById('mt-7').onclick = () => go(addDays(wibDay(), -7), addDays(wibDay(), -1));
  const rp = v => 'Rp' + nf.format(Math.round(v));
  const fn = ext => `reporting affiliate ${W.from} sd ${W.to}.${ext}`;
  const save = async (name, blob) => { const dl = await claude.use('downloads'); if (!dl) { toast('Download tidak tersedia di tampilan ini.'); return false; } try { await dl.save({filename: name, data: blob}); return true; } catch (e) { if (e && e.code !== 'declined') toast('Download gagal.'); return false; } };
  const kvs = v => (v === undefined || v === null) ? '–' : String(v);
  document.getElementById('mt-xl').onclick = async () => {
    const R = meetCalc(W.from, W.to);
    let XLSX; try { XLSX = await loadXlsx(); } catch(e) { toast('Gagal memuat pembuat Excel. Coba lagi.'); return; }
    const wb = XLSX.utils.book_new();
    const add = (name, aoa, w) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = w.map(x => ({wch:x})); XLSX.utils.book_append_sheet(wb, ws, name); };
    add('Ringkasan', [['Reporting affiliate JustFluff'], ['Periode aktivitas', `${W.from} s.d. ${W.to}`], ['Diunduh', wibDay()], [],
      ['ANGKA KUNCI (posisi saat ini)'], ['Sudah dihubungi (P1–P3)', Z.cTT+Z.cSH+Z.cAG, 'dari', Z.nTT+Z.nSH+Z.nAG], ['Tidak perlu dihubungi dulu (P4–P5)', Z.sTT+Z.sSH+Z.sAG], ['Perlu di-follow-up (≥3 hari belum respon)', Z.due],
      ['Sampel terkirim ' + (Z.K.bulanLbl || 'bulan ini'), kvs(Z.K.sampelBulan)], ['Sampel yang menghasilkan order', kvs(Z.K.laku)], ['GMV per Rp1 biaya sampel', kvs(Z.K.roi)], [],
      ['PROGRES FOLLOW-UP', 'Sudah dihubungi', 'Perlu dihubungi (P1–P3)', 'P4–P5'], ['TikTok', Z.cTT, Z.nTT, Z.sTT], ['Shopee', Z.cSH, Z.nSH, Z.sSH], ['Agency', Z.cAG, Z.nAG, Z.sAG], [],
      ['PERIODE ' + W.from + ' s.d. ' + W.to], ['Sampel dikirim', R.samp.length], ['  TikTok', R.tt], ['  Shopee', R.sh], ['Kreator dapat sampel', R.kreator], ['Biaya sampel (HPP + ongkir)', Math.round(R.totB)], ['Kontak baru diisi', R.kontak], ['Kreator di-follow-up', R.ditarget], ['Total aktivitas', R.logs.length]], [42,16,22,10]);
    add('Status & respon', [['Status', 'TikTok', 'Shopee', 'Agency'], ...STAT_ALL().map(x => [x, Z.stTT[x]||0, Z.stSH[x]||0, Z.stAG[x]||0]), [], ['Respon', 'TikTok', 'Shopee', 'Agency'], ...RESP.map(x => [x, Z.rTT[x]||0, Z.rSH[x]||0, Z.rAG[x]||0]), [], ['Status baru selama periode', 'Jumlah'], ...R.stRows], [30,10,10,10]);
    add('Prioritas & tipe', [['Prioritas', 'Arti', 'TikTok', 'Ada no. HP', 'Shopee', 'Ada no. HP'], ...[1,2,3,4,5].map(p => ['P' + p, PRIO[p], Z.pTT[p]||0, TT.filter(r => r.pr === p && hasPhone(r)).length, Z.pSH[p]||0, SH.filter(r => r.pr === p && hasPhone(r)).length]), [], ['Tipe akun', 'TikTok', 'Shopee'], ...[...new Set([...Object.keys(Z.tTT), ...Object.keys(Z.tSH)])].map(t => [t, Z.tTT[t]||0, Z.tSH[t]||0])], [16,32,10,12,10,12]);
    const mtab = blk => [['Metrik', ...blk.cols, 'Total'], ...blk.rows.map(([n, v, t]) => [n, ...v.map(x => x === null ? '' : Math.round(x)), t === 'nt' ? '' : Math.round(v.reduce((a, b) => a + (b||0), 0))])];
    add('TikTok per bulan', mtab(D.M.tt), [30,14,14,14,14,14,14,16]);
    add('Shopee per bulan', mtab(D.M.sh), [30,14,14,14,14,14,14,16]);
    add('Per hari', [['Hari', 'Sampel TikTok', 'Sampel Shopee', 'Kontak diisi', 'Follow-up/status', 'Semua aktivitas'], ...R.daily], [12,14,14,12,16,16]);
    add('Sampel', [['Tanggal','Platform','Toko','Username','Produk','SKU','HPP','Ongkir','Biaya','ID pesanan','Ekspedisi','Status posting'], ...R.samp.map(r => [r.tgl.slice(0,10), r.platform, r.toko||'', r.username, r.produk||'', r.sku||'', Math.round(r.hpp||0), Number(r.ongkir)||0, Math.round(R.biaya(r)), r.id||'', r.ekspedisi||'', r.status||''])], [12,10,14,22,18,20,10,10,10,22,12,16]);
    add('Aktivitas', [['Waktu (WIB)','Petugas','Jenis','Platform','Kreator','Detail'], ...R.logs.map(e => [new Date(e.at).toLocaleString('id-ID', {timeZone:'Asia/Jakarta'}), whoOf(e), LOGTYPE[e.type]||e.type, e.platform||'', e.target||'', e.detail||''])], [20,22,16,10,24,70]);
    await save(fn('xlsx'), new Blob([XLSX.write(wb, {bookType:'xlsx', type:'array'})]));
  };
  document.getElementById('mt-png').onclick = async () => {
    const R = meetCalc(W.from, W.to), F = 'Arial, sans-serif', sub = `${fmtD(W.from)} – ${fmtD(W.to)}`;
    const mk = (title) => { const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 1600, 900); g.fillStyle = '#1f2430'; g.font = `bold 40px ${F}`; g.fillText(title, 60, 80); g.fillStyle = '#6b7280'; g.font = `24px ${F}`; g.fillText(sub, 60, 120); return [c, g]; };
    const kpis = (g, K, y) => K.forEach(([l, v, s2], i) => { const w = (1480 - (K.length - 1) * 20) / K.length, x = 60 + i * (w + 20); g.fillStyle = '#f4f5f8'; g.fillRect(x, y, w, 150); g.fillStyle = '#6b7280'; g.font = `19px ${F}`; g.fillText(l, x + 18, y + 38); g.fillStyle = '#1f2430'; g.font = `bold ${String(v).length > 8 ? 30 : 44}px ${F}`; g.fillText(String(v), x + 18, y + 95); if (s2) { g.fillStyle = '#6b7280'; g.font = `16px ${F}`; g.fillText(s2, x + 18, y + 130); } });
    const table = (g, x, y, title, head, rows, ws, fs = 18) => { g.fillStyle = '#1f2430'; g.font = `bold 24px ${F}`; g.fillText(title, x, y); y += 38; g.font = `bold ${fs}px ${F}`; g.fillStyle = '#6b7280'; let cx = x; head.forEach((h, i) => { g.textAlign = i ? 'right' : 'left'; g.fillText(h, i ? cx + ws[i] : cx, y); cx += ws[i] + 14; }); g.textAlign = 'left'; g.font = `${fs}px ${F}`; g.fillStyle = '#1f2430'; rows.forEach(r => { y += fs + 13; cx = x; r.forEach((v, i) => { g.textAlign = i ? 'right' : 'left'; let t = String(v); while (i === 0 && g.measureText(t).width > ws[0] && t.length > 3) t = t.slice(0, -2) + '…'; g.fillText(t, i ? cx + ws[i] : cx, y); cx += ws[i] + 14; }); g.textAlign = 'left'; }); };
    // slide 1: kondisi saat ini
    const [c1, g1] = mk('Reporting Affiliate JustFluff — Progres follow-up');
    kpis(g1, [['Sudah dihubungi (P1–P3)', nf.format(Z.cTT+Z.cSH+Z.cAG), 'dari ' + nf.format(Z.nTT+Z.nSH+Z.nAG)], ['Perlu di-follow-up', nf.format(Z.due), 'belum respon ≥3 hari'], ['Sampel all time', kvs(Z.K.sampelBulan), ''], ['Sampel menghasilkan order', kvs(Z.K.laku), ''], ['GMV per Rp1 sampel', kvs(Z.K.roi), '']], 160);
    table(g1, 60, 380, 'Status', ['Status', 'TikTok', 'Shopee', 'Agency'], STAT_ALL().map(x => [x, nf.format(Z.stTT[x]||0), nf.format(Z.stSH[x]||0), Z.stAG[x]||0]), [230, 90, 90, 80], 17);
    table(g1, 690, 380, 'Prioritas', ['Prioritas', 'TikTok', 'No. HP', 'Shopee', 'No. HP'], [1,2,3,4,5].map(p => ['P' + p + ' ' + PRIO[p], nf.format(Z.pTT[p]||0), nf.format(TT.filter(r => r.pr === p && hasPhone(r)).length), nf.format(Z.pSH[p]||0), nf.format(SH.filter(r => r.pr === p && hasPhone(r)).length)]), [330, 80, 80, 80, 80], 17);
    // slide 2: GMV per bulan
    const [c2, g2] = mk('Reporting Affiliate JustFluff — Penjualan per bulan');
    g2.fillStyle = '#fff'; g2.fillRect(0, 95, 1600, 40); g2.fillStyle = '#6b7280'; g2.font = `24px ${F}`; g2.fillText('Data penjualan s.d. ' + (D.M.tt.cols[D.M.tt.cols.length-1] || ''), 60, 120);
    const mrow = blk => blk.rows.map(([n, v, t]) => [n, ...v.map(x => x === null ? '–' : (t === 'rp' ? rpShort(x) : nf.format(x)))]);
    table(g2, 60, 180, 'TikTok', ['Metrik', ...D.M.tt.cols], mrow(D.M.tt), [330, ...D.M.tt.cols.map(() => 110)], 17);
    table(g2, 60, 560, 'Shopee', ['Metrik', ...D.M.sh.cols], mrow(D.M.sh), [330, ...D.M.sh.cols.map(() => 110)], 17);
    // slide 3: periode
    const [c3, g3] = mk('Reporting Affiliate JustFluff — Aktivitas periode');
    kpis(g3, [['Sampel dikirim', nf.format(R.samp.length), `TikTok ${R.tt} · Shopee ${R.sh}`], ['Kreator dapat sampel', nf.format(R.kreator), ''], ['Biaya sampel', rp(R.totB), 'HPP + ongkir'], ['Kontak baru', nf.format(R.kontak), ''], ['Kreator di-follow-up', nf.format(R.ditarget), ''], ['Total aktivitas', nf.format(R.logs.length), '']], 160);
    const dRows = R.span <= 14 ? R.daily.map(r => [fmtD(r[0]), r[1], r[2], r[3], r[4]]) : (() => { const o = []; for (let i = 0; i < R.daily.length; i += 7) { const ch = R.daily.slice(i, i + 7); o.push([ch[0][0].slice(5) + ' s.d. ' + ch[ch.length-1][0].slice(5), ...[1,2,3,4].map(j => ch.reduce((a, r) => a + r[j], 0))]); } return o.slice(0, 14); })();
    table(g3, 60, 380, R.span <= 14 ? 'Per hari' : 'Per 7 hari', [R.span <= 14 ? 'Hari' : 'Periode', 'TikTok', 'Shopee', 'Kontak', 'Follow-up'], dRows, [230, 80, 80, 80, 100]);
    const pr = R.prodRows.slice(0, 10).map(([k, o]) => [k, o.n, rp(o.b)]);
    table(g3, 740, 380, 'Sampel per produk' + (R.prodRows.length > 10 ? ' (10 teratas)' : ''), ['Produk', 'Sampel', 'Biaya'], pr.length ? pr : [['Tidak ada sampel', '', '']], [340, 90, 160]);
    const blob = c => new Promise(r => c.toBlob(r, 'image/png'));
    const parts = [['1 progres', c1], ['2 penjualan', c2], ['3 aktivitas', c3]];
    for (const [n, c] of parts) { if (!await save(`reporting affiliate ${W.from} sd ${W.to} - ${n}.png`, await blob(c))) break; }
  };
}
/* ---------- export ---------- */
let xlsxLib = null;
function loadXlsx(){ if (xlsxLib) return xlsxLib; xlsxLib = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'; s.onload = () => res(window.XLSX); s.onerror = () => { xlsxLib = null; rej(new Error('load')); }; document.head.appendChild(s); }); return xlsxLib; }
const fuCols = r => { const f = fuOf(r) || {}; const h = daysSince(f.tglLast); return [f.kontak||'', f.tgl1||'', f.tglLast||'', h===null?'':h, f.respon||'', f.status||'Belum dihubungi', f.ket||'']; };
const FUH = ['Kontak','Tgl pertama dihubungi','Terakhir dihubungi','Hari sejak terakhir dihubungi','Respon','Status','Keterangan'];
const sampXl = r => { const st = sampStat(r), roi = sampRoi(st); return [r.gk, r.gb, r.gx, r.gest ? 'Ya' : '', st.n, st.last || '', st.has ? st.bef : '', st.has ? st.gmv : '', st.has ? st.ord : '', st.n ? st.biaya : '', roi == null ? '' : Math.round(roi*100)/100, st.blk ? 'Ya' : 'Tidak', !st.n ? '' : sampOk(st) ? 'Ya' : 'Tidak']; };
async function exportXlsx(){
  let XLSX;
  try { XLSX = await loadXlsx(); } catch(e) { toast('Gagal memuat pembuat Excel. Coba lagi.'); return; }
  const wb = XLSX.utils.book_new();
  const add = (name, aoa, widths) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = widths.map(w => ({wch:w})); XLSX.utils.book_append_sheet(wb, ws, name); };
  add('TikTok Kreator', [['Username','Link profil','Tipe',...TT_M.map(m=>'GMV '+m),'GMV total','Bulan aktif','Video','LIVE','Porsi order gagal','GMV kotor','GMV bersih','GMV batal/retur','GMV bersih/batal perkiraan','Jumlah sampel (all time)','Sampel terakhir','GMV sebelum sampel pertama','GMV sejak sampel pertama','Order sejak sampel pertama','Total biaya sampel','GMV per biaya','Diblokir dari sampel','Boleh sampel lagi (>'+ROI_MIN+'×)','Catatan data','Prioritas','Saran aksi',...FUH],
    ...TT.map(r => [r.u,'https://www.tiktok.com/@'+r.u,r.tipe,...r.g,r.tot,r.bln,r.vid,r.live,r.gagal??'',...sampXl(r),r.cat,r.pr,r.aksi,...fuCols(r)])], [22,30,18,12,12,12,12,12,12,13,8,8,8,10,8,12,8,8,12,12,8,10,16,8,55,20,12,12,10,20,16,30]);
  add('Shopee Affiliate', [['Username','Nama affiliate','Tipe','Channel utama',...SH_M.map(m=>'Omzet '+m),'Omzet total','Bulan aktif','Pembeli baru','Porsi batal','GMV kotor','GMV bersih','GMV batal/retur','GMV bersih/batal perkiraan','Jumlah sampel (all time)','Sampel terakhir','GMV sebelum sampel pertama','GMV sejak sampel pertama','Order sejak sampel pertama','Total biaya sampel','GMV per biaya','Diblokir dari sampel','Boleh sampel lagi (>'+ROI_MIN+'×)','Catatan data','Prioritas','Saran aksi',...FUH],
    ...SH.map(r => [r.u,r.nama,r.tipe,r.ch,...r.g,r.tot,r.bln,r.pb,r.batal??'',...sampXl(r),r.cat,r.pr,r.aksi,...fuCols(r)])], [22,22,18,18,12,12,12,13,8,10,10,8,12,8,8,12,12,8,10,16,8,55,20,12,12,10,20,16,30]);
  add('Agency & MCN', [['Agency / MCN','Anggota yang jualan','Omzet anggota Agu–21 Okt','Pesanan berhasil (Agu–12 Okt)','Porsi batal','Anggota terlaris','Daftar anggota','Prioritas','Saran aksi',...FUH],
    ...AGA.map(r => [r.nama,r.mem.length,r.om,r.ok,r.batal,r.top,r.mem.map(m=>m.u).join(', '),r.pr,r.aksi,...fuCols(r)])], [24,10,14,12,10,26,50,8,50,20,12,12,10,20,16,30]);
  add('Jaringan Affiliate', [['Jaringan','Akun TikTok','Akun Shopee','GMV TikTok Mei–21 Okt (kotor)','Omzet Shopee Agu–21 Okt','Total','Catatan','Prioritas','Saran aksi',...FUH],
    ...AGB.map(r => [r.nama,r.att,r.ash,r.gt,r.gs,r.tot,r.cat,r.pr,r.aksi,...fuCols(r)])], [22,36,30,14,14,14,30,8,50,20,12,12,10,20,16,30]);
  add('Anggota Agency', [['Agency / MCN','Username Shopee','Nama affiliate','Omzet Agu–21 Okt','Pesanan berhasil (Agu–12 Okt)','Pesanan total (Agu–12 Okt)'], ...D.C.map(c => c)], [24,22,24,14,12,12]);
  const buf = XLSX.write(wb, {bookType:'xlsx', type:'array'});
  const dl = await claude.use('downloads');
  if (!dl) { toast('Download tidak tersedia di tampilan ini.'); return; }
  try { await dl.save({filename:'affiliate JF task progress ' + isoToday() + '.xlsx', data: new Blob([buf])}); }
  catch (e) { if (e && e.code !== 'declined') toast(e && e.code === 'rate_limited' ? 'Tunggu sebentar lalu coba lagi.' : 'Download gagal.'); }
}

/* ---------- boot ---------- */
setTab((location.hash||'').replace('#','') || 'ringkasan', false);
const syncDot = document.getElementById('syncdot'), syncTxt = document.getElementById('synctxt');
(async () => {
  if (!window.claude || !claude.use) { dbState = 'off'; syncDot.className = 'dot off'; syncTxt.textContent = 'Catatan follow-up hanya bisa dibaca'; render(); return; }
  claude.use('user').then(async u => { userApi = u; if (u) { try { me = await u.id(); } catch(e){} } });
  const d = await claude.use('db');
  if (!d) { dbState = 'off'; syncDot.className = 'dot off'; syncTxt.textContent = 'Catatan follow-up hanya bisa dibaca'; render(); return; }
  db = d; dbState = 'ok'; syncDot.className = 'dot on'; syncTxt.textContent = 'Tersimpan';
  Object.entries(COLL).forEach(([k, c]) => {
    db.collection(c).onSnapshot(snap => {
      const m = {}; snap.docs.forEach(doc => { if (doc.exists) m[doc.id] = doc.data(); });
      FU[k] = m; rerenderSoon();
    }, err => { syncDot.className = 'dot off'; syncTxt.textContent = 'Gagal menyimpan, cek koneksi lalu muat ulang'; syncTxt.parentElement.classList.add('bad'); if (err && err.code === 'revoked') { dbState = 'off'; rerenderSoon(); } });
  });
  subscribeLog(); subscribeTeam();
  render();
})();

;

(() => {
  const $ = (id) => document.getElementById(id);
  let platform = 'TikTok';
  let db = null;
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  $('tgl_request').value = today; $('tgl_acc').value = today;
  $('tgl_request').closest('label').insertAdjacentHTML('beforebegin', '<label>Toko <span class="req">*</span><select id="toko" required></select></label>');
  const escT = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fillToko = () => { const BR = (window.AFF_BRANDS && window.AFF_BRANDS.length) ? window.AFF_BRANDS : [window.AFF_NAMA || 'Toko']; const cur = $('toko').value.split(' · ')[1]; $('toko').innerHTML = (BR.length > 1 ? '<option value="">Pilih toko…</option>' : '') + BR.map(b => `<option${b === cur ? ' selected' : ''}>${escT(platform + ' · ' + b)}</option>`).join(''); };
  window.__fillToko = fillToko;

  const setPlatform = (p) => {
    platform = p;
    $('p-tiktok').setAttribute('aria-pressed', String(p === 'TikTok'));
    $('p-shopee').setAttribute('aria-pressed', String(p === 'Shopee'));
    $('l-kode').hidden = p !== 'Shopee';
    if (p === 'Shopee') { $('ekspedisi').value = $('ekspedisi').value || 'SPX'; $('kategori').value = 'Shopee Video'; }
    else if ($('kategori').value === 'Shopee Video') $('kategori').value = '';
    fillToko();
  };
  fillToko();
  $('p-tiktok').addEventListener('click', () => setPlatform('TikTok'));
  $('p-shopee').addEventListener('click', () => setPlatform('Shopee'));

  const msg = (t, cls) => { $('msg').textContent = t; $('msg').className = 'msg ' + (cls || ''); };
  const fmtTgl = (s) => s ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(s + 'T00:00:00Z')) : '';

  const render = (docs) => {
    const list = $('list');
    if (!docs.length) { list.innerHTML = '<p class="empty">Belum ada sampel. Isi form di atas, lalu tekan Simpan sampel; hasilnya muncul di sini.</p>'; return; }
    list.replaceChildren(...docs.map((d) => {
      const r = d.data();
      const row = document.createElement('div'); row.className = 'row';
      const b = document.createElement('b'); b.textContent = `${r.username} · ${r.produk}`;
      const chip = document.createElement('span');
      chip.className = 'chip ' + (r.synced ? 'ok' : 'wait');
      chip.textContent = r.synced ? 'Sudah di sheet' : 'Menunggu sinkron';
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.textContent = [r.toko ? r.platform + ' · ' + r.toko : r.platform, 'ACC ' + fmtTgl(r.tgl_acc), r.sku, r.id_pesanan ? 'ID ' + r.id_pesanan : 'ID belum diisi', r.synced && r.sheet ? r.sheet + (r.sheet_row ? ' baris ' + r.sheet_row : '') : ''].filter(Boolean).join(' · ');
      row.append(b, chip, meta);
      const sel = document.createElement('select'); sel.className = 'stsel'; sel.setAttribute('aria-label', 'Status posting ' + r.username);
      ['', 'BELUM POSTING', 'STILL ON GOING', 'ON PENDING', 'SESUAI'].forEach((o) => sel.append(new Option(o || 'Status posting: belum dicek', o)));
      sel.value = r.status_upload || '';
      sel.addEventListener('change', async () => {
        sel.disabled = true;
        try { await db.doc('jf_sampel/' + d.id).update({ status_upload: sel.value || null, status_dirty: !!r.synced }); if (typeof logActivity === 'function') logActivity({ type: 'posting', platform: r.platform, target: r.username, detail: `Status posting: ${r.status_upload || 'belum dicek'} → ${sel.value || 'belum dicek'}` }); msg(`Status posting ${r.username} disimpan.`, 'ok'); }
        catch (e) { msg('Status gagal disimpan. Coba lagi.', 'bad'); sel.value = r.status_upload || ''; }
        finally { sel.disabled = false; }
      });
      row.append(sel);
      if (!r.synced) {
        const del = document.createElement('button'); del.type = 'button'; del.className = 'del'; del.textContent = 'Hapus';
        let armed = false;
        del.addEventListener('click', async () => {
          if (!armed) { armed = true; del.textContent = 'Tekan lagi untuk menghapus'; setTimeout(() => { armed = false; del.textContent = 'Hapus'; }, 4000); return; }
          try { await db.doc('jf_sampel/' + d.id).delete(); if (typeof logActivity === 'function') logActivity({ type: 'sampel_hapus', platform: r.platform, target: r.username, detail: `${r.produk} · ${r.sku}` + (r.id_pesanan ? ` · ID ${r.id_pesanan}` : '') }); } catch (e) { msg('Gagal menghapus. Coba lagi.', 'bad'); }
        });
        row.append(del);
      }
      return row;
    }));
  };

  $('f').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!db) { msg('Penyimpanan belum siap. Muat ulang halaman lalu coba lagi.', 'bad'); return; }
    const v = (id) => $(id).value.trim();
    const missing = ['toko', 'tgl_request', 'tgl_acc', 'username', 'sku', 'ongkir'].filter((id) => !v(id));
    if (missing.length) { msg('Lengkapi toko, tanggal, username, SKU dan ongkir dulu.', 'bad'); $(missing[0]).focus(); return; }
    const bk = bkey(platform, v('username'));
    let exception = false;
    const stx = window.__sampelStat ? window.__sampelStat(platform, v('username')) : null;
    const notEligible = stx && stx.n && !(stx.has && stx.biaya && (stx.gmv + stx.bef) / stx.biaya > 10);
    if (isBlocked(platform, v('username')) || notEligible) {
      if (overrideKey !== bk) {
        overrideKey = bk; clearTimeout(overrideT); overrideT = setTimeout(() => { overrideKey = null; }, 10000);
        msg((isBlocked(platform, v('username')) ? 'Kreator ini diblokir dari sampel karena belum pernah menghasilkan order.' : 'Kreator ini sudah pernah dapat sampel dan GMV sebelum + sesudah sampelnya belum lebih dari 10× biaya sampel (syarat finance).') + ' Kalau tetap mau kirim sebagai pengecualian, tekan Simpan sampel sekali lagi dalam 10 detik.', 'bad');
        return;
      }
      exception = true; overrideKey = null;
    }
    const ongkir = v('ongkir') === '' ? null : Number(v('ongkir'));
    const data = {
      platform, toko: v('toko').split(' · ')[1] || null, tgl_request: v('tgl_request'), tgl_acc: v('tgl_acc'),
      username: v('username').replace(/^@+/, ''), produk: v('produk'), sku: v('sku').toUpperCase().replace(/\s+/g, ''),
      id_pesanan: v('id_pesanan') || null, kode_permintaan: platform === 'Shopee' ? (v('kode') || null) : null,
      ekspedisi: v('ekspedisi') || null, ongkir, kategori: v('kategori') || null, status_upload: v('status_upload') || null,
      created_at: new Date().toISOString(), synced: false,
    };
    if (exception) { if (isBlocked(platform, v('username'))) data.pengecualian_blokir = true; else data.pengecualian_syarat_roi = true; }
    $('submit').disabled = true;
    try {
      await db.collection('jf_sampel').add(data);
      try { if (typeof logActivity === 'function') logActivity({ type: 'sampel', platform: data.platform, target: data.username, detail: `${data.produk} · ${data.sku}` + (data.id_pesanan ? ` · ID ${data.id_pesanan}` : '') + ` · ongkir Rp${nf.format(data.ongkir || 0)}` + (exception ? (isBlocked(data.platform, data.username) ? ' · PENGECUALIAN BLOKIR' : ' · PENGECUALIAN SYARAT >10×') : '') }); } catch (e3) {}
      let linked = false;
      try { if (typeof markSampleSent === 'function') linked = await markSampleSent(data.platform, data.username); } catch (e2) {}
      msg(`Tersimpan: ${data.username} (${data.produk}).` + (linked ? ' Status follow-up kreator ini diubah jadi "Produk dikirim".' : ''), 'ok');
      ['username', 'sku', 'id_pesanan', 'kode', 'ongkir'].forEach((id) => { $(id).value = ''; });
      $('u-info').textContent = ''; $('u-info').className = 'uinfo';
      $('username').focus();
    } catch (err) {
      msg(err && err.code === 'quota_exceeded' ? 'Penyimpanan penuh. Minta Claude merapikan data yang sudah tersinkron.' : 'Gagal menyimpan. Periksa koneksi lalu coba lagi.', 'bad');
    } finally { $('submit').disabled = false; }
  });

  // ---------- Tabs (driven by the page's main tab bar) ----------
  const showTab = (name) => {
    const ring = name === 'ringkasan';
    $('input').hidden = ring; $('rekap').hidden = !ring; $('efektif').hidden = !ring;
    if (ring) { drawRekap(); drawEf(); }
  };
  ['rekap', 'efektif'].forEach((id) => $(id).addEventListener('toggle', () => { if ($(id).open) { drawRekap(); drawEf(); } }));
  const kickSummary = () => { try { if (typeof S !== 'undefined' && S.tab === 'ringkasan' && typeof rerenderSoon === 'function') rerenderSoon(); } catch (e) {} };
  // ---------- Rekap ----------
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  // HPP per pack dari sheet "Pricing Structure Agustus 2026" (file pricing JustFluff)
  const HPP_PACK = {
    'Mix Alpha': { 1: 8300, 2: 15000, 3: 22000, 4: 29000 },
    'Mix Dubai': { 1: 12000, 2: 24000, 3: 36000 },
    'Mix Gag': { 1: 14800, 2: 26000, 3: 39500, 4: 52500 },
    'Mix Rainbow': { 1: 10050, 2: 20100, 3: 30150 },
  };
  const HPP_UNIT = { 'Poppin Boozled': 46000, 'Poppin Gag': 30300, 'Minicube': 42000, 'Mallow Strips': 8100, 'Bites Ultimate': 20000, 'Sour Duck': 12000, 'Signature One Cube': 3800 };
  const hppOf = (produk, sku, pack) => {
    if (window.AFF_HPP) { const v = window.AFF_HPP[String(produk || '').toUpperCase().trim()]; return (v != null ? v : (window.AFF_HPP_DEFAULT || 0)) * (pack || 1); }
    const s = String(sku || '').toUpperCase().replace(/\s+/g, '');
    pack = pack || 1;
    if (produk === 'Boozled + Alpha') return HPP_UNIT['Poppin Boozled'] + HPP_PACK['Mix Alpha'][1];
    if (produk === 'Mallow Strips' && /^4|SOUR/.test(s)) return 35000;
    if (produk === 'Poppin Gag' && /PACK/.test(s)) { const t = HPP_PACK['Mix Gag']; return t[pack] ?? t[1] * pack; }
    const t = HPP_PACK[produk];
    if (t) return t[pack] ?? t[1] * pack;
    return HPP_UNIT[produk] != null ? HPP_UNIT[produk] * pack : null;
  };
  const fam = (s) => {
    s = String(s || '').toUpperCase().replace(/\s+/g, '');
    if (!s) return null;
    if (s.includes('BOOZLED') && s.includes('ALPHA')) return 'Boozled + Alpha';
    if (s.includes('ALPHA')) return 'Mix Alpha';
    if (s.includes('BOOZLED') || s.includes('BRUTAL')) return 'Poppin Boozled';
    if (s.includes('WORST')) return 'The Worst';
    if (s.includes('DUBAI')) return 'Mix Dubai';
    if (s.includes('GAG')) return 'Poppin Gag';
    if (s.includes('RAINBOW')) return 'Mix Rainbow';
    if (s.includes('MINICUBE')) return 'Minicube';
    if (/STRIPS|KIWIMELON|MANGOCRINGE|LECY/.test(s)) return 'Mallow Strips';
    if (s.includes('SOURDUCK')) return 'Sour Duck';
    if (s.includes('SIGNATURE') || s.includes('ONECUBE')) return 'Signature One Cube';
    if (/CHOCOBANANA|CHOCOMINT|STRAWBERRYMATCHA|BITES/.test(s)) return 'Bites Ultimate';
    return 'Lainnya';
  };
  const packOf = (sku) => { const m = String(sku || '').toUpperCase().match(/(\d)\s*PACK|PACK(\d)|^(\d)MIX/); return m ? Number(m[1] || m[2] || m[3]) : 1; };
  const nf = new Intl.NumberFormat('id-ID');
  const rpc = (v) => 'Rp' + new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 }).format(v);
  const pf = (v) => new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 0 }).format(v);
  let hist = null, webDocs = [], histErr = false;

  fetch(window.AFF_SRC('sampel_mei_okt.json')).then((r) => { if (!r.ok) throw new Error(); return r.json(); })
    .then((rows) => {
      hist = rows.map((r) => ({ platform: r.platform, ym: (r.tgl || '2026-' + String(r.bulan_no).padStart(2, '0')).slice(0, 7), username: r.username, user_n: String(r.username).trim().replace(/^@+/, '').toLowerCase(),
        produk: r.produk, sku: r.sku, pack: r.pack || 1, id: r.id_pesanan, tgl: r.tgl, ekspedisi: r.ekspedisi, ongkir: r.ongkir, est: r.ongkir_perkiraan || null, status: r.status_upload, cat: r.catatan, sumber: r.sumber, src: 'log' }));
      drawRekap(); kickSummary(); kickLists(); try { if (S.tab === 'weekly') rerenderSoon(); } catch (e) {}
      fillProduk();
    }).catch(() => { histErr = true; drawRekap(); kickSummary(); kickLists(); });

  // Saran nama produk (isian bebas): dari produk yang pernah diinput untuk klien ini
  const fillProduk = () => { const dl = document.getElementById('produk-list'); if (!dl) return; const seen = new Map();
    allRows().forEach((r) => { const p = String(r.produk || '').trim(); if (p && p !== 'LAINNYA') seen.set(p.toLowerCase(), p); });
    dl.innerHTML = [...seen.values()].sort().map((p) => `<option value="${String(p).replace(/"/g, '&quot;')}"></option>`).join(''); };
  const allRows = () => {
    const base = hist || [];
    const seen = new Set(base.filter((r) => r.id).map((r) => r.platform + '|' + r.id + '|' + r.user_n));
    const web = webDocs.map((d) => {
      const r = d.data();
      return { toko: r.toko || '', platform: r.platform, ym: String(r.tgl_acc || r.created_at || '').slice(0, 7), username: r.username, user_n: String(r.username || '').trim().replace(/^@+/, '').toLowerCase(),
        produk: fam(r.sku) && fam(r.sku) !== 'Lainnya' ? fam(r.sku) : fam(r.produk), sku: r.sku, pack: packOf(r.sku), id: r.id_pesanan, tgl: r.tgl_acc, ekspedisi: r.ekspedisi, ongkir: r.ongkir, status: r.status_upload, src: 'web' };
    }).filter((r) => !(r.id && seen.has(r.platform + '|' + r.id + '|' + r.user_n)));
    return base.concat(web);
  };
  const ymLabel = (ym) => { const [y, m] = ym.split('-'); return BULAN[Number(m) - 1] + ' ' + y; };
  const td = (tr, text, cls) => { const c = document.createElement('td'); if (cls) c.className = cls; c.textContent = text; tr.append(c); return c; };
  const barTd = (tr, v, max, cls) => {
    const c = document.createElement('td'); c.className = 'n';
    const w = document.createElement('div'); w.className = 'bc';
    const i = document.createElement('i'); if (cls) i.className = cls; i.style.width = (max ? Math.max(2, v / max * 80) : 0) + 'px';
    const s = document.createElement('span'); s.textContent = nf.format(v);
    w.append(i, s); c.append(w); tr.append(c);
  };

  const drawRekap = () => {
    if ($('rekap').hidden) return;
    if (!hist && !histErr) return;
    const all = allRows();
    // month filter options
    const yms = [...new Set(all.map((r) => r.ym).filter(Boolean))].sort();
    const fb = $('f-bulan'), cur = fb.value;
    if (fb.options.length - 1 !== yms.length) {
      fb.replaceChildren(new Option('Semua bulan', ''), ...yms.map((y) => new Option(ymLabel(y), y)));
      fb.value = yms.includes(cur) ? cur : '';
    }
    const fp = $('f-plat').value, fm = fb.value;
    const rows = all.filter((r) => (!fp || r.platform === fp) && (!fm || r.ym === fm));
    const n = rows.length;
    const nWeb = rows.filter((r) => r.src === 'web').length;
    $('k-sampel').textContent = nf.format(n);
    $('k-baru').textContent = nWeb ? `${nf.format(nWeb)} dari form web` : 'belum ada dari form web';
    $('k-kreator').textContent = nf.format(new Set(rows.map((r) => r.platform + '|' + r.user_n)).size);
    const hpp = rows.reduce((s, r) => s + (hppOf(r.produk, r.sku, r.pack) || 0), 0);
    $('k-hpp').textContent = rpc(hpp);
    const ong = rows.reduce((s, r) => s + (Number(r.ongkir) || 0), 0);
    const ongEst = rows.filter((r) => r.est);
    $('k-ongkir').textContent = rpc(ong);
    $('k-ongkir-est').textContent = ongEst.length ? `${pf(ongEst.reduce((s, r) => s + r.ongkir, 0) / (ong || 1))} perkiraan dari kota tujuan` : 'semua ongkir asli';
    const up = rows.filter((r) => r.status);
    $('k-upload').textContent = n ? pf(up.length / n) : '—';
    $('k-sesuai').textContent = `${nf.format(up.filter((r) => r.status === 'SESUAI').length)} berstatus SESUAI`;
    $('rk-sum').innerHTML = '';
    const sum = $('rk-sum');
    sum.append('Menampilkan ', Object.assign(document.createElement('b'), { textContent: nf.format(n) + ' sampel' }), ` (${fp || 'TikTok & Shopee'}, ${fm ? ymLabel(fm) : 'semua bulan'}).`);
    if (histErr) sum.append(' Data lama Mei–Okt gagal dimuat, jadi yang tampil hanya input dari form.');

    // per bulan
    const byM = d3group(rows, (r) => r.ym);
    const keys = [...byM.keys()].filter(Boolean).sort();
    const maxM = Math.max(1, ...keys.map((k) => Math.max(byM.get(k).filter((r) => r.platform === 'TikTok').length, byM.get(k).filter((r) => r.platform === 'Shopee').length)));
    const tb = $('tb-bulan'); tb.replaceChildren();
    keys.forEach((k) => {
      const rs = byM.get(k); const tr = document.createElement('tr');
      td(tr, ymLabel(k));
      barTd(tr, rs.filter((r) => r.platform === 'TikTok').length, maxM);
      barTd(tr, rs.filter((r) => r.platform === 'Shopee').length, maxM, 's2');
      td(tr, nf.format(rs.length), 'n');
      td(tr, nf.format(new Set(rs.map((r) => r.platform + '|' + r.user_n)).size), 'n');
      td(tr, pf(rs.filter((r) => r.produk === 'Mix Alpha').length / rs.length), 'n');
      td(tr, pf(rs.filter((r) => r.produk === 'Poppin Boozled').length / rs.length), 'n');
      const w = rs.filter((r) => r.src === 'web').length;
      const c = td(tr, w ? '+' + nf.format(w) : '–', 'n'); if (w) c.classList.add('new');
      tb.append(tr);
    });
    if (keys.length > 1) {
      const tr = document.createElement('tr'); tr.className = 'tot';
      td(tr, 'Total'); td(tr, nf.format(rows.filter((r) => r.platform === 'TikTok').length), 'n'); td(tr, nf.format(rows.filter((r) => r.platform === 'Shopee').length), 'n');
      td(tr, nf.format(n), 'n'); td(tr, nf.format(new Set(rows.map((r) => r.platform + '|' + r.user_n)).size), 'n'); td(tr, pf(rows.filter((r) => r.produk === 'Mix Alpha').length / n), 'n'); td(tr, pf(rows.filter((r) => r.produk === 'Poppin Boozled').length / n), 'n'); td(tr, nWeb ? '+' + nf.format(nWeb) : '–', 'n');
      tb.append(tr);
    }

    // per produk
    const skuKey = (r) => String(r.sku || '').toUpperCase().replace(/\s+/g, '') || '(SKU kosong)';
    const byP = d3group(rows, skuKey);
    const pk = [...byP.keys()].sort((a, b) => byP.get(b).length - byP.get(a).length || a.localeCompare(b));
    const maxP = Math.max(1, ...pk.map((k) => byP.get(k).length));
    const tp = $('tb-produk'); tp.replaceChildren();
    pk.forEach((k) => {
      const rs = byP.get(k); const tr = document.createElement('tr');
      const prods = [...new Set(rs.map((r) => r.produk || 'Produk kosong'))].join(', ');
      td(tr, k); td(tr, prods); barTd(tr, rs.length, maxP); td(tr, pf(rs.length / n), 'n');
      const hs = rs.map((r) => hppOf(r.produk, r.sku, r.pack));
      const known = hs.filter((h) => h != null);
      td(tr, known.length ? 'Rp' + nf.format(Math.round(known[0])) : 'belum ada HPP', known.length ? 'n' : 'n new');
      td(tr, known.length ? rpc(known.reduce((a, h) => a + h, 0)) : '–', 'n');
      tp.append(tr);
    });

    // kelengkapan
    const tl = $('tb-lengkap'); tl.replaceChildren();
    ['TikTok', 'Shopee'].forEach((p) => keys.forEach((k) => {
      const rs = byM.get(k).filter((r) => r.platform === p); if (!rs.length) return;
      const tr = document.createElement('tr'); td(tr, p); td(tr, ymLabel(k)); td(tr, nf.format(rs.length), 'n');
      ['status', 'ongkir', 'ekspedisi', 'id'].forEach((f) => {
        const v = rs.filter((r) => r[f] !== null && r[f] !== undefined && r[f] !== '').length / rs.length;
        const c = td(tr, pf(v), 'pct' + (v < 0.5 ? ' lo' : ''));
        if (f === 'ongkir') { const e = rs.filter((r) => r.est).length; if (e) { const sm = document.createElement('div'); sm.className = 'note'; sm.textContent = pf(e / rs.length) + ' perkiraan'; c.append(sm); } }
      });
      tl.append(tr);
    }));

    // log vs TARGET (angka dari sheet TARGET file Data Affiliate)
    const TGT = [['2026-05', 'Capaian dilaporkan', 333, null], ['2026-06', 'Capaian dilaporkan', 436, 50], ['2026-07', 'Capaian dilaporkan', 422, 50], ['2026-08', 'Target', 523, 100]];
    const tt = $('tb-target'); tt.replaceChildren();
    TGT.filter(([ym]) => !fm || ym === fm).forEach(([ym, jenis, t1, t2]) => {
      const rs = all.filter((r) => r.ym === ym);
      const l1 = rs.filter((r) => r.platform === 'TikTok').length, l2 = rs.filter((r) => r.platform === 'Shopee').length;
      const tr = document.createElement('tr'); td(tr, ymLabel(ym)); td(tr, jenis);
      td(tr, nf.format(t1), 'n'); td(tr, nf.format(l1), 'n' + (l1 < t1 * 0.9 ? ' lo pct' : ''));
      td(tr, t2 == null ? '–' : nf.format(t2), 'n'); td(tr, nf.format(l2), 'n' + (t2 != null && l2 < t2 * 0.9 ? ' lo pct' : ''));
      tt.append(tr);
    });
    if (!tt.children.length) { const tr = document.createElement('tr'); const c = td(tr, 'Sheet TARGET hanya punya angka Mei–Agustus.'); c.colSpan = 6; c.className = 'note'; tt.append(tr); }

    // perlu dicek
    const qc = $('q-cek').value.trim().toLowerCase();
    const tc = $('tb-cek'); tc.replaceChildren();
    rows.filter((r) => r.cat).filter((r) => !qc || [r.cat, r.username, r.id, r.sku].some((v) => v && String(v).toLowerCase().includes(qc))).forEach((r) => {
      const tr = document.createElement('tr'); td(tr, r.cat); td(tr, r.platform); td(tr, ymLabel(r.ym)); td(tr, r.username); td(tr, r.sku || ''); td(tr, r.id || ''); td(tr, r.sumber || ''); tc.append(tr);
    });
    $('n-cek').textContent = '· ' + nf.format(rows.filter((r) => r.cat).length) + ' baris';
    if (!tc.children.length) { const tr = document.createElement('tr'); const c = td(tr, 'Tidak ada baris bermasalah untuk filter ini.'); c.colSpan = 7; c.className = 'note'; tc.append(tr); }

    // kreator berulang
    const byU = d3group(rows, (r) => r.platform + '|' + r.user_n);
    const rep = [];
    byU.forEach((rs) => {
      const kir = new Set(rs.map((r, i) => r.id || 'x' + i)).size;
      if (kir < 2) return;
      const pc = {}; rs.forEach((r) => { const p = r.produk || 'Produk kosong'; pc[p] = (pc[p] || 0) + 1; });
      rep.push({ platform: rs[0].platform, username: rs[0].username, kiriman: kir,
        bulan: [...new Set(rs.map((r) => r.ym).filter(Boolean))].sort().map((y) => BULAN[Number(y.slice(5)) - 1]).join(', '),
        produk: Object.entries(pc).sort((a, b) => b[1] - a[1]).map(([p, c]) => `${p} (${c})`).join(', ') });
    });
    rep.sort((a, b) => b.kiriman - a.kiriman || a.username.localeCompare(b.username));
    $('k-ulang').textContent = nf.format(rep.length);
    const q = $('q-ulang').value.trim().toLowerCase();
    const tu = $('tb-ulang'); tu.replaceChildren();
    rep.filter((r) => !q || String(r.username).toLowerCase().includes(q)).forEach((r) => {
      const tr = document.createElement('tr'); td(tr, r.platform); td(tr, r.username); td(tr, nf.format(r.kiriman), 'n'); td(tr, r.bulan); td(tr, r.produk); tu.append(tr);
    });
  };
  const d3group = (arr, key) => { const m = new Map(); arr.forEach((x) => { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };

  // ---------- Efektivitas ----------
  let ef = null;
  fetch(window.AFF_SRC('efektivitas.json')).then((r) => r.json()).then((d) => { ef = d; drawEf(); kickSummary(); kickLists(); }).catch(() => { $('ef-take').textContent = 'Analisa gagal dimuat. Muat ulang halaman.'; });
  const rx = (v) => v.toLocaleString('id-ID', { maximumFractionDigits: 2 }) + '×';
  const efRow = (tb, d) => {
    const tr = document.createElement('tr');
    td(tr, d.label); td(tr, nf.format(d.kiriman), 'n'); td(tr, pf(d.laku / d.kiriman), 'n'); td(tr, rpc(d.gmv), 'n'); td(tr, rpc(d.biaya), 'n');
    const r = d.gmv / d.biaya; td(tr, rx(r), 'n' + (r >= 1 ? ' new' : '')); td(tr, d.gmv_kotor ? pf(1 - d.gmv_tk / d.gmv_kotor) : '–', 'n');
    tb.append(tr);
  };
  const efAgg = (g, label) => { const tk = g.filter((r) => r.kotor != null); return { label, kiriman: g.length, laku: g.filter((r) => r.ord > 0).length, gmv: g.reduce((s, r) => s + r.gmv, 0), biaya: g.reduce((s, r) => s + r.biaya, 0), gmv_tk: tk.reduce((s, r) => s + r.gmv, 0), gmv_kotor: tk.reduce((s, r) => s + r.kotor, 0) }; };
  const drawEf = () => {
    if (!ef || $('efektif').hidden) return;
    const fb = $('ef-bulan');
    if (fb.options.length === 1) ['Mei', 'Jun', 'Jul', 'Agu'].forEach((b) => fb.append(new Option(b + ' 2026', b)));
    const plLbl = $('ef-plat').value || 'TikTok & Shopee';
    const bm = fb.value;
    const pl = $('ef-plat').value;
    const R = ef.rows.filter((r) => (!bm || r.b === bm) && (!pl || r.pl === pl));
    if (!R.length) { $('ef-take').textContent = 'Tidak ada kiriman di bulan ini.'; return; }
    const T = efAgg(R, 'Total');
    const per = bm ? fb.selectedOptions[0].textContent : 'Mei–Agustus';
    $('e-kir').textContent = nf.format(T.kiriman); $('e-laku').textContent = pf(T.laku / T.kiriman); $('e-laku-n').textContent = nf.format(T.laku) + ' kiriman';
    $('e-gmv').textContent = rpc(T.gmv); $('e-biaya').textContent = rpc(T.biaya); $('e-roi').textContent = rx(T.gmv / T.biaya);
    $('e-bep').textContent = nf.format(R.filter((r) => r.gmv >= r.biaya).length) + ' kiriman balik modal';
    const prodG = [...d3group(R, (r) => r.p)].map(([k, g]) => efAgg(g, k)).sort((a, b) => b.kiriman - a.kiriman);
    const al = prodG.find((p) => p.label === 'Mix Alpha'), bz = prodG.find((p) => p.label === 'Poppin Boozled');
    const akt = efAgg(R.filter((r) => r.akt), 'Sudah jualan 30 hari sebelumnya'), baru = efAgg(R.filter((r) => !r.akt), 'Belum jualan 30 hari sebelumnya');
    let take = `Sampel ${plLbl} ${per} kembali ${rx(T.gmv / T.biaya)} biayanya dalam 30 hari; ${pf(1 - T.laku / T.kiriman)} kiriman tidak menghasilkan order.`;
    if (al && bz) take += ` Mix Alpha ${rx(al.gmv / al.biaya)}, Poppin Boozled ${rx(bz.gmv / bz.biaya)}.`;
    if (akt.kiriman) take += ` Kreator yang sudah jualan sebelumnya ${rx(akt.gmv / akt.biaya)}, kreator baru ${rx(baru.gmv / (baru.biaya || 1))}.`;
    $('ef-take').textContent = take;
    const ong = R.reduce((s, r) => s + r.ong, 0), ongE = R.filter((r) => r.est).reduce((s, r) => s + r.ong, 0);
    $('ef-per').textContent = ef.periode + '. ' + pf(ong ? ongE / ong : 0) + ' biaya ongkir masih perkiraan.';
    const fill = (id, arr) => { const tb = $(id); tb.replaceChildren(); arr.forEach((d) => efRow(tb, d)); };
    const bulanG = ['Mei', 'Jun', 'Jul', 'Agu'].map((b) => efAgg(R.filter((r) => r.b === b), b)).filter((d) => d.kiriman);
    fill('et-bulan', bulanG.length > 1 ? bulanG.concat([T]) : bulanG);
    if (bulanG.length > 1) $('et-bulan').lastElementChild.className = 'tot';
    fill('et-produk', prodG.filter((d) => d.kiriman >= 3));
    fill('et-grup', [baru, akt, efAgg(R.filter((r) => r.ke === 1), 'Sampel pertama'), efAgg(R.filter((r) => r.ke > 1), 'Sampel ke-2 dst.')].filter((d) => d.kiriman));
    const A = R.filter((r) => r.akt);
    $('ef-prepost').textContent = A.length ? `Catatan: ${A.length} kiriman ke kreator yang sudah jualan menghasilkan ${rpc(A.reduce((s, r) => s + r.gmv, 0))} setelah sampel, dibanding ${rpc(A.reduce((s, r) => s + r.pre, 0))} pada 30 hari sebelumnya.` : '';
    const bins = [[-1, 0, 'Rp0'], [0, 1e5, '≤Rp100 rb'], [1e5, 5e5, 'Rp100–500 rb'], [5e5, 2e6, 'Rp500 rb–2 jt'], [2e6, 1e13, '>Rp2 jt']];
    const sb = bins.map(([lo, hi, l]) => ({ l, n: R.filter((r) => r.gmv > lo && r.gmv <= hi).length }));
    const se = $('et-sebaran'); se.replaceChildren();
    sb.forEach((d) => { const tr = document.createElement('tr'); td(tr, d.l); barTd(tr, d.n, Math.max(...sb.map((x) => x.n))); td(tr, pf(d.n / T.kiriman), 'n'); se.append(tr); });
    const cr = [...d3group(R, (r) => r.u)].map(([u, g]) => ({ username: u, kiriman: g.length, produk: [...new Set(g.map((r) => r.p))].join(', '), order: g.reduce((s, r) => s + r.ord, 0), gmv: g.reduce((s, r) => s + r.gmv, 0), biaya: g.reduce((s, r) => s + r.biaya, 0) }));
    const tp = $('et-top'); tp.replaceChildren();
    cr.filter((d) => d.gmv > 0).sort((a, b) => b.gmv - a.gmv).slice(0, 25).forEach((d) => { const tr = document.createElement('tr'); td(tr, d.username); td(tr, nf.format(d.kiriman), 'n'); td(tr, d.produk); td(tr, nf.format(d.order), 'n'); td(tr, rpc(d.gmv), 'n'); td(tr, rpc(d.biaya), 'n'); td(tr, rx(d.gmv / d.biaya), 'n'); tp.append(tr); });
    const nol = cr.filter((d) => d.gmv === 0), nolU = nol.filter((d) => d.kiriman > 1).sort((a, b) => b.biaya - a.biaya);
    $('ef-nol').textContent = `${nf.format(nol.length)} kreator belum menghasilkan order dari sampel ${per} (biaya ${rpc(nol.reduce((s, d) => s + d.biaya, 0))}). ${nf.format(nolU.length)} di antaranya dikirimi lebih dari sekali${bm ? ' di bulan ini' : ''}.`;
    const tn = $('et-nol'); tn.replaceChildren();
    nolU.forEach((d) => { const tr = document.createElement('tr'); td(tr, d.username); td(tr, nf.format(d.kiriman), 'n'); td(tr, d.produk); td(tr, rpc(d.biaya), 'n'); tn.append(tr); });
  };
  $('ef-bulan').addEventListener('change', drawEf);
  $('ef-plat').addEventListener('change', drawEf);
  $('f-plat').addEventListener('change', drawRekap);
  $('f-bulan').addEventListener('change', drawRekap);
  $('q-ulang').addEventListener('input', drawRekap);
  $('q-cek').addEventListener('input', drawRekap);

  // ---------- Blokir sampel ----------
  const BLK = new Map((typeof D !== 'undefined' && D.X ? D.X : []).map((x) => [(x[0] === 'T' ? 'TikTok' : 'Shopee') + '|' + x[1].toLowerCase(), { platform: x[0] === 'T' ? 'TikTok' : 'Shopee', username: x[1], n: x[2], first: x[3], last: x[4], produk: x[5] }]));
  let UNB = {};
  const bkey = (pl, u) => pl + '|' + String(u || '').trim().replace(/^@+/, '').toLowerCase();
  const bid = (k) => k.replace(/[^A-Za-z0-9_\-~:@+.]/g, '_').slice(0, 190);
  const isBlocked = (pl, u) => { const k = bkey(pl, u); return BLK.has(k) && !UNB[bid(k)]; };
  const drawBlok = () => {
    const q = $('q-blok').value.trim().toLowerCase();
    const all = [...BLK.entries()];
    $('n-blok').textContent = '· ' + nf.format(all.filter(([k]) => !UNB[bid(k)]).length) + ' kreator';
    const tb = $('tb-blok'); tb.replaceChildren();
    all.filter(([, b]) => !q || b.username.toLowerCase().includes(q)).sort((a, b) => b[1].n - a[1].n || a[1].username.localeCompare(b[1].username)).forEach(([k, b]) => {
      const tr = document.createElement('tr'); const un = !!UNB[bid(k)]; if (un) tr.className = 'unblocked';
      td(tr, b.platform); td(tr, b.username); td(tr, nf.format(b.n), 'n'); td(tr, fmtTgl(b.first)); td(tr, fmtTgl(b.last)); td(tr, b.produk);
      const c = document.createElement('td'); const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'unb';
      btn.textContent = un ? 'Blokir lagi' : 'Buka blokir';
      btn.addEventListener('click', async () => {
        if (!db) return; btn.disabled = true;
        try { if (un) await db.doc('jf_sampel_unblock/' + bid(k)).delete(); else await db.doc('jf_sampel_unblock/' + bid(k)).set({ key: k, at: new Date().toISOString() }); if (typeof logActivity === 'function') logActivity({ type: 'blokir', platform: b.platform, target: b.username, detail: un ? 'Diblokir lagi dari sampel' : 'Blokir sampel dibuka' }); }
        catch (e) { msg('Gagal mengubah blokir. Coba lagi.', 'bad'); btn.disabled = false; }
      });
      c.append(btn); tr.append(c); tb.append(tr);
    });
  };
  $('q-blok').addEventListener('input', drawBlok);
  let overrideKey = null, overrideT = null;

  // ---------- Prefill dari follow-up ----------
  window.__sampelPrefill = (plat, user) => {
    setPlatform(plat); $('username').value = user; userInfo(); $('sku').focus();
    msg(`Mengisi sampel untuk ${user}. Lengkapi SKU, ID pesanan dan ongkir.`, '');
  };
  // ---------- Info kreator saat mengetik username ----------
  const userInfo = () => {
    const el = $('u-info');
    const u = $('username').value.trim().replace(/^@+/, '').toLowerCase();
    if (u.length < 3) { el.textContent = ''; el.className = 'uinfo'; return; }
    const st0 = window.__sampelStat ? window.__sampelStat(platform, u) : null;
    if (st0 && st0.n && !st0.blk && !(st0.has && st0.biaya && (st0.gmv + st0.bef) / st0.biaya > 10)) {
      const roi = st0.has && st0.biaya ? (st0.gmv + st0.bef) / st0.biaya : 0;
      el.className = 'uinfo warn';
      el.textContent = `Belum memenuhi syarat sampel ulang: sudah ${st0.n}× dapat sampel, GMV sebelum + sesudah sampel ${rpc(st0.gmv + st0.bef)} = ${rx(roi)} biaya sampel (${rpc(st0.biaya)}). Finance mensyaratkan lebih dari 10×.`;
      return;
    }
    if (isBlocked(platform, u)) {
      const b = BLK.get(bkey(platform, u));
      el.className = 'uinfo warn';
      el.textContent = `Diblokir dari sampel: sudah ${b.n}× dapat sampel (${fmtTgl(b.first)}${b.last !== b.first ? '–' + fmtTgl(b.last) : ''}) dan belum pernah menghasilkan order. Jangan kirim sampel lagi.`;
      return;
    }
    const rows = allRows().filter((r) => r.platform === platform && r.user_n === u);
    const ship = new Set(rows.map((r, i) => r.id || 'x' + i)).size;
    const efr = ef ? ef.rows.filter((r) => String(r.u).toLowerCase().replace(/^@+/, '') === u) : [];
    const efLaku = efr.filter((r) => r.ord > 0).length, efGmv = efr.reduce((a, r) => a + r.gmv, 0);
    const list = typeof TT !== 'undefined' ? (platform === 'Shopee' ? SH : TT) : [];
    const k = list.find((x) => x.u.toLowerCase() === u);
    const bits = [];
    if (ship) {
      const last = rows.map((r) => r.ym).filter(Boolean).sort().pop();
      bits.push(`Sudah ${ship}× dapat sampel${last ? ' (terakhir ' + ymLabel(last) + ')' : ''}`);
    } else bits.push('Belum pernah dapat sampel');
    if (efr.length) bits.push(efLaku ? `sampel menghasilkan ${rpc(efGmv)} dalam 30 hari` : 'sampel sebelumnya belum menghasilkan order');
    if (k) {
      bits.push(`${platform === 'Shopee' ? 'omzet Mei–Okt' : 'GMV Mei–Okt'} ${k.tot ? rpc(k.tot) : 'Rp0'}`);
      if (k.gagal != null && k.gagal >= 0.4) bits.push(`order gagal ${pf(k.gagal)}`);
      if (k.batal != null && k.batal >= 0.4) bits.push(`batal ${pf(k.batal)}`);
      bits.push('prioritas P' + k.pr);
    }
    const warn = (ship >= 1 && efr.length && !efLaku) || (k && ((k.gagal ?? 0) >= 0.4 || (k.batal ?? 0) >= 0.4 || k.pr >= 4));
    el.className = 'uinfo ' + (warn ? 'warn' : (efLaku || (k && k.tot > 0) ? 'good' : ''));
    el.textContent = (warn ? 'Cek dulu: ' : '') + bits.join(' · ') + '.';
  };
  let uiT = null;
  $('username').addEventListener('input', () => { clearTimeout(uiT); uiT = setTimeout(userInfo, 250); });
  $('p-tiktok').addEventListener('click', userInfo); $('p-shopee').addEventListener('click', userInfo);
  // ---------- Angka kunci untuk tab Ringkasan ----------
  window.__sampelKpi = () => {
    if (!hist && !histErr) return null;
    const all = allRows();
    const ymNow = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 7);
    const bul = all;
    const o = { sampelBulan: nf.format(bul.length), bulanLbl: 'sejak Mei 2026 (all time)', sampelWeb: bul.filter((r) => r.src === 'web').length ? nf.format(bul.filter((r) => r.src === 'web').length) : '' };
    if (ef) {
      const T = ef.rows; const g = T.reduce((a, r) => a + r.gmv, 0), b = T.reduce((a, r) => a + r.biaya, 0);
      o.laku = pf(T.filter((r) => r.ord > 0).length / T.length); o.roi = rx(g / b); o.efPer = 'semua sampel yang sudah lewat 30 hari';
    }
    return o;
  };
  // ---------- Statistik sampel per kreator (dipakai tab TikTok/Shopee) ----------
  let statCache = null; let HASIL = null;
  fetch(window.AFF_SRC('sampel_hasil.json')).then((r) => r.json()).then((d) => { HASIL = d; kickLists(); }).catch(() => {});
  const buildStat = () => {
    const m = new Map();
    allRows().forEach((r) => {
      const k = r.platform + '|' + r.user_n; const o = m.get(k) || { ids: new Set(), last: '', an: 0, gmv: 0, biaya: 0, ord: 0, laku: 0 };
      o.ids.add(r.id || ('x' + o.ids.size)); if (r.tgl && r.tgl > o.last) o.last = r.tgl; m.set(k, o);
    });
    // biaya sampel dari form web (belum ada di data penjualan)
    allRows().filter((r) => r.src === 'web').forEach((r) => { const o = m.get(r.platform + '|' + r.user_n); if (o) o.webBiaya = (o.webBiaya || 0) + (hppOf(r.produk, r.sku, r.pack) || 0) + (Number(r.ongkir) || 0); });
    statCache = m;
  };
  window.__sampelStat = (pl, u) => {
    if (!hist && !histErr) return null;
    if (!statCache) buildStat();
    const o = statCache.get(pl + '|' + String(u).trim().replace(/^@+/, '').toLowerCase());
    const h = HASIL && HASIL.d[(pl === 'Shopee' ? 'S' : 'T') + '|' + String(u).trim().replace(/^@+/, '').toLowerCase()];
    const hl = ((D.HAL && D.HAL.m[pl === 'Shopee' ? 'S' : 'T']) || {})[String(u).trim().replace(/^@+/, '')];
    return { hal: hl || '', n: (o ? o.ids.size : 0) + (hl ? 1 : 0), last: o ? o.last : (hl ? '2026-09-15' : ''), has: !!h, gmv: h ? h[0] : 0, ord: h ? h[1] : 0, bef: h ? h[2] : 0, biaya: (h ? h[3] : 0) + (o && o.webBiaya || 0), blk: isBlocked(pl, u) };
  };
  const kickLists = () => { statCache = null; try { if (typeof S !== 'undefined' && (S.tab === 'tiktok' || S.tab === 'shopee' || S.tab === 'db') && typeof rerenderSoon === 'function') rerenderSoon(); } catch (e) {} };
  window.__sampelShow = showTab;
  window.__sampelRows = () => allRows().map((r) => Object.assign({}, r, { hpp: hppOf(r.produk, r.sku, r.pack) || 0 }));
  window.__sampelReady = () => !!hist;
  drawBlok();
  if (window.__sampelPending) showTab(window.__sampelPending);
  (async () => {
    db = window.claude ? await window.claude.use('db') : null;
    if (!db) { msg('Penyimpanan tidak tersedia di tampilan ini.', 'bad'); $('submit').disabled = true; return; }
    db.collection('jf_sampel').orderBy('created_at', 'desc').limit(100)
      .onSnapshot((snap) => render(snap.docs), () => msg('Daftar sampel gagal dimuat. Muat ulang halaman.', 'bad'));
    db.doc('jf_sync_log/last').onSnapshot((d) => {
      const r = d.exists ? d.data() : null; if (!r) return;
      window.__syncLast = r; kickSummary();
      const at = r.at ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(r.at)) : '';
      const el = $('sync-log');
      el.textContent = `Sinkron terakhir ke spreadsheet: ${at} WIB · ${nf.format(Number(r.disalin) || 0)} sampel baru disalin · ${nf.format(Number(r.status_diperbarui) || 0)} status diperbarui · ${nf.format(Number(r.gagal) || 0)} gagal` + (r.catatan ? ` · ${r.catatan}` : '') + '. Sinkron berikutnya sekitar pukul 16.30 WIB.';
      el.style.color = Number(r.gagal) > 0 ? 'var(--bad)' : '';
    }, () => {});
    db.collection('jf_sampel_unblock').onSnapshot((snap) => { const m = {}; snap.docs.forEach((d) => { if (d.exists) m[d.id] = true; }); UNB = m; drawBlok(); userInfo(); kickLists(); }, () => {});
    db.collection('jf_sampel').limit(1000)
      .onSnapshot((snap) => { webDocs = snap.docs; drawRekap(); kickSummary(); kickLists(); try { if (S.tab === 'weekly') rerenderSoon(); } catch (e) {} }, () => {});
  })();
})();

})();