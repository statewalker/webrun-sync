# @statewalker/webrun-files-sync

rclone-like file synchronisation (copy, sync, bisync, move, check) between two `@statewalker/webrun-files` `FilesApi` endpoints.

## Overview

The engine plans first, then executes. `plan(a, b, op, opts)` mutates neither endpoint and returns a serializable `SyncPlan`. `execute(plan, a, b, opts)` applies it, emits events, and can resume from a checkpoint after an interruption. `bisync` is a three-way merge against a stored `SyncAnchor` (the state after the last sync), done by `@statewalker/webrun-merge`; it is not two chained one-way syncs.

The package imports only `@statewalker/webrun-files` and `@statewalker/webrun-merge` and knows nothing of git. Content identity (`hashContent`), the per-file `Transfer` strategy and conflict resolution are passed in.

## Installation

```bash
pnpm add @statewalker/webrun-files-sync
```

No peer dependencies.

## Entry points

| Import | Contents |
| --- | --- |
| `@statewalker/webrun-files-sync` | Everything listed under [API](#api). ESM only, environment-neutral (browser, Node, workers). |

The package ships built JS and `.d.ts` in `dist/` and the TypeScript sources in `src/`.

## Quick start

```typescript
import { createHash } from "node:crypto";
import { MemFilesApi } from "@statewalker/webrun-files-mem";
import { execute, plan } from "@statewalker/webrun-files-sync";

async function sha256(input: AsyncIterable<Uint8Array>): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of input) h.update(chunk);
  return `sha256:${h.digest("hex")}`;
}

const a = new MemFilesApi({ initialFiles: { "/new.txt": "new", "/changed.txt": "v2" } });
const b = new MemFilesApi({ initialFiles: { "/changed.txt": "v1", "/extra.txt": "keep" } });

// Plan: serializable, mutates nothing.
const p = await plan(a, b, "copy", { hashContent: sha256 });

// Execute, streaming per-action events.
for await (const event of execute(p, a, b, { hashContent: sha256 })) {
  if (event.type === "done") console.log("synced", event.action);
}
// b now has new.txt and the updated changed.txt; extra.txt is kept (copy never deletes).
```

## API

- **`plan(a, b, op, opts): Promise<SyncPlan>`**: `op` is `"copy" | "sync" | "bisync" | "move" | "check"`. `copy` never deletes destination files; `sync` deletes extra ones; `move` is copy, verify, delete; `check` only compares; `bisync` runs the three-way merge.
- **`execute(plan, a, b, opts): AsyncIterable<SyncEvent>`**: applies a plan, verifies each action (default `verify: "size"`), and skips action indices already recorded in `opts.checkpoint`. Events: `warning`, `conflict`, `start`, `done`, `skipped`, `failed`.
- **`buildAnchor(files, hashContent): Promise<SyncAnchor>`**: builds a bisync anchor from an endpoint.
- **`snapshot(files, filter?)`** and **`isChanged(from, to, path, fromEntry, toEntry, opts)`**: the change-detection primitives.
- **`createStreamingTransfer(): Transfer`**: the default whole-file streaming copy.

`SyncOptions`:

- `hashContent` (required).
- `filter?`: `(path) => boolean`.
- `transfer?`: a `Transfer` (default: `createStreamingTransfer()`).
- `verify?`: `VerificationMode` (`size`, `mtime`, `backend-hash`, `content-hash`, `read-after-write`).
- `anchorStore?`, `pairKey?` (default `"default"`): where bisync reads and writes its anchor.
- `resolve?`: conflict resolver.
- `quickFingerprint?`: enables the quick-fingerprint step of change detection.
- `checkpoint?`: a `CheckpointStore` for resumable execution.

Types: `SyncPlan`, `SyncAction`, `SyncConflict`, `SyncEvent`, `SyncOp`, `SyncAnchor`, `AnchorStore`, `CheckpointStore`, `Transfer`, `PathFilter`, `VerificationMode`, `Resolution`, `FilesApi`, `ByteStream`.

## Notes

- **Resumable.** `execute` records each completed action index, so an interrupted run resumes without repeating work.
- **Cheap checks first.** Change detection goes path/type, size, stable mtime, optional quick fingerprint, then full `hashContent`, and stops at the first decisive step.
- **Pluggable transfer.** The default copies whole files. `chunkTransfer` from `@statewalker/webrun-content-transfer` plugs into the same `transfer` option and moves only missing chunks.

## License

MIT
