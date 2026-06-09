create extension if not exists citext;

create or replace function current_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;

create or replace function is_org_member(check_user_id uuid, check_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_members om
    where om.user_id = check_user_id
      and om.organization_id = check_organization_id
      and om.deleted_at is null
  );
$$;

create or replace function has_org_role(
  check_user_id uuid,
  check_organization_id uuid,
  check_role "OrganizationRole"
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_members om
    where om.user_id = check_user_id
      and om.organization_id = check_organization_id
      and om.role = check_role
      and om.deleted_at is null
  );
$$;

create or replace function has_org_permission(
  check_user_id uuid,
  check_organization_id uuid,
  check_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_members om
    where om.user_id = check_user_id
      and om.organization_id = check_organization_id
      and om.deleted_at is null
      and (
        om.role in ('OWNER', 'ADMIN')
        or check_permission = any(om.permissions)
      )
  );
$$;

alter table organization_members enable row level security;
alter table organization_websites enable row level security;
alter table website_pages enable row level security;
alter table website_sections enable row level security;
alter table media_assets enable row level security;

create policy organization_members_member_read
  on organization_members
  for select
  using (is_org_member(current_user_id(), organization_id));

create policy organization_members_admin_write
  on organization_members
  for all
  using (has_org_permission(current_user_id(), organization_id, 'members.manage'))
  with check (has_org_permission(current_user_id(), organization_id, 'members.manage'));

create policy organization_websites_public_published_read
  on organization_websites
  for select
  using (published_at is not null and deleted_at is null);

create policy organization_websites_admin_manage
  on organization_websites
  for all
  using (has_org_permission(current_user_id(), organization_id, 'website.manage'))
  with check (has_org_permission(current_user_id(), organization_id, 'website.manage'));

create policy website_pages_public_published_read
  on website_pages
  for select
  using (status = 'PUBLISHED' and published_at is not null and deleted_at is null);

create policy website_pages_admin_manage
  on website_pages
  for all
  using (has_org_permission(current_user_id(), organization_id, 'website.manage'))
  with check (has_org_permission(current_user_id(), organization_id, 'website.manage'));

create policy website_sections_public_published_page_read
  on website_sections
  for select
  using (
    deleted_at is null
    and exists (
      select 1
      from website_pages wp
      where wp.id = website_sections.page_id
        and wp.status = 'PUBLISHED'
        and wp.published_at is not null
        and wp.deleted_at is null
    )
  );

create policy website_sections_admin_manage
  on website_sections
  for all
  using (has_org_permission(current_user_id(), organization_id, 'website.manage'))
  with check (has_org_permission(current_user_id(), organization_id, 'website.manage'));

create policy media_assets_member_read
  on media_assets
  for select
  using (is_org_member(current_user_id(), organization_id));

create policy media_assets_admin_manage
  on media_assets
  for all
  using (has_org_permission(current_user_id(), organization_id, 'media.manage'))
  with check (has_org_permission(current_user_id(), organization_id, 'media.manage'));
