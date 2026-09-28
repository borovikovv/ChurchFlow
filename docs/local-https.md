# Local HTTPS

Telegram Web Login does not accept `localhost` redirect URIs. For local Telegram testing, run ChurchFlow through the local Caddy HTTPS proxy at:

```text
https://churchflow.test
```

## Hostname

Add the local hostname to `/etc/hosts`:

```text
127.0.0.1 churchflow.test
```

## Proxy

Start the normal backing services plus Caddy:

```sh
docker compose up -d
```

Caddy proxies:

- `https://churchflow.test` to the web app on `localhost:3000`
- `https://churchflow.test/v1/*` to the API on `localhost:4000`

Keep the app servers running separately:

```sh
pnpm dev
```

## Trust Certificate

The Caddy service uses an internal local certificate authority. Browsers may show a certificate warning until you trust the Caddy root certificate from the `caddy-data` Docker volume, or you replace this setup with your own trusted local certificate.

If you prefer `mkcert`, generate a certificate for `churchflow.test`, mount it into Caddy, and replace `tls internal` in `dev/caddy/Caddyfile` with:

```text
tls /path/in/container/churchflow.test.pem /path/in/container/churchflow.test-key.pem
```

## Environment

Use the proxy URL for browser-visible URLs:

```env
WEB_APP_URL=https://churchflow.test
PUBLIC_API_URL=https://churchflow.test/v1
COOKIE_DOMAIN=
TELEGRAM_REDIRECT_URI=https://churchflow.test/v1/auth/telegram/callback

NEXT_PUBLIC_WEB_URL=https://churchflow.test
NEXT_PUBLIC_API_URL=https://churchflow.test/v1
API_INTERNAL_URL=http://localhost:4000/v1
```

`API_INTERNAL_URL` stays on localhost because Next server-side code can call the API directly without going through TLS.

`PUBLIC_API_URL` must be set to the proxy URL, matching `NEXT_PUBLIC_API_URL`. A published website links its images to it, so leaving it on its `http://localhost:4000/v1` default makes every section background mixed content on an `https://churchflow.test` page, which the browser blocks, and points `og:image` at a host no unfurler can reach.

## BotFather

Register these values in BotFather Web Login:

```text
Redirect URI: https://churchflow.test/v1/auth/telegram/callback
Trusted Origin: https://churchflow.test
```
