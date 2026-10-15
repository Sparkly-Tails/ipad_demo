# Shopify embedded app template: managed install and token exchange

A Shopify embedded app with **no access token in code or environment
variables**. It is based on Shopify's React Router app template and is meant as
a starting point for migrating an app that currently stores or hardcodes Admin
API tokens.

Verified on the Shopify iPad app (iOS 18.7, app 26.6.2), hosted on Vercel with
Postgres on Supabase.

## How authentication works

1. The app is installed with Shopify managed installation (no OAuth redirect,
   no `use_legacy_install_flow`). Scopes are declared in `shopify.app.toml`.
2. App Bridge gives each page a short-lived session token (ID token). The
   server verifies it and exchanges it for an **expiring offline access token**
   (about 1 hour) plus a refresh token (90 days). See `authenticate.admin` in
   `app/shopify.server.ts`.
3. Tokens are stored per shop in the `Session` table (Postgres). Expired tokens
   are replaced on the next page load, and refreshed with the refresh token
   for background work such as webhooks.
4. No cookies are used, so it works in the Shopify mobile apps.

## Environment variables

| Variable | Secret | Notes |
|---|---|---|
| `SHOPIFY_API_KEY` | no | Client ID from the Dev Dashboard |
| `SHOPIFY_API_SECRET` | **yes** | Client secret |
| `SHOPIFY_APP_URL` | no | Public URL of the deployed app |
| `SCOPES` | no | Optional, mirrors `shopify.app.toml` |
| `DATABASE_URL` | **yes** | Supabase transaction pooler, port 6543, `?pgbouncer=true` |
| `DIRECT_URL` | **yes** | Supabase session pooler, port 5432, used for migrations |

`shopify app dev` supplies the Shopify variables locally. A local `.env` for
the two database URLs is git-ignored.

## Run and deploy

```bash
npm install
npx prisma migrate deploy   # needs DIRECT_URL; creates Session with row-level security
npm run dev                 # shopify app dev
```

- **Vercel:** the `@vercel/react-router` preset is in `react-router.config.ts`.
  Set the variables above for Production. Do not enable Vercel Auth on the
  production URL, or Shopify cannot reach the app or its webhooks.
- **Release config:** `npm run deploy` (`shopify app deploy`) releases the app
  URL, scopes and webhooks. A "dev previews" badge in the admin means a
  `shopify app dev` preview is overriding the released version; remove it with
  `npx shopify app dev clean`.
- **Node:** 22.x.

## Database

`prisma/migrations` creates one table, `Session`, and turns on row-level
security. Supabase exposes `public` tables through its REST API, and this table
holds tokens, so keep RLS on and add no policies. Prisma connects as the
database owner and is not affected.

## Webhooks

`app/uninstalled` and `app/scopes_update` are in `app/routes`. The three
mandatory compliance topics (`customers/data_request`, `customers/redact`,
`shop/redact`) are handled in `app/routes/webhooks.compliance.tsx`. HMAC is
verified by `authenticate.webhook`; invalid signatures get 401. This app stores
no customer data, so only `shop/redact` deletes anything (the shop's sessions).

## Verify on a device

Open **Auth check** from the app nav. It shows the shop name and token details
from the server, whether the App Bridge handshake completes, and a refetch that
must produce a newer server render time.

## Migrating an app that uses stored or hardcoded tokens

1. Create the app in the Dev Dashboard and copy `shopify.app.toml` here. Set
   `application_url`, `embedded = true` and your scopes.
2. Replace every use of a stored token (`SHOPIFY_ACCESS_TOKEN`, a database
   column, a constant) with `const { admin } = await authenticate.admin(request)`
   in loaders and actions.
3. For code without a user request (webhooks, jobs), use
   `unauthenticated.admin(shop)`; it refreshes the stored token when needed.
4. Keep `future: { expiringOfflineAccessTokens: true }`. Public apps must use
   expiring offline tokens for the GraphQL Admin API from 2027-01-01.
5. Existing shops that already have a non-expiring token can be converted
   without a user session using Shopify's token exchange migration request
   (`expiring=1`). See
   [Migrate to expiring offline access tokens](https://shopify.dev/docs/apps/build/authentication-authorization/migrate-to-expiring-offline-access-tokens).
6. Delete the token variables. Only the client secret stays secret.
7. Run `npm run deploy`, install on a development store, and check Auth check
   on the devices your staff use.

## License

MIT, from Shopify's app template. See `LICENSE.md`.
