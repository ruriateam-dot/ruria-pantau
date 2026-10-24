-- Penjualan per produk & varian per hari (dari ekspor pesanan)
create table public.product_sales (
  store_id text references public.stores on delete cascade,
  tanggal date not null,
  produk text not null,
  varian text not null default '-',
  qty integer not null default 0,
  gmv numeric not null default 0,
  pesanan integer not null default 0,
  diupload_oleh uuid references public.profiles,
  primary key (store_id, tanggal, produk, varian)
);
create index on public.product_sales (store_id, tanggal);
alter table public.product_sales enable row level security;
create policy "lihat produk" on public.product_sales for select
  using (can_see((select client_id from stores s where s.id = store_id)));
create policy "tulis produk" on public.product_sales for all
  using (can_see((select client_id from stores s where s.id = store_id)))
  with check (can_see((select client_id from stores s where s.id = store_id)));

-- Ringkasan per produk: periode ini vs pembanding, plus varian terlaris
create or replace function public.produk_ringkas(p_stores text[], p_from date, p_to date, p_pf date, p_pt date)
returns table (produk text, gmv numeric, qty bigint, pesanan bigint, gmv_prev numeric, qty_prev bigint, toko text[], varian_top text, varian_qty bigint, hari_jual bigint, terakhir date)
language sql stable security invoker set search_path = public as $$
  with cur as (
    select produk, varian, store_id, tanggal, qty, gmv, pesanan from product_sales
    where store_id = any(p_stores) and tanggal between p_from and p_to
  ), prev as (
    select produk, sum(gmv) g, sum(qty) q from product_sales
    where store_id = any(p_stores) and tanggal between p_pf and p_pt group by produk
  ), agg as (
    select produk, sum(gmv) g, sum(qty) q, sum(pesanan) o, array_agg(distinct store_id) t,
      count(distinct tanggal) hj, max(tanggal) tr from cur group by produk
  ), vt as (
    select distinct on (produk) produk, varian, sum(qty) vq from cur group by produk, varian order by produk, sum(qty) desc
  ), lastp as (
    select produk, max(tanggal) tr from product_sales where store_id = any(p_stores) and tanggal <= p_to group by produk
  )
  select coalesce(a.produk, p.produk), coalesce(a.g, 0), coalesce(a.q, 0), coalesce(a.o, 0), coalesce(p.g, 0), coalesce(p.q, 0),
    a.t, vt.varian, vt.vq, coalesce(a.hj, 0), coalesce(a.tr, l.tr)
  from agg a full join prev p on p.produk = a.produk
  left join vt on vt.produk = coalesce(a.produk, p.produk)
  left join lastp l on l.produk = coalesce(a.produk, p.produk)
  order by 2 desc, 5 desc
  limit 300;
$$;
