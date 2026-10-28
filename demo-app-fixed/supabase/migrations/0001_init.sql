-- Activities demo: initial schema (generated during MVP build)

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  home_zip text,
  children jsonb default '[]'::jsonb,      -- [{ "first_name": "...", "birth_year": 2019 }]
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

create table public.activities (
  id bigint generated always as identity primary key,
  organizer_id uuid references auth.users,
  title text not null,
  category text,
  age_min int, age_max int,
  address text, lat double precision, lng double precision,
  price_cents int,
  starts_at timestamptz
);
alter table public.activities enable row level security;
create policy "Activities are public" on public.activities
  for select using (true);
create policy "Organizers manage own activities" on public.activities
  for all using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);

create table public.saved_activities (
  user_id uuid references auth.users on delete cascade,
  activity_id bigint references public.activities on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, activity_id)
);
alter table public.saved_activities enable row level security;
create policy "Users read own saves" on public.saved_activities
  for select using (auth.uid() = user_id);
create policy "Users add own saves" on public.saved_activities
  for insert with check (auth.uid() = user_id);
create policy "Users remove own saves" on public.saved_activities
  for delete using (auth.uid() = user_id);

create table public.reviews (
  id bigint generated always as identity primary key,
  activity_id bigint references public.activities on delete cascade,
  user_id uuid references auth.users,
  rating int check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  created_at timestamptz default now()
);
alter table public.reviews enable row level security;
create policy "Reviews are public" on public.reviews for select using (true);
create policy "Signed-in users write reviews" on public.reviews
  for insert with check (auth.uid() = user_id);
create policy "Authors edit own reviews" on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.organizer_contacts (
  organizer_id uuid primary key references auth.users,
  email text, phone text
);
alter table public.organizer_contacts enable row level security;
