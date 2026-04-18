create extension if not exists pgcrypto with schema extensions;

create table if not exists public.couple_shared_states (
  room_code text primary key,
  payload jsonb not null,
  updated_by text,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.couple_rooms (
  room_code text primary key,
  join_secret_hash text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.couple_room_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  room_code text not null,
  recovery_token_hash text,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, room_code)
);

alter table public.couple_room_memberships
add column if not exists recovery_token_hash text;

create unique index if not exists idx_couple_room_memberships_room_recovery_token_hash
on public.couple_room_memberships (room_code, recovery_token_hash)
where recovery_token_hash is not null;

alter table public.couple_room_memberships
add constraint couple_room_memberships_recovery_token_hash_length
check (recovery_token_hash is null or length(recovery_token_hash) >= 20) not valid;

alter table public.couple_room_memberships
validate constraint couple_room_memberships_recovery_token_hash_length;

create table if not exists public.couple_sync_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  bucket_start timestamptz not null,
  attempt_count integer not null default 0,
  primary key (user_id, action, bucket_start),
  check (attempt_count >= 0)
);

create index if not exists idx_couple_sync_rate_limits_bucket_start
on public.couple_sync_rate_limits (bucket_start);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.is_couple_room_member(p_room_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.couple_room_memberships membership
    where membership.user_id = auth.uid()
      and membership.room_code = p_room_code
  );
$$;

alter table public.couple_sync_rate_limits enable row level security;

drop policy if exists "no direct access to rate limits" on public.couple_sync_rate_limits;
create policy "no direct access to rate limits"
on public.couple_sync_rate_limits
for all
to authenticated
using (false)
with check (false);

revoke all on table public.couple_sync_rate_limits from public;
revoke all on table public.couple_sync_rate_limits from anon;
revoke all on table public.couple_sync_rate_limits from authenticated;

revoke all on function public.is_couple_room_member(text) from public;
revoke all on function public.is_couple_room_member(text) from anon;
grant execute on function public.is_couple_room_member(text) to authenticated;

