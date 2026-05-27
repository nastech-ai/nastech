# OpenCode Sources

Reviewed on 2026-03-21.

- repo: `https://github.com/sst/opencode`
- checkout: `../nastech-adjacent/research/opencode`
- commit: `2e0d5d230893dbddcefb35a02f53ff2e7a58e5d0`

## Primary files inspected

- `../nastech-adjacent/research/opencode/packages/opencode/src/session/message-v2.ts`
- `../nastech-adjacent/research/opencode/packages/opencode/src/session/index.ts`
- `../nastech-adjacent/research/opencode/packages/opencode/src/session/prompt.ts`
- `../nastech-adjacent/research/opencode/packages/sdk/js/src/v2/gen/types.gen.ts`
- `../nastech-adjacent/research/opencode/packages/opencode/src/tool/task.ts`
- `../nastech-adjacent/research/opencode/packages/opencode/src/tool/todo.ts`
- `../nastech-adjacent/research/opencode/packages/opencode/src/permission/index.ts`
- `../nastech-adjacent/research/opencode/packages/opencode/src/permission/evaluate.ts`
- `../nastech-adjacent/research/opencode/packages/opencode/src/server/server.ts`
- `../nastech-adjacent/research/opencode/packages/opencode/src/server/routes/experimental.ts`
- `../nastech-adjacent/research/opencode/packages/opencode/src/auth/index.ts`
- `../nastech-adjacent/research/opencode/packages/opencode/src/control-plane/workspace-server/routes.ts`
- `../nastech-adjacent/research/opencode/packages/opencode/src/control-plane/sse.ts`
- `../nastech-adjacent/research/opencode/packages/app/src/context/global-sync.tsx`
- `../nastech-adjacent/research/opencode/packages/app/src/context/global-sync/event-reducer.ts`
- `../nastech-adjacent/research/opencode/packages/app/src/components/session-context-usage.tsx`
- `../nastech-adjacent/research/opencode/packages/app/src/components/session/session-context-tab.tsx`

## Notes

- The context/debug surface is not a side detail; it is one of the strongest product ideas in the repo.
- The server split deserves deeper follow-up work after this first pass.
