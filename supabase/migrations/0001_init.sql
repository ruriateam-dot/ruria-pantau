-- Ruria Pantau: skema awal
-- Jalankan di Supabase: SQL Editor -> New query -> tempel -> Run

-- Profil anggota tim (terhubung ke akun login Supabase)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nama text not null default '',
  peran text not null default 'anggota' check (peran in ('admin','anggota')),
  dibuat timestamptz not null default now()
);

create table public.clients (
  id text primary key,                 -- contoh: 'cahaya', 'pmg', 'jf', 'ot', 'voie'
  nama text not null,
  modul text[] not null default '{toko,iklan,live,affiliate}',
  target_roas numeric,
  dibuat timestamptz not null default now()
);

-- Anggota tim hanya melihat klien yang ditugaskan (admin melihat semua)
create table public.client_members (
  client_id text references public.clients on delete cascade,
  user_id uuid references public.profiles on delete cascade,
  primary key (client_id, user_id)
);

create table public.stores (
  id text primary key,                 -- contoh: 'cahaya-cabydut-shopee'
  client_id text not null references public.clients on delete cascade,
  brand text not null,                 -- Cabydut, Mitra 383, ...
  platform text not null check (platform in ('Shopee','TikTok','Lazada','CPAS')),
  tipe_toko text                       -- Star+, Mall, reguler
);

-- Penjualan harian per toko (dari statistik toko / ekspor pesanan)
create table public.daily_sales (
  store_id text references public.stores on delete cascade,
  tanggal date not null,
  gmv numeric not null default 0,
  pesanan integer not null default 0,
  pengunjung integer,                  -- null = belum ada data pengunjung
  sumber text,                         -- 'shop-stats', 'orders', 'rekap-tim'
  diupload_oleh uuid references public.profiles,
  diupdate timestamptz not null default now(),
  primary key (store_id, tanggal)
);

-- Iklan per kampanye per periode (harian atau bulanan sesuai file)
create table public.ads (
  id bigserial primary key,
  store_id text references public.stores on delete cascade,
  dari date not null,
  sampai date not null,
  kampanye text not null,
  biaya numeric not null default 0,
  gmv numeric not null default 0,
  pesanan integer not null default 0,
  diupload_oleh uuid references public.profiles,
  diupdate timestamptz not null default now()
);
create index on public.ads (store_id, dari, sampai);

-- Sesi livestream (satu baris per sesi; Shopee+TikTok bersamaan digabung)
create table public.live_sessions (
  id bigserial primary key,
  client_id text not null references public.clients on delete cascade,
  brand text,
  tanggal date not null,
  jam_mulai numeric not null,          -- jam desimal, 19.5 = 19:30
  durasi_jam numeric not null,
  gmv_shopee numeric not null default 0,
  gmv_tiktok numeric not null default 0,
  host text,
  penonton integer,
  diupload_oleh uuid references public.profiles,
  diupdate timestamptz not null default now()
);
create index on public.live_sessions (client_id, tanggal);

-- Riwayat upload
create table public.uploads (
  id bigserial primary key,
  client_id text references public.clients,
  jenis text not null,                 -- 'orders','shop-stats','ads','live'
  nama_file text,
  dari date, sampai date,
  baris integer,
  oleh uuid references public.profiles,
  waktu timestamptz not null default now()
);

-- ===== Keamanan (Row Level Security) =====
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and peran = 'admin');
$$;
create or replace function public.can_see(c text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (select 1 from client_members where client_id = c and user_id = auth.uid());
$$;

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_members enable row level security;
alter table public.stores enable row level security;
alter table public.daily_sales enable row level security;
alter table public.ads enable row level security;
alter table public.live_sessions enable row level security;
alter table public.uploads enable row level security;

create policy "profil sendiri atau admin" on public.profiles for select using (id = auth.uid() or is_admin());
create policy "admin kelola profil" on public.profiles for all using (is_admin()) with check (is_admin());

create policy "lihat klien" on public.clients for select using (can_see(id));
create policy "admin kelola klien" on public.clients for all using (is_admin()) with check (is_admin());

create policy "lihat anggota" on public.client_members for select using (is_admin() or user_id = auth.uid());
create policy "admin kelola anggota" on public.client_members for all using (is_admin()) with check (is_admin());

create policy "lihat toko" on public.stores for select using (can_see(client_id));
create policy "admin kelola toko" on public.stores for all using (is_admin()) with check (is_admin());

create policy "lihat penjualan" on public.daily_sales for select
  using (can_see((select client_id from stores s where s.id = store_id)));
create policy "tulis penjualan" on public.daily_sales for all
  using (can_see((select client_id from stores s where s.id = store_id)))
  with check (can_see((select client_id from stores s where s.id = store_id)));

create policy "lihat iklan" on public.ads for select
  using (can_see((select client_id from stores s where s.id = store_id)));
create policy "tulis iklan" on public.ads for all
  using (can_see((select client_id from stores s where s.id = store_id)))
  with check (can_see((select client_id from stores s where s.id = store_id)));

create policy "lihat live" on public.live_sessions for select using (can_see(client_id));
create policy "tulis live" on public.live_sessions for all using (can_see(client_id)) with check (can_see(client_id));

create policy "lihat upload" on public.uploads for select using (can_see(client_id));
create policy "catat upload" on public.uploads for insert with check (can_see(client_id));

-- Profil otomatis saat akun baru dibuat
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, nama) values (new.id, coalesce(new.raw_user_meta_data->>'nama', split_part(new.email,'@',1)));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Data awal klien
insert into public.clients (id, nama, modul, target_roas) values
  ('cahaya','CV Cahaya Globalindo Utama','{toko,iklan,live,affiliate}',18),
  ('pmg','PMG','{toko,iklan,live,affiliate}',12),
  ('ot','Organic Treasure','{toko,iklan,live,affiliate}',8),
  ('jf','Just Fluff','{toko,iklan,live,affiliate}',10),
  ('voie','VOIE','{live}',null);
