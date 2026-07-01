# ChurchFlow agent instructions

These instructions apply to the entire repository. More specific `AGENTS.md` files in subdirectories extend or override them.

## Working agreement

- Read this file and the nearest scoped `AGENTS.md` before changing code.
- Preserve existing user changes and keep edits limited to the requested task.
- Use `pnpm`; respect the Node and pnpm versions declared in `package.json`.
- Prefer existing project patterns and shared packages over introducing parallel abstractions.
- Do not run a production Next.js build while a development server is active because both write to `.next`.
- Do not add dependencies unless the task requires them.
- Use clear English for code, identifiers, UI copy, comments, and documentation.

## Quality checks

- Format changed files with Prettier.
- Run targeted lint and typecheck checks for the affected workspace.
- Prefer targeted tests first; run broader checks when the change warrants them.
- Report unrelated pre-existing failures instead of modifying unrelated code.

## Repository boundaries

- `apps/web`: Next.js frontend. Follow `apps/web/AGENTS.md`.
- `apps/api`: NestJS API. Follow `apps/api/AGENTS.md`.
- `packages/shared`: framework-neutral schemas and types shared across applications.
- `packages/db`: Prisma schema, migrations, and generated database client exports.

