# Email

ChurchFlow sends transactional email from the API only. Email provider secrets must never be exposed to the web app or any `NEXT_PUBLIC_*` variable.

## Environment

- `PLATFORM_ADMIN_EMAIL`: required API config. New organization request notifications are sent to this address, not to the requester.
- `EMAIL_PROVIDER`: optional. Use `resend` for Resend delivery or `console` for safe local logging.
- `RESEND_API_KEY`: optional unless Resend delivery is enabled. Keep this server-side only.
- `EMAIL_FROM`: optional unless Resend delivery is enabled. Example: `ChurchFlow <noreply@example.com>`.

## Delivery Behavior

If Resend credentials are missing, the API uses the console provider. Console fallback does not throw; it logs the local-development email payload:

- event
- recipient
- subject
- text body, including local invitation links

Do not use the console provider in shared or production environments. Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM` when real delivery is required. If `EMAIL_PROVIDER=resend` is set without both Resend settings, API startup fails instead of silently falling back to console.

## Message Routing

- Organization request admin emails go to `PLATFORM_ADMIN_EMAIL`. The requester contact email is included in the email body for review context.
- Organization invitation emails go to the invited user email address.
- Organization request rejection emails go to the requester contact email address.