create or replace function public.enforce_rate_limit(p_action text, p_limit integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid;
  current_bucket timestamptz;
  next_attempt_count integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  current_bucket := date_trunc('minute', timezone('utc', now()));

  insert into public.couple_sync_rate_limits (user_id, action, bucket_start, attempt_count)
  values (current_user_id, p_action, current_bucket, 1)
  on conflict (user_id, action, bucket_start)
  do update set attempt_count = public.couple_sync_rate_limits.attempt_count + 1
  returning attempt_count into next_attempt_count;

  delete from public.couple_sync_rate_limits
  where bucket_start < timezone('utc', now()) - interval '1 day';

  if next_attempt_count > p_limit then
    raise exception 'RATE_LIMITED';
  end if;
end;
$$;

revoke all on function public.enforce_rate_limit(text, integer) from public;
revoke all on function public.enforce_rate_limit(text, integer) from anon;
revoke all on function public.enforce_rate_limit(text, integer) from authenticated;

create or replace function public.is_valid_shared_payload(p_payload jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
  day_value jsonb;
  todo_value jsonb;
  message_value jsonb;
  order_value jsonb;
  menu_value jsonb;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    return false;
  end if;

  if jsonb_typeof(p_payload -> 'menu') is distinct from 'array'
    or jsonb_typeof(p_payload -> 'days') is distinct from 'object'
    or ((p_payload ? 'meta') and jsonb_typeof(p_payload -> 'meta') is distinct from 'object')
  then
    return false;
  end if;

  if jsonb_array_length(p_payload -> 'menu') > 500 then
    return false;
  end if;

  for menu_value in select value from jsonb_array_elements(p_payload -> 'menu') loop
    if jsonb_typeof(menu_value) is distinct from 'object'
      or jsonb_typeof(menu_value -> 'tags') is distinct from 'array'
      or length(coalesce(menu_value ->> 'id', '')) > 80
      or length(coalesce(menu_value ->> 'name', '')) > 80
      or length(coalesce(menu_value ->> 'category', '')) > 40
      or length(coalesce(menu_value ->> 'description', '')) > 240
      or length(coalesce(menu_value ->> 'heat', '')) > 40
    then
      return false;
    end if;
  end loop;

  for day_value in select value from jsonb_each(p_payload -> 'days') loop
    if jsonb_typeof(day_value) is distinct from 'object'
      or jsonb_typeof(day_value -> 'todos') is distinct from 'array'
      or jsonb_typeof(day_value -> 'messages') is distinct from 'array'
      or jsonb_typeof(day_value -> 'orders') is distinct from 'array'
      or jsonb_array_length(day_value -> 'todos') > 200
      or jsonb_array_length(day_value -> 'messages') > 200
      or jsonb_array_length(day_value -> 'orders') > 200
    then
      return false;
    end if;

    for todo_value in select value from jsonb_array_elements(day_value -> 'todos') loop
      if jsonb_typeof(todo_value) is distinct from 'object'
        or length(coalesce(todo_value ->> 'id', '')) > 80
        or length(coalesce(todo_value ->> 'text', '')) > 240
        or coalesce(todo_value ->> 'assignee', '') not in ('共同', '我', '她')
        or jsonb_typeof(todo_value -> 'done') is distinct from 'boolean'
      then
        return false;
      end if;
    end loop;

    for message_value in select value from jsonb_array_elements(day_value -> 'messages') loop
      if jsonb_typeof(message_value) is distinct from 'object'
        or length(coalesce(message_value ->> 'id', '')) > 80
        or coalesce(message_value ->> 'author', '') not in ('我', '她')
        or length(coalesce(message_value ->> 'content', '')) > 500
        or nullif(message_value ->> 'createdAt', '') is null
      then
        return false;
      end if;
    end loop;

    for order_value in select value from jsonb_array_elements(day_value -> 'orders') loop
      if jsonb_typeof(order_value) is distinct from 'object'
        or length(coalesce(order_value ->> 'id', '')) > 80
        or length(coalesce(order_value ->> 'menuItemId', '')) > 80
        or coalesce(order_value ->> 'orderedBy', '') not in ('我', '她')
        or nullif(order_value ->> 'createdAt', '') is null
      then
        return false;
      end if;
    end loop;
  end loop;

  return true;
end;
$$;

drop function if exists public.create_couple_room(text, text);
drop function if exists public.join_couple_room(text);

create or replace function public.create_couple_room(p_room_code text, p_join_secret text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_room_code text;
  normalized_join_secret text;
  existing_secret_hash text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  normalized_room_code := upper(trim(coalesce(p_room_code, '')));
  normalized_join_secret := upper(trim(coalesce(p_join_secret, '')));

  if normalized_room_code !~ '^[A-Z0-9]{8,12}$' then
    raise exception 'ROOM_CODE_INVALID';
  end if;

  if normalized_join_secret !~ '^[A-Z0-9]{8,16}$' then
    raise exception 'ROOM_SECRET_INVALID';
  end if;

  begin
    insert into public.couple_rooms (room_code, join_secret_hash, created_by)
    values (normalized_room_code, crypt(normalized_join_secret, gen_salt('bf')), auth.uid());
    return;
  exception
    when unique_violation then
      null;
  end;

  select room.join_secret_hash
  into existing_secret_hash
  from public.couple_rooms room
  where room.room_code = normalized_room_code
  for update;

  if not found or crypt(normalized_join_secret, existing_secret_hash) <> existing_secret_hash then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;
end;
$$;

drop function if exists public.join_or_create_couple_room(text, text);

create or replace function public.join_or_create_couple_room(p_room_code text, p_join_secret text, p_recovery_token text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_room_code text;
  normalized_join_secret text;
  normalized_recovery_token text;
  existing_secret_hash text;
  existing_member_count integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform public.enforce_rate_limit('join_or_create_couple_room', 8);

  normalized_room_code := upper(trim(coalesce(p_room_code, '')));
  normalized_join_secret := upper(trim(coalesce(p_join_secret, '')));
  normalized_recovery_token := nullif(lower(trim(coalesce(p_recovery_token, ''))), '');

  if normalized_room_code !~ '^[A-Z0-9]{8,12}$' then
    raise exception 'ROOM_CODE_INVALID';
  end if;

  if normalized_join_secret !~ '^[A-Z0-9]{8,16}$' then
    raise exception 'ROOM_SECRET_INVALID';
  end if;

  if normalized_recovery_token is not null and normalized_recovery_token !~ '^[a-z0-9]{32}$' then
    raise exception 'RECOVERY_TOKEN_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(normalized_room_code, 0));
  perform public.create_couple_room(normalized_room_code, normalized_join_secret);

  select room.join_secret_hash
  into existing_secret_hash
  from public.couple_rooms room
  where room.room_code = normalized_room_code
  for update;

  if not found or crypt(normalized_join_secret, existing_secret_hash) <> existing_secret_hash then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;

  if exists (
    select 1
    from public.couple_room_memberships membership
    where membership.user_id = auth.uid()
      and membership.room_code = normalized_room_code
  ) then
    if normalized_recovery_token is not null then
      update public.couple_room_memberships membership
      set recovery_token_hash = crypt(normalized_recovery_token, gen_salt('bf'))
      where membership.user_id = auth.uid()
        and membership.room_code = normalized_room_code
        and (membership.recovery_token_hash is null or crypt(normalized_recovery_token, membership.recovery_token_hash) <> membership.recovery_token_hash);
    end if;

    return;
  end if;

  if normalized_recovery_token is not null and exists (
    select 1
    from public.couple_room_memberships membership
    where membership.room_code = normalized_room_code
      and membership.recovery_token_hash is not null
      and crypt(normalized_recovery_token, membership.recovery_token_hash) = membership.recovery_token_hash
  ) then
    update public.couple_room_memberships membership
    set user_id = auth.uid(),
        recovery_token_hash = crypt(normalized_recovery_token, gen_salt('bf'))
    where membership.room_code = normalized_room_code
      and membership.recovery_token_hash is not null
      and crypt(normalized_recovery_token, membership.recovery_token_hash) = membership.recovery_token_hash;
    return;
  end if;

  select count(*)
  into existing_member_count
  from public.couple_room_memberships membership
  where membership.room_code = normalized_room_code;

  if existing_member_count >= 2 then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;

  insert into public.couple_room_memberships (user_id, room_code, recovery_token_hash)
  values (
    auth.uid(),
    normalized_room_code,
    case when normalized_recovery_token is null then null else crypt(normalized_recovery_token, gen_salt('bf')) end
  );
end;
$$;

drop function if exists public.join_couple_room(text, text);

create or replace function public.join_couple_room(p_room_code text, p_join_secret text, p_recovery_token text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform public.join_or_create_couple_room(p_room_code, p_join_secret, p_recovery_token);
end;
$$;

create or replace function public.save_couple_shared_state(
  p_room_code text,
  p_payload jsonb,
  p_updated_by text,
  p_expected_updated_at timestamptz default null
)
returns table (
  room_code text,
  payload jsonb,
  updated_by text,
  updated_at timestamptz,
  result text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_room_code text;
  normalized_updated_by text;
  current_row public.couple_shared_states%rowtype;
  saved_row public.couple_shared_states%rowtype;
  payload_size integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  perform public.enforce_rate_limit('save_couple_shared_state', 30);

  normalized_room_code := upper(trim(coalesce(p_room_code, '')));
  normalized_updated_by := nullif(left(trim(coalesce(p_updated_by, '')), 64), '');

  if normalized_room_code !~ '^[A-Z0-9]{8,12}$' then
    raise exception 'ROOM_CODE_INVALID';
  end if;

  if not public.is_couple_room_member(normalized_room_code) then
    raise exception 'ROOM_ACCESS_DENIED';
  end if;

  if not public.is_valid_shared_payload(p_payload) then
    raise exception 'PAYLOAD_INVALID';
  end if;

  payload_size := pg_column_size(p_payload);
  if payload_size > 262144 then
    raise exception 'PAYLOAD_TOO_LARGE';
  end if;

  select *
  into current_row
  from public.couple_shared_states
  where couple_shared_states.room_code = normalized_room_code;

  if not found then
    if p_expected_updated_at is not null then
      return query
      select
        current_row.room_code,
        current_row.payload,
        current_row.updated_by,
        current_row.updated_at,
        'conflict'::text;
      return;
    end if;

    begin
      insert into public.couple_shared_states (room_code, payload, updated_by)
      values (normalized_room_code, p_payload, normalized_updated_by)
      returning * into saved_row;
    exception
      when unique_violation then
        select *
        into current_row
        from public.couple_shared_states
        where couple_shared_states.room_code = normalized_room_code;

        return query
        select
          current_row.room_code,
          current_row.payload,
          current_row.updated_by,
          current_row.updated_at,
          'conflict'::text;
        return;
    end;

    return query
    select
      saved_row.room_code,
      saved_row.payload,
      saved_row.updated_by,
      saved_row.updated_at,
      'inserted'::text;
    return;
  end if;

  if p_expected_updated_at is distinct from current_row.updated_at then
    return query
    select
      current_row.room_code,
      current_row.payload,
      current_row.updated_by,
      current_row.updated_at,
      'conflict'::text;
    return;
  end if;

  update public.couple_shared_states
  set payload = p_payload,
      updated_by = normalized_updated_by
  where couple_shared_states.room_code = normalized_room_code
    and couple_shared_states.updated_at = p_expected_updated_at
  returning * into saved_row;

  if not found then
    select *
    into current_row
    from public.couple_shared_states
    where couple_shared_states.room_code = normalized_room_code;

    return query
    select
      current_row.room_code,
      current_row.payload,
      current_row.updated_by,
      current_row.updated_at,
      'conflict'::text;
    return;
  end if;

  return query
  select
    saved_row.room_code,
    saved_row.payload,
    saved_row.updated_by,
    saved_row.updated_at,
    'updated'::text;
end;
$$;

drop trigger if exists touch_couple_shared_states_updated_at on public.couple_shared_states;

create trigger touch_couple_shared_states_updated_at
before update on public.couple_shared_states
for each row
execute function public.touch_updated_at();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'couple_shared_states'
  ) then
    alter publication supabase_realtime add table public.couple_shared_states;
  end if;
end;
$$;

alter table public.couple_shared_states enable row level security;
alter table public.couple_rooms enable row level security;
alter table public.couple_room_memberships enable row level security;

drop policy if exists "members can read couple rooms" on public.couple_shared_states;
create policy "members can read couple rooms"
on public.couple_shared_states
for select
to authenticated
using (public.is_couple_room_member(room_code));

drop policy if exists "members can insert couple rooms" on public.couple_shared_states;
drop policy if exists "members can update couple rooms" on public.couple_shared_states;

drop policy if exists "users can read own couple rooms" on public.couple_rooms;

drop policy if exists "users can read own couple memberships" on public.couple_room_memberships;
create policy "users can read own couple memberships"
on public.couple_room_memberships
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can insert own couple memberships" on public.couple_room_memberships;

revoke all on function public.create_couple_room(text, text) from public;
revoke all on function public.create_couple_room(text, text) from authenticated;

revoke all on function public.join_or_create_couple_room(text, text, text) from public;
grant execute on function public.join_or_create_couple_room(text, text, text) to authenticated;

revoke all on function public.join_couple_room(text, text, text) from public;
grant execute on function public.join_couple_room(text, text, text) to authenticated;

revoke all on function public.save_couple_shared_state(text, jsonb, text, timestamptz) from public;
grant execute on function public.save_couple_shared_state(text, jsonb, text, timestamptz) to authenticated;

comment on table public.couple_shared_states is
'情侣共享状态表。客户端只读，写入必须经由带 CAS 校验的 RPC。';

comment on table public.couple_rooms is
'情侣房间元数据。保存房间码与配对口令哈希，入房必须经由 join_couple_room RPC。';
