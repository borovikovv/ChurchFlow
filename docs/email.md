# Email

ChurchFlow sends transactional email from the API only. Email provider secrets must never be exposed to the web app or any `NEXT_PUBLIC_*` variable.

## Environment

- `PLATFORM_ADMIN_EMAIL`: required API config. New organization request notifications are sent to this address, not to the requester.
- `EMAIL_PROVIDER`: optional. Use `smtp` for local Mailpit delivery, `resend` for Resend delivery, or `console` for safe local logging.
- `EMAIL_FROM`: required for `smtp` and `resend`. Example: `ChurchFlow <noreply@example.com>`.
- `SMTP_HOST`: required when `EMAIL_PROVIDER=smtp`. For local Mailpit use `localhost`.
- `SMTP_PORT`: required when `EMAIL_PROVIDER=smtp`. For local Mailpit use `1025`.
- `RESEND_API_KEY`: required when `EMAIL_PROVIDER=resend`. Keep this server-side only.

## Delivery Behavior

For local development, ChurchFlow should use Mailpit over SMTP. Start it with:

```bash
docker compose up -d mailpit
```

Then open the inbox UI at `http://localhost:8025`.

Quick local setup:

1. Start Mailpit:

```bash
docker compose up -d mailpit
```

2. Make sure the API uses SMTP in `apps/api/.env`:

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM=ChurchFlow <dev@churchflow.test>
SMTP_HOST=localhost
SMTP_PORT=1025
```

3. Start the API and web app as usual.

4. Open `http://localhost:8025` to view delivered emails.

5. Stop Mailpit when you no longer need it:

```bash
docker compose stop mailpit
```

If no SMTP or Resend credentials are configured, the API uses the console provider. Console fallback does not throw; it logs the local-development email payload:

- event
- recipient
- subject
- text body, including local invitation links

Use `EMAIL_PROVIDER=smtp` for local Mailpit development. Use `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM` for production delivery through Resend. If `EMAIL_PROVIDER=smtp` or `EMAIL_PROVIDER=resend` is set without the required settings, API startup fails instead of silently falling back to console.

## Message Routing

- Organization request admin emails go to `PLATFORM_ADMIN_EMAIL`. The requester contact email is included in the email body for review context.
- Organization invitation emails go to the invited user email address.
- Organization request rejection emails go to the requester contact email address.
