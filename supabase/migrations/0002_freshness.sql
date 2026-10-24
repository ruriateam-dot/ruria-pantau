-- Tanggal data terakhir per klien (dipakai tab Semua Klien)
create or replace function public.data_terakhir()
returns table (client_id text, penjualan date, iklan date, live date)
language sql stable security invoker set search_path = public as $$
  select c.id,
    (select max(d.tanggal) from daily_sales d join stores s on s.id = d.store_id where s.client_id = c.id),
    (select max(a.sampai) from ads a join stores s on s.id = a.store_id where s.client_id = c.id),
    (select max(l.tanggal) from live_sessions l where l.client_id = c.id)
  from clients c;
$$;
