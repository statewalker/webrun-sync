# @statewalker/webrun-files-sync

## What it is

An rclone-like synchronisation engine for two `FilesApi` endpoints from
`@statewalker/webrun-files`. It supports five operations (`copy`, `sync`, `bisync`, `move`,
`check`) and splits each into a pure planning step and an execution step that verifies and can
resume.

## Why it exists

Keeping two file trees in step (a browser store and a server, a local folder and a cloud bucket)
is a different job from versioning: it needs cheap change detection, safe deletes and two-way
reconciliation, not commits. Because every storage backend in the ecosystem is a `FilesApi`, one
engine covers all pairs of backends. Two-way sync is a real three-way merge against the state
recorded after the previous sync, done by `@statewalker/webrun-merge`, so a delete on one side is
propagated instead of being undone by a copy from the other side.

## How to use

```bash
pnpm add @statewalker/webrun-files-sync
```

| Import | Contents |
| --- | --- |
| `@statewalker/webrun-files-sync` | `plan`, `execute`, `buildAnchor`, `snapshot`, `isChanged`, `createStreamingTransfer`, and the types `SyncOptions`, `SyncPlan`, `SyncAction`, `SyncEvent`, `SyncOp`, `SyncConflict`, `SyncAnchor`, `AnchorStore`, `CheckpointStore`, `Transfer`, `PathFilter`, `VerificationMode`, `Resolution`, `FilesApi`, `ByteStream`. ESM, runs in browsers, Node and workers. |

| Operation | Effect on `b` (and `a`) |
| --- | --- |
| `copy` | New and changed files from `a` are written to `b`. Nothing is deleted. |
| `sync` | Like `copy`, and files in `b` that are not in `a` are deleted. |
| `move` | Like `copy`, then each source file in `a` is deleted once its copy verifies. |
| `check` | Compares only. `execute` reports warnings and conflicts and changes nothing. |
| `bisync` | Changes from both sides are applied to both sides; conflicts are reported. |

`plan(a, b, op, opts)` returns a JSON-serializable `SyncPlan` (`actions`, `conflicts`,
`warnings`). `execute(plan, a, b, opts)` yields `warning`, `conflict`, `start`, `done`, `skipped`
and `failed` events.

`SyncOptions`: `hashContent` (required); `filter?(path)`; `transfer?` (default
`createStreamingTransfer()`); `verify?` (default `"size"`); `anchorStore?` and `pairKey?`
(default `"default"`) for bisync; `resolve?(conflict)`; `quickFingerprint?`; `checkpoint?`.

## Examples

One-way copy:

```typescript
import { createHash } from "node:crypto";
import { MemFilesApi } from "@statewalker/webrun-files-mem";
import { execute, plan } from "@statewalker/webrun-files-sync";

async function sha256(input: AsyncIterable<Uint8Array>): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of input) h.update(chunk);
  return `sha256:${h.digest("hex")}`;
}

const a = new MemFilesApi({ initialFiles: { "/new.txt": "new", "/changed.txt": "version 2" } });
const b = new MemFilesApi({ initialFiles: { "/changed.txt": "v1", "/extra.txt": "keep" } });

const p = await plan(a, b, "copy", { hashContent: sha256 });
for await (const event of execute(p, a, b, { hashContent: sha256 })) {
  if (event.type === "done") console.log(event.action);
}
// b: new.txt, changed.txt ("version 2"), extra.txt (kept)
// Had both versions of changed.txt the same size and mtime, it would count as unchanged.
```

Two-way sync with a stored anchor:

```typescript
import type { AnchorStore, SyncAnchor } from "@statewalker/webrun-files-sync";

const anchors = new Map<string, SyncAnchor>();
const anchorStore: AnchorStore = {
  read: async (key) => anchors.get(key),
  write: async (key, anchor) => void anchors.set(key, anchor),
};
const opts = { hashContent: sha256, anchorStore, pairKey: "laptop<->server" };

for await (const e of execute(await plan(a, b, "bisync", opts), a, b, opts)) {
  if (e.type === "conflict") console.log("conflict", e.conflict.kind, e.conflict.path);
}
```

Resumable execution: pass a `checkpoint` (`{ read(): Promise<Set<number>>, add(index) }`) backed by
durable storage; a second `execute` with the same plan skips the recorded action indices.

## Internals

### Plan first, then execute

`plan` reads both endpoints and writes nothing, so a plan can be shown to a user, stored, or
tested. `execute` applies the actions in order, verifies each copy, records each finished index in
the checkpoint, and keeps going after a failed action (it emits `failed` and continues).

### Change detection stops at the first decisive check

```
path/kind ─> size ─> equal mtime ─> head+tail sample ─> full hashContent
 differ?     differ?   equal?        (quickFingerprint)   differ?
 changed     changed   unchanged     differ? changed      changed
```

Most files are decided by size or modification time without reading their bytes. With
`quickFingerprint`, the first and last 64 bytes are compared before hashing the whole file.

### How bisync works

```
anchor (state after last sync) ─┐
endpoint a ─────────────────────┼─> webrun-merge ─> actions for both sides + conflicts
endpoint b ─────────────────────┘
```

The anchor stores each path's content id, size and mtime. After a bisync with no failures and no
unresolved conflicts, `execute` writes a new anchor built from `a`. A file changed on both sides
is always a conflict: bisync never line-merges file contents. Pass `resolve` to settle conflicts
programmatically.

### What will surprise you

- **First bisync without an anchor only adds.** With no stored anchor there is no common base, so
  bisync copies files missing on either side, deletes nothing, reports files that differ as
  conflicts, and warns: `no sync anchor; performing conservative union (additions only, no
  deletions)`. Without an `anchorStore`, every bisync runs this way.
- **Equal size and mtime means unchanged.** A file edited without changing its size or
  modification time is not detected (the same rule rclone uses by default).
- **Verification modes collapse to two checks.** `size` and `mtime` both compare byte counts
  (modification times are not comparable across endpoints); `content-hash`, `backend-hash` and
  `read-after-write` all hash both files with `hashContent`.
- **A failed verification is an event, not an exception.** Look for
  `{ type: "failed", reason: "destination verification failed" }`. In a `move`, an unverified
  copy keeps the source: `{ type: "skipped", reason: "destination not verified; source retained" }`.
- **`check` changes nothing**, even if you pass its plan to `execute`.
- The default transfer handles only copies: `streaming transfer only handles copy/update, got <kind>`.

### Dependencies

`@statewalker/webrun-merge` (runtime: bisync) and `@statewalker/webrun-files` (the `FilesApi`
type). The package does not depend on any VCS code.

## License

MIT
