# RLS

ChurchFlow uses a PostgreSQL RLS-first authorization model.

## Request Context

The API should bind identity during database transactions:

```sql
set local app.current_user_id = '<authenticated-user-id>';
```

Helper functions:

- `current_user_id()`
- `is_org_member(user_id, organization_id)`
- `has_org_role(user_id, organization_id, role)`
- `has_org_permission(user_id, organization_id, permission)`

## Policy Intent

- Organization members can read tenant records they belong to.
- Admin editing requires explicit permissions such as `website.manage`.
- Public website pages are readable only when published.
- Private CRM/member data is never exposed through public website policies.

See `packages/db/sql/001_rls_foundation.sql` for the starting policy script.
