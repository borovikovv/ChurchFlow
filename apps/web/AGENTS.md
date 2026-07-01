# Web application agent prompt

You are working in the ChurchFlow Next.js application. Follow these instructions for every change under `apps/web`, in addition to the repository-level `AGENTS.md`.

Your goal is not only to make the requested behavior work. Keep the codebase easy to navigate, locally understandable, and free of dumping-ground files. Make the smallest coherent change and leave code in a cleaner structural state than you found it.

## Required workflow

Before editing:

1. Identify whether the code is route-local, feature-shared, web-global, or shared across applications.
2. Search for an existing component, hook, action, utility, API type, or pattern before creating one.
3. Put new code at the narrowest scope where every consumer can import it without crossing architectural boundaries.
4. Keep route files focused on data loading and composition. Extract unrelated types, actions, hooks, and complex UI.

After editing:

1. Remove dead code and superseded helpers introduced by the change.
2. Format changed files with Prettier.
3. Run the web workspace typecheck and targeted ESLint checks.
4. Do not run `next build` while `next dev` is active.

## Placement decision

Use this order when deciding where code belongs:

1. **Route-local** — used by one route only: keep it beside that route in a clearly named private folder or file such as `_components`, `_hooks`, `actions.ts`, `types.ts`, or `styles.ts`.
2. **Feature-level** — reused by multiple routes or components in one business domain: place it under `src/features/<feature>/` and organize it into `components`, `hooks`, `actions`, `types`, or `styles` only as needed.
3. **Web-global** — generic and reused across unrelated web features: use `src/components/ui`, `src/hooks`, `src/lib`, `src/api`, or `src/types` according to responsibility.
4. **Cross-application** — shared by web and API or representing a common contract: place it in `packages/shared`.

Do not promote code to a broader scope “just in case.” Promote it when a real second consumer exists or when it represents an application-wide contract.

## Recommended structure

```text
apps/web/
  app/
    (group)/route/
      page.tsx                 # data loading and composition
      actions.ts               # route-only server actions
      types.ts                 # route-only non-component types
      _components/             # route-only components
      _hooks/                  # route-only hooks
  src/
    api/
      client.ts
      types/<domain>.ts        # API request/response contracts used by web
    components/ui/             # generic reusable UI primitives
    features/<feature>/
      components/
      hooks/
      actions/
      types/
      styles/
    hooks/                     # hooks shared by unrelated features
    lib/                       # web-global pure utilities
    types/                     # web-global non-API types
```

Create only the folders needed by the current change. Avoid empty architecture scaffolding.

## Components and types

- Keep each component focused on one responsibility. Split components that mix data orchestration, multiple dialogs, mutation logic, and large presentation sections.
- Keep component-specific types beside the component in `<component-name>.types.ts`; do not declare substantial interfaces or reusable types inside the component file.
- Small, obvious prop types may remain inline only when they are private, non-reusable, and improve readability.
- Keep feature domain types in `src/features/<feature>/types/` when several files in that feature use them.
- Keep API request, response, and payload types in `src/api/types/<domain>.ts`, grouped by domain rather than in one global `types.ts` dump.
- If an API contract is shared with the backend, define the canonical schema/type in `packages/shared` and import it instead of duplicating it.
- Do not mix API transport shapes with UI view-model types. Map between them at the feature boundary when their needs differ.
- Avoid catch-all files such as `utils.ts`, `helpers.ts`, or `types.ts` containing unrelated domains. Use responsibility-specific names.

## Styling

- Use Tailwind utilities for all new or changed UI styling.
- Keep one-off layout and visual rules directly in the owning component through `className`.
- When Tailwind class groups repeat or form reusable variants, move them beside the component into `<component-name>.styles.ts` as named class maps or variant helpers.
- If a component genuinely requires CSS that Tailwind cannot express cleanly, use a colocated `<component-name>.module.css`; do not add feature selectors to global CSS.
- Use `app/globals.css` only for project-wide design tokens, resets, base element rules, and truly global primitives.
- Reuse design tokens and shared UI components. Do not introduce arbitrary colors, spacing systems, or near-duplicate controls when a project primitive exists.
- Keep responsive, hover, focus, disabled, loading, error, and destructive states explicit.
- Preserve keyboard navigation, focus management, semantic HTML, accessible labels, and dialog/menu behavior.

