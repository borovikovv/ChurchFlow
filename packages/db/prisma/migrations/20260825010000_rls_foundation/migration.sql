-- packages/db/sql/001_rls_foundation.sql ніколи не виконувався: на нього немає жодного
-- посилання ні в скриптах, ні в деплої, і він усе одно впав би — функції фільтрували по
-- organization_members.deleted_at, а такої колонки там немає. Це його робоча версія.

-- Роль створюється без входу: пароль задається поза репозиторієм, вручну.
-- Поки DATABASE_APP_URL не налаштований, застосунок ходить як власник таблиць,
-- а власник політики обходить, тож ця міграція нічого не змінює в поведінці.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'churchflow_app') THEN
    CREATE ROLE churchflow_app NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO churchflow_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO churchflow_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO churchflow_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO churchflow_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO churchflow_app;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid;
$$;

-- Фонові задачі й телеграм-вебхук діють без користувача і оголошують себе явно.
CREATE OR REPLACE FUNCTION app_is_system()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(current_setting('app.system', true), '') = 'on';
$$;

-- SECURITY DEFINER навмисно: інакше перевірка членства сама впиралася б у політику
-- на organization_members і рекурсувала.
CREATE OR REPLACE FUNCTION is_org_member(check_user_id uuid, check_organization_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = check_user_id
      AND om.organization_id = check_organization_id
      AND om.status = 'ACTIVE'
      AND om.removed_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION has_org_permission(
  check_user_id uuid,
  check_organization_id uuid,
  check_permission text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT exists (
    SELECT 1
    FROM organization_members om
    WHERE om.user_id = check_user_id
      AND om.organization_id = check_organization_id
      AND om.status = 'ACTIVE'
      AND om.removed_at IS NULL
      AND (
        om.role IN ('OWNER', 'ADMIN')
        OR check_permission = ANY(om.permissions)
      )
  );
$$;

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;

-- Системний прохід окремою політикою, а не домішаний у кожну умову:
-- так його видно і так його можна прибрати однією командою, не чіпаючи решту.
CREATE POLICY organization_members_system ON organization_members
  FOR ALL USING (app_is_system()) WITH CHECK (app_is_system());
CREATE POLICY organization_websites_system ON organization_websites
  FOR ALL USING (app_is_system()) WITH CHECK (app_is_system());
CREATE POLICY website_pages_system ON website_pages
  FOR ALL USING (app_is_system()) WITH CHECK (app_is_system());
CREATE POLICY website_sections_system ON website_sections
  FOR ALL USING (app_is_system()) WITH CHECK (app_is_system());
CREATE POLICY media_assets_system ON media_assets
  FOR ALL USING (app_is_system()) WITH CHECK (app_is_system());

CREATE POLICY organization_members_member_read ON organization_members
  FOR SELECT USING (is_org_member(current_user_id(), organization_id));

CREATE POLICY organization_members_admin_write ON organization_members
  FOR ALL
  USING (has_org_permission(current_user_id(), organization_id, 'members.manage'))
  WITH CHECK (has_org_permission(current_user_id(), organization_id, 'members.manage'));

CREATE POLICY organization_websites_public_published_read ON organization_websites
  FOR SELECT USING (published_at IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY organization_websites_admin_manage ON organization_websites
  FOR ALL
  USING (has_org_permission(current_user_id(), organization_id, 'website.manage'))
  WITH CHECK (has_org_permission(current_user_id(), organization_id, 'website.manage'));

CREATE POLICY website_pages_public_published_read ON website_pages
  FOR SELECT USING (status = 'PUBLISHED' AND published_at IS NOT NULL AND deleted_at IS NULL);

CREATE POLICY website_pages_admin_manage ON website_pages
  FOR ALL
  USING (has_org_permission(current_user_id(), organization_id, 'website.manage'))
  WITH CHECK (has_org_permission(current_user_id(), organization_id, 'website.manage'));

CREATE POLICY website_sections_public_published_page_read ON website_sections
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM website_pages wp
      WHERE wp.id = website_sections.page_id
        AND wp.status = 'PUBLISHED'
        AND wp.published_at IS NOT NULL
        AND wp.deleted_at IS NULL
    )
  );

CREATE POLICY website_sections_admin_manage ON website_sections
  FOR ALL
  USING (has_org_permission(current_user_id(), organization_id, 'website.manage'))
  WITH CHECK (has_org_permission(current_user_id(), organization_id, 'website.manage'));

CREATE POLICY media_assets_member_read ON media_assets
  FOR SELECT USING (is_org_member(current_user_id(), organization_id));

CREATE POLICY media_assets_admin_manage ON media_assets
  FOR ALL
  USING (has_org_permission(current_user_id(), organization_id, 'media.manage'))
  WITH CHECK (has_org_permission(current_user_id(), organization_id, 'media.manage'));
