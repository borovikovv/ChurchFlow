# ChurchFlow UI/UX

## Application shell

- Authenticated product screens use a persistent left sidebar and full-width content area.
- Public and authentication screens keep the compact public header.
- Platform-level navigation and organization-level navigation stay visually separate.
- On small screens the sidebar becomes a horizontal navigation region above the content.

## Reusable components

Reusable primitives live in `apps/web/src/components/ui`:

- `Button` and `ButtonLink` define primary, secondary, danger, and ghost actions.
- `Tabs` provides workspace navigation and filters.
- `DataTable` wraps TanStack Table sorting, keyboard navigation, empty states, and clickable rows.
- `StatusBadge` provides consistent status semantics.
- `PageHeader` gives pages a predictable title, description, and action area.
- `PhoneInputField` stores international E.164-compatible values and supports country-specific formatting.

Page-specific client table definitions live next to their domain under `components/admin` rather than inside the generic table primitive.

## Interaction guidelines

- Keep one obvious primary action per page or panel.
- Always show API failures; never convert a failed request into an empty list.
- Use tabs for switching datasets and compact pills for filters. `ALL` must clear the filter.
- Make list rows clickable, keyboard accessible, and visually highlight hover/focus.
- Hide actions that are invalid for the current status or role.
- Keep destructive actions visually separate and ask for confirmation before irreversible hard deletion.
- Preserve the user's current tab and filters when returning from a detail page.
- Use an organization switcher once normal users can belong to multiple organizations and the API exposes their memberships.
- Add server-side pagination and search before organization/request volumes become large; keep TanStack sorting as a client enhancement for the current page.
