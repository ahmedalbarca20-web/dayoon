-- ============================================================
--  قاعدة بيانات تطبيق "دفتر الديون" لـ Supabase
--  طريقة الاستخدام:
--  1. ادخل إلى لوحة تحكم Supabase → SQL Editor → New query
--  2. الصق هذا الكود كاملاً واضغط Run
--  3. أنشئ حساب أدمن: Authentication → Users → Add user
-- ============================================================

-- جدول المكاتب (البروفايلات) التي ينشئها الأدمن
create table if not exists public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  username text not null unique,
  password text not null,
  phone text default '',
  details text default '',
  active boolean not null default true,
  contract_start date,
  contract_end date,
  created_at timestamptz not null default now()
);

-- جدول الأشخاص (مرتبط بالمكتب)
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  phone text default '',
  details text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- جدول الحركات (شراء / تسديد)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('purchase', 'payment')),
  amount numeric not null check (amount > 0),
  details text default '',
  date timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- فهارس لتسريع البحث
create index if not exists idx_people_office on public.people(office_id);
create index if not exists idx_transactions_person on public.transactions(person_id);
create index if not exists idx_transactions_office on public.transactions(office_id);

-- تفعيل الأمان على مستوى الصف (Row Level Security)
alter table public.offices enable row level security;
alter table public.people enable row level security;
alter table public.transactions enable row level security;

-- سياسات الوصول
-- الأدمن المسجّل في Supabase Auth يستطيع إدارة المكاتب وجميع البيانات
create policy "offices_all" on public.offices
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "people_all" on public.people
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "transactions_all" on public.transactions
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
