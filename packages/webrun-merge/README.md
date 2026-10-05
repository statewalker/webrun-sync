# @statewalker/webrun-merge

Domain-neutral three-way merge and diff over the `@statewalker/webrun-files` `FilesApi`.

## Overview

`webrun-merge` compares three `FilesApi` trees (base, left, right) and returns a description of how to reconcile them: a list of `operations` and the unresolved `conflicts`. It never writes to any input. The caller applies the result to a target tree. Structural changes (add, modify, delete, rename, type change) are detected by the engine. Per-file content merging is a pluggable `ContentMerger`; a line-based three-way text merge is the default.

`@statewalker/webrun-files-sync` uses it for bisync. It depends only on `@statewalker/webrun-files` and on a `hashContent` function you pass in. It owns no hash algorithm and knows nothing of git or sync.

## Installation

```bash
pnpm add @statewalker/webrun-merge
```

No peer dependencies.

## Entry points

| Import | Contents |
| --- | --- |
| `@statewalker/webrun-merge` | Everything listed under [API](#api). ESM only, environment-neutral (browser, Node, workers). |

The package ships built JS and `.d.ts` in `dist/` and the TypeScript sources in `src/`.

## Quick start

```typescript
import { createHash } from "node:crypto";
import { MemFilesApi } from "@statewalker/webrun-files-mem";
import { merge } from "@statewalker/webrun-merge";

// Content identity is injected; webrun-merge owns no hash.
async function sha256(input: AsyncIterable<Uint8Array>): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of input) h.update(chunk);
  return `sha256:${h.digest("hex")}`;
}

const base = new MemFilesApi({ initialFiles: { "/a.txt": "a\n", "/c.txt": "c\n" } });
const left = new MemFilesApi({ initialFiles: { "/a.txt": "a2\n" } }); // modified a, deleted c
const right = new MemFilesApi({ initialFiles: { "/a.txt": "a\n", "/e.txt": "e\n" } }); // added e

const { operations, conflicts } = await merge(base, left, right, { hashContent: sha256 });

// operations: [{ op: "modify", path: "/a.txt", source: { side: "left", path: "/a.txt" } },
//              { op: "delete", path: "/c.txt" },
//              { op: "add",    path: "/e.txt", source: { side: "right", path: "/e.txt" } }]
// conflicts:  []
// Apply the operations to your target tree yourself; merge() never writes.
```

## API

- **`merge(base, left, right, opts): Promise<MergeResult>`**: the engine. Returns `{ operations, conflicts }`. Never mutates an input.
- **`createTextContentMerger(): ContentMerger`**: the default per-file merger (line-based three-way text merge).
- **`threeWayMergeLines(base, left, right)`**: the line-level three-way algorithm used by the default merger. Takes three string arrays and returns `{ ok, lines? }`.

`MergeOptions`:

- `hashContent(stream) => Promise<string>` (required): content identity used for equality, exact rename detection and identical-change collapse.
- `contentMerger?`: replaces the default text merger.
- `renameStrategy?`: heuristic rename matching for files left after exact (hash-equal) matching.
- `resolve?`: conflict resolver; return a `Resolution` or `undefined` to keep the conflict.
- `textMergeMaxBytes?`: files larger than this (default 1 MiB) are reconciled by hash only.

Result types: `MergeOp` (`add`, `modify`, `delete`, `rename`; carries inline `content` or a `source` reference), `Conflict` with `ConflictKind` (`content`, `modify-delete`, `add-add`, `rename-rename`, `rename-modify`, `type-change`), `MergeResult`, `EntryRef`, `Resolution`, `RenameCandidates`, `ContentMergeInput`, `ContentMergeOutput`, `Side`, `FileKind`, `FilesApi`, `ByteStream`.

## License

MIT