## State and UI updates

- Filtering, search, sorting, and pagination for API-backed collections must be implemented by the backend and expressed through validated query parameters. The web application may filter locally only for explicitly small, already-loaded presentation-only datasets where no server query is involved.
- Do not reload the page to update UI that can be reconciled locally.
- After a mutation, update local state, server-action state, optimistic state, or the relevant cache instead of redirecting, calling `window.location`, or refreshing the whole route.
- Use `useActionState` for form-oriented server actions that need pending, success, and error states.
- Use `useOptimistic` only when rollback behavior is clear and a faster optimistic experience materially helps.
- Use server actions for authenticated mutations that naturally belong to the current Next.js feature. Keep reusable actions in a dedicated `actions.ts` or feature action module.
- Keep mutation feedback next to the control that initiated it. Disable duplicate submission while pending.
- Refresh or revalidate only when authoritative server data cannot be safely reconciled locally. Prefer the narrowest cache/path invalidation possible.

## Hooks and effects

- Do not use `useEffect` for derived values, event handling, form submission, state synchronization between React values, or data transformations that can happen during render.
- Use `useEffect` only to synchronize React with an external system: browser APIs, subscriptions, timers, observers, imperative third-party widgets, or external event sources.
- Put user-triggered behavior in event handlers and mutation actions, not effects.
- Compute derived state during render or with `useMemo` only when the computation is genuinely expensive or referential stability is required.
- Prefer controlled state, component composition, and key-based resets over effects that copy props into state.
- Always clean up subscriptions, listeners, timers, and observers created by an effect.
- Extract reusable stateful logic into a named `use-<name>.ts` hook. Keep a single-feature hook beside that feature; move it to `src/hooks` only when unrelated features reuse it.
- Hooks must expose a small domain-oriented API and must not hide surprising page refreshes, global mutations, or unrelated side effects.

## Next.js and server/client boundaries

- Keep Server Components as the default. Add `'use client'` only at the smallest interactive boundary.
- Keep `page.tsx` and `layout.tsx` thin: load data, enforce route-level access, and compose feature components.
- Move server actions out of large page files when they are reusable or when the page becomes difficult to scan.
- Write directives exactly as `'use server';` and `'use client';`, without parentheses.
- Never import server-only environment, cookie, database, or authentication modules into Client Components.
- Pass the smallest serializable data shape across the server/client boundary.
- Avoid duplicating server data into client state unless the client must edit it or reconcile mutations locally.

## Utilities and dependencies

- A utility used by one component stays beside that component.
- A utility used across one feature belongs in that feature.
- A generic utility used across unrelated web features belongs in `src/lib/<responsibility>.ts`.
- API-only global utilities belong in `apps/api`, not `apps/web`; cross-application pure utilities belong in `packages/shared`.
- Prefer pure functions with explicit inputs and outputs. Do not hide network calls or global state changes inside generic helpers.
- Do not add a new dependency when a small, readable implementation or an existing project dependency is sufficient.
- Avoid circular dependencies and imports from a feature's internals into unrelated features.

## Readability guardrails

- Name files and exports by domain responsibility, not implementation detail.
- Prefer early returns and small named functions over deeply nested branches.
- Avoid boolean-prop explosions; use explicit variants or composition when behavior diverges.
- Do not create abstraction layers around a single trivial use. Extract when logic is complex, independently testable, or reused.
- When a file becomes difficult to scan because it contains several responsibilities, split by responsibility rather than by arbitrary line count.
- Comments should explain decisions and invariants, not restate the code.
- Keep public module APIs narrow; do not export internals without a consumer.

## Final review checklist

Before considering web work complete, verify:

- The code lives at the narrowest correct scope.
- No API or domain types were duplicated.
- Component-specific types are outside the component implementation when substantial.
- Repeated Tailwind groups are colocated and named.
- The UI updates without a full-page reload when local reconciliation is possible.
- Every `useEffect` synchronizes with a real external system and includes cleanup when needed.
- Pending, error, empty, responsive, and accessible states still work.
- Changed files pass formatting, typecheck, and targeted lint.
