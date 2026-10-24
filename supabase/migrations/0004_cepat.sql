-- Percepat: hak akses dicek sekali per toko, bukan per baris

-- 1) Aturan akses yang lebih ringan untuk tabel besar
drop policy if exists "lihat produk" on public.product_sales;
drop policy if exists "tulis produk" on public.product_sales;
create policy "lihat produk" on public.product_sales for select
  using (store_id in (select id from public.stores where public.can_see(client_id)));
create policy "tulis produk" on public.product_sales for all
  using (store_id in (select id from public.stores where public.can_see(client_id)))
  with check (store_id in (select id from public.stores where public.can_see(client_id)));

drop policy if exists "lihat penjualan" on public.daily_sales;
drop policy if exists "tulis penjualan" on public.daily_sales;
create policy "lihat penjualan" on public.daily_sales for select
  using (store_id in (select id from public.stores where public.can_see(client_id)));
create policy "tulis penjualan" on public.daily_sales for all
  using (store_id in (select id from public.stores where public.can_see(client_id)))
  with check (store_id in (select id from public.stores where public.can_see(client_id)));

drop policy if exists "lihat iklan" on public.ads;
drop policy if exists "tulis iklan" on public.ads;
create policy "lihat iklan" on public.ads for select
  using (store_id in (select id from public.stores where public.can_see(client_id)));
create policy "tulis iklan" on public.ads for all
  using (store_id in (select id from public.stores where public.can_see(client_id)))
  with check (store_id in (select id from public.stores where public.can_see(client_id)));

-- 2) Analisa produk: cek akses sekali di awal, lalu hitung tanpa cek per baris
create or replace function public.produk_ringkas(p_stores text[], p_from date, p_to date, p_pf date, p_pt date)
returns table (produk text, gmv numeric, qty bigint, pesanan bigint, gmv_prev numeric, qty_prev bigint, toko text[], varian_top text, varian_qty bigint, hari_jual bigint, terakhir date)
language sql stable security definer set search_path = public as $$
  with ok as (
    select array_agg(id) ids from stores where id = any(p_stores) and can_see(client_id)
  ), cur as (
    select produk, varian, store_id, tanggal, qty, gmv, pesanan from product_sales, ok
    where store_id = any(ok.ids) and tanggal between p_from and p_to
  ), prev as (
    select produk, sum(gmv) g, sum(qty) q from product_sales, ok
    where store_id = any(ok.ids) and tanggal between p_pf and p_pt group by produk
  ), agg as (
    select produk, sum(gmv) g, sum(qty) q, sum(pesanan) o, array_agg(distinct store_id) t,
      count(distinct tanggal) hj, max(tanggal) tr from cur group by produk
  ), vt as (
    select distinct on (produk) produk, varian, sum(qty) vq from cur group by produk, varian order by produk, sum(qty) desc
  ), lastp as (
    select produk, max(tanggal) tr from product_sales, ok where store_id = any(ok.ids) and tanggal <= p_to group by produk
  )
  select coalesce(a.produk, p.produk), coalesce(a.g, 0), coalesce(a.q, 0), coalesce(a.o, 0), coalesce(p.g, 0), coalesce(p.q, 0),
    a.t, vt.varian, vt.vq, coalesce(a.hj, 0), coalesce(a.tr, l.tr)
  from agg a full join prev p on p.produk = a.produk
  left join vt on vt.produk = coalesce(a.produk, p.produk)
  left join lastp l on l.produk = coalesce(a.produk, p.produk)
  order by 2 desc, 5 desc
  limit 300;
$$;
revoke execute on function public.produk_ringkas(text[], date, date, date, date) from public, anon;
grant execute on function public.produk_ringkas(text[], date, date, date, date) to authenticated;
