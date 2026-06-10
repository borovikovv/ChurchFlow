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
# Organization Approval And Invitation RLS Notes

Platform admin and organization admin are separate authorization domains. Platform admins are represented by `users.platform_role`; organization admins are represented by `organization_members.role` inside a tenant.

`organization_requests` should not be writable directly from public database clients. Public submissions go through backend validation and rate limiting via `POST /v1/organization-requests`.

`organization_invitations` policies should allow tenant owners/admins to create and manage pending invitations for their organization. Acceptance should happen through the backend so token hashing, email matching, verified email checks, and audit logging stay centralized.

`organization_members` policies should expose rows only to the current tenant context and should treat `status = ACTIVE` as the normal membership predicate. Removed members are retained for audit/history.
