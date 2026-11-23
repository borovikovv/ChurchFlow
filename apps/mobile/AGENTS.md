# Mobile app agent instructions

Extends the root `AGENTS.md` for `apps/mobile` (Expo + React Native, iPhone first).

## Expo changes every SDK — check before you code

1. Read the `expo` major version in `apps/mobile/package.json`.
2. Use the matching docs: `https://docs.expo.dev/versions/v<major>.0.0/` and https://docs.expo.dev/llms.txt.
3. Install Expo-managed packages with `npx expo install <package>` from `apps/mobile`, never with a bare
   `pnpm add`, so versions match the SDK.

## Structure

- Routes live in `src/app/` (Expo Router). Every file there is a screen; `_layout.tsx` files are
  navigators. Keep components, hooks and helpers outside `src/app/`.
- `ios/` and `android/` are generated (Continuous Native Generation). Never commit or hand-edit them;
  change native behaviour through `app.config.ts` and config plugins.
- Shared schemas and types come from `@churchflow/shared`. Do not copy them into the app.
- Talk to the API only through the app's API client; send only validated query parameters and never
  re-implement backend filtering or permission rules (see root `AGENTS.md`).
- The session token lives in `expo-secure-store` only. Never use AsyncStorage for credentials.
- `EXPO_PUBLIC_*` values are public (inlined into the bundle). No secrets there.
- UI copy is translated (uk + en). Give interactive and asserted elements a stable `testID` so Maestro
  flows can find them.

## Checks

- Fast: `pnpm --filter @churchflow/mobile typecheck lint test` (also part of `pnpm typecheck` / `pnpm test`).
- Simulator (macOS): `pnpm e2e:services && pnpm e2e:api && pnpm e2e:ios`. Flows live in `e2e/flows/`,
  one per user-facing ticket. Seeded accounts are in `apps/api/scripts/e2e-seed.mjs`.
