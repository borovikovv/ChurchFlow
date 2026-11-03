# ChurchFlow Mobile

Expo (React Native) app for ChurchFlow, built iPhone first. Plan and tickets live in the
"ChurchFlow Mobile" Todoist project (M-01 … M-42).

## Run it on a Mac

```bash
pnpm install
pnpm e2e:services          # Postgres + Mailpit in Docker
pnpm e2e:api               # migrate, seed, build and start the API on :4000
pnpm --filter @churchflow/mobile ios   # build a dev client and open it in the simulator
```

Seeded sign-in accounts: `owner@e2e.churchflow.test` and `member@e2e.churchflow.test`; their
codes arrive in Mailpit at http://localhost:8025.

End-to-end flows in the simulator: `pnpm e2e:ios` (Release build + Maestro; install Maestro with
`curl -fsSL https://get.maestro.mobile.dev | bash`). Output goes to `e2e/artifacts/`.

## Pipeline

| Workflow                 | When                                     | What                                                                         |
| ------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------- |
| `ci.yml`                 | every PR                                 | typecheck, mobile lint, all unit tests (Jest for mobile)                     |
| `mobile-e2e.yml`         | PRs touching the app, API or packages    | iOS simulator build + Maestro flows, screenshots as artifacts                |
| `mobile-agent.yml`       | manual (Actions → Mobile agent → Run)    | next ready Todoist ticket → Claude Code → checks + simulator → PR to `stage` |
| `mobile-agent-close.yml` | a `mobile/m-xx-*` PR merged into `stage` | closes the Todoist ticket so dependants become ready                         |

The agent takes the lowest-numbered open ticket labelled `mobile` whose "Depends on" tickets are
all closed and that is not `manual`, `in-progress`, `blocked` or `review`. It labels the ticket as it
goes: `in-progress` → `review` (PR opened) or `blocked` (comment with the reason; the attempt is
pushed to its branch without a PR). Remove `blocked` to let it retry.

### Secrets (Settings → Secrets and variables → Actions)

| Secret                    | Needed for                                | How to get it                                                     |
| ------------------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| `CLAUDE_CODE_OAUTH_TOKEN` | the agent (uses your Claude subscription) | run `claude setup-token` locally                                  |
| `ANTHROPIC_API_KEY`       | alternative to the OAuth token            | console.anthropic.com                                             |
| `TODOIST_API_TOKEN`       | picking and labelling tickets             | Todoist → Settings → Integrations → Developer                     |
| `MOBILE_AGENT_GH_TOKEN`   | optional: PRs that trigger CI             | fine-grained PAT with contents + pull requests write on this repo |

Without `MOBILE_AGENT_GH_TOKEN` the agent opens PRs with the default `GITHUB_TOKEN`, and GitHub does
not start other workflows for those PRs; run CI on it by pushing a follow-up commit from your machine.

## Builds and releases

EAS profiles are in `eas.json` (`development`, `development-simulator`, `preview`, `production`).
See the Expo guide linked from the plan for Apple Developer, TestFlight and EAS Update.
