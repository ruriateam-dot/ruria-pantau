-- Kelompokkan produk berdasarkan SKU (lintas toko) + daftar SKU varian
alter table public.product_sales add column if not exists sku text not null default '';
alter table public.product_sales add column if not exists grup text;

create or replace function public.produk_sku(p_stores text[], p_from date, p_to date, p_pf date, p_pt date)
returns table (grup text, nama text, kode text[], gmv numeric, qty bigint, pesanan bigint, gmv_prev numeric, qty_prev bigint, toko text[], varian jsonb)
language sql stable security definer set search_path = public as $$
  with ok as (
    select array_agg(id) ids from stores where id = any(p_stores) and can_see(client_id)
  ), base as (
    select coalesce(nullif(grup, ''), 'NAMA:' || produk) g, produk, varian, sku, store_id, tanggal, qty, gmv, pesanan
    from product_sales, ok where store_id = any(ok.ids) and tanggal between least(p_from, p_pf) and greatest(p_to, p_pt)
  ), cur as (select * from base where tanggal between p_from and p_to),
  prev as (select g, sum(gmv) pg, sum(qty) pq from base where tanggal between p_pf and p_pt group by g),
  agg as (
    select g, sum(gmv) sg, sum(qty) sq, sum(pesanan) so, array_agg(distinct store_id) t from cur group by g
  ), nm as (
    select distinct on (g) g, produk from cur group by g, produk order by g, sum(gmv) desc
  ), kd as (
    select g, array_agg(k order by kg desc) ks from (
      select g, split_part(sku, '.', 1) k, sum(gmv) kg from cur where sku <> '' group by g, split_part(sku, '.', 1)
    ) x group by g
  ), vr as (
    select g, jsonb_agg(jsonb_build_object('sku', sku, 'varian', varian, 'toko', store_id, 'qty', vq, 'gmv', vg) order by vg desc) v from (
      select g, sku, varian, store_id, sum(qty) vq, sum(gmv) vg,
        row_number() over (partition by g order by sum(gmv) desc) rn
      from cur group by g, sku, varian, store_id
    ) x where rn <= 60 group by g
  )
  select a.g, nm.produk, kd.ks[1:6], a.sg, a.sq, a.so, coalesce(p.pg, 0), coalesce(p.pq, 0), a.t, vr.v
  from agg a left join prev p using (g) left join nm using (g) left join kd using (g) left join vr using (g)
  union all
  select p.g, (select produk from base b where b.g = p.g order by gmv desc limit 1), null, 0, 0, 0, p.pg, p.pq, null, null
  from prev p where not exists (select 1 from agg a where a.g = p.g) and p.pq >= 10
  order by 4 desc, 7 desc
  limit 300;
$$;
revoke execute on function public.produk_sku(text[], date, date, date, date) from public, anon;
grant execute on function public.produk_sku(text[], date, date, date, date) to authenticated;
