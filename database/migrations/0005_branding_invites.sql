-- 0005_branding_invites.sql
-- Phase 8 — Dealership Management: branding + team invites (Blueprint §5,
-- §43, §54). Safe to run after 0002-0004.

-- ---------------------------------------------------------------------
-- Dealership branding fields (Blueprint §43)
-- ---------------------------------------------------------------------
alter table dealerships add column if not exists phone text;
alter table dealerships add column if not exists email text;
alter table dealerships add column if not exists website text;
alter table dealerships add column if not exists address text;

-- ---------------------------------------------------------------------
-- Team invites — lets an admin add Manager/Salesperson accounts to an
-- EXISTING dealership (Blueprint §5 shows multiple salespeople per
-- dealership; the original signup flow only created brand-new ones).
-- ---------------------------------------------------------------------
create table if not exists dealership_invites (
  id uuid primary key default gen_random_uuid(),
  dealership_id uuid not null references dealerships(id) on delete cascade,
  email text not null,
  role text not null default 'salesperson'
    check (role in ('admin', 'manager', 'salesperson')),
  token text not null unique,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  used_at timestamptz
);

create index if not exists dealership_invites_dealership_id_idx
  on dealership_invites (dealership_id);

alter table dealership_invites enable row level security;

-- Dealership staff can see/manage invites for their own dealership.
drop policy if exists dealership_invites_select_own on dealership_invites;
create policy dealership_invites_select_own on dealership_invites
  for select using (dealership_id = public.current_dealership_id());

drop policy if exists dealership_invites_insert_own on dealership_invites;
create policy dealership_invites_insert_own on dealership_invites
  for insert with check (dealership_id = public.current_dealership_id());

drop policy if exists dealership_invites_delete_own on dealership_invites;
create policy dealership_invites_delete_own on dealership_invites
  for delete using (dealership_id = public.current_dealership_id());

-- A person accepting an invite isn't logged in yet, so they can't be
-- matched via current_dealership_id(). Rather than a broad anon SELECT
-- policy on the whole table (which would let anyone with the anon key
-- enumerate every pending invite's email across every dealership), expose
-- only a narrow, single-row lookup via a SECURITY DEFINER function scoped
-- to an exact token match.
create or replace function public.get_dealership_invite(p_token text)
returns table(email text, role text, dealership_name text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select di.email, di.role, d.name
  from dealership_invites di
  join dealerships d on d.id = di.dealership_id
  where di.token = p_token
    and di.used_at is null
    and di.expires_at > now();
end;
$$;

grant execute on function public.get_dealership_invite(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Updated signup trigger: supports joining an existing dealership via
-- invite_token, in addition to the original create-new-dealership path.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_dealership_id uuid;
  dealership_name text;
  full_name text;
  invite_token text;
  matched_invite dealership_invites%rowtype;
begin
  dealership_name := new.raw_user_meta_data ->> 'dealership_name';
  full_name := new.raw_user_meta_data ->> 'full_name';
  invite_token := new.raw_user_meta_data ->> 'invite_token';

  if invite_token is not null and length(trim(invite_token)) > 0 then
    select * into matched_invite
    from dealership_invites
    where token = trim(invite_token)
      and used_at is null
      and expires_at > now()
    limit 1;

    if matched_invite.id is not null then
      if lower(trim(coalesce(new.email, ''))) <> lower(trim(matched_invite.email)) then
        raise exception 'Invite email does not match the account email.';
      end if;

      insert into users (id, dealership_id, name, email, role)
      values (
        new.id,
        matched_invite.dealership_id,
        full_name,
        new.email,
        matched_invite.role
      );

      update dealership_invites
      set used_at = now()
      where id = matched_invite.id;

      return new;
    end if;
    -- Invalid/expired invite tokens must never silently create a new
    -- dealership. This keeps invite-based onboarding deterministic.
    raise exception 'Invite is invalid or expired.';
  end if;

  if dealership_name is not null and length(trim(dealership_name)) > 0 then
    insert into dealerships (name)
    values (trim(dealership_name))
    returning id into new_dealership_id;

    insert into users (id, dealership_id, name, email, role)
    values (new.id, new_dealership_id, full_name, new.email, 'admin');
  else
    insert into users (id, dealership_id, name, email, role)
    values (new.id, null, full_name, new.email, 'salesperson');
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Restrict dealership profile edits to admins only.
-- ---------------------------------------------------------------------
drop policy if exists dealerships_update_own on dealerships;
create policy dealerships_update_own on dealerships
  for update
  using (
    id = public.current_dealership_id()
    and exists (
      select 1 from users
      where id = auth.uid() and role = 'admin'
    )
  );

-- ---------------------------------------------------------------------
-- Reports: allow revoking a share link (set share_token to null) —
-- 0002/0003 only defined select/insert policies on `reports`, no update.
-- ---------------------------------------------------------------------
drop policy if exists reports_update_own_dealership on reports;
create policy reports_update_own_dealership on reports
  for update
  using (
    vehicle_id in (
      select id from vehicles where dealership_id = public.current_dealership_id()
    )
  );
