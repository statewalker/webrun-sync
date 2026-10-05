# @statewalker/webrun-merge

## What it is

A three-way merge engine for file trees. It takes three `FilesApi` trees from
`@statewalker/webrun-files` (base, left, right) and returns the operations that reconcile them and
the conflicts it could not resolve. It never writes to any of the inputs.

## Why it exists

Any tool that reconciles two copies of a tree against a common ancestor (bidirectional file sync,
a VCS merge) needs the same structural analysis: what was added, modified, deleted, renamed or
changed type on each side, and where both sides collide. This package does that analysis once,
over plain `FilesApi` trees, with no knowledge of commits or sync state. `@statewalker/webrun-files-sync`
uses it for `bisync`.

## How to use

```bash
pnpm add @statewalker/webrun-merge
```

| Import | Contents |
| --- | --- |
| `@statewalker/webrun-merge` | `merge`, `createTextContentMerger`, `threeWayMergeLines`, and the types `MergeOptions`, `MergeResult`, `MergeOp`, `MergeOpKind`, `Conflict`, `ConflictKind`, `ContentMerger`, `ContentMergeInput`, `ContentMergeOutput`, `EntryRef`, `Resolution`, `RenameCandidates`, `Side`, `FileKind`, `FilesApi`, `ByteStream`. ESM, runs in browsers, Node and workers. |

`merge(base, left, right, opts)` resolves to `{ operations, conflicts }`.

`MergeOptions`:

- `hashContent(stream) => Promise<string>` (required): content identity.
- `contentMerger?`: how to merge a file changed on both sides (default: `createTextContentMerger()`).
- `renameStrategy?`: pairs up deleted and added files that are not byte-identical.
- `resolve?`: called per conflict; return a `Resolution` to replace it with operations, or
  `undefined` to keep it.
- `textMergeMaxBytes?`: size limit for content merging (default 1 MiB).

A `MergeOp` is `add`, `modify`, `delete` or `rename`. It carries either inline `content` (a merged
result) or a `source: { side, path }` telling you which input to copy from. A `Conflict` has a
`kind`: `content`, `modify-delete`, `add-add`, `rename-rename`, `rename-modify` or `type-change`.

## Examples

Structural merge:

```typescript
import { createHash } from "node:crypto";
import { MemFilesApi } from "@statewalker/webrun-files-mem";
import { merge } from "@statewalker/webrun-merge";

async function sha256(input: AsyncIterable<Uint8Array>): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of input) h.update(chunk);
  return `sha256:${h.digest("hex")}`;
}

const base = new MemFilesApi({ initialFiles: { "/a.txt": "a\n", "/c.txt": "c\n" } });
const left = new MemFilesApi({ initialFiles: { "/a.txt": "a2\n" } }); // modified a, deleted c
const right = new MemFilesApi({ initialFiles: { "/a.txt": "a\n", "/e.txt": "e\n" } }); // added e

const { operations, conflicts } = await merge(base, left, right, { hashContent: sha256 });
// operations: modify /a.txt from left, delete /c.txt, add /e.txt from right
// conflicts:  []
```

Line-level merge on its own:

```typescript
import { threeWayMergeLines } from "@statewalker/webrun-merge";

threeWayMergeLines(["a", "b", "c"], ["A", "b", "c"], ["a", "b", "C"]);
// { ok: true, lines: ["A", "b", "C"] }
threeWayMergeLines(["a"], ["x"], ["y"]);
// { ok: false }: both sides changed the same line
```

## Internals

### The engine returns a description, not a result tree

`merge` emits operations and leaves applying them to the caller. That keeps the engine free of
write logic, makes every merge a dry run, and lets the caller decide where the result goes (one
side, both sides, a new tree).

### Identity is injected

Equality, exact rename detection and "both sides made the same change" all compare
`hashContent` results. The package depends on no hash library, and callers can reuse whatever
hash their storage already uses.

### Two-step rename detection

Deleted and added files with equal hashes are paired as renames first. Only the remaining
candidates go to the optional `renameStrategy`, so a similarity heuristic never overrides an
exact match.

### Content merging is pluggable and bounded

The default merger splits text into lines and runs a diff3-style merge: edits that do not overlap
are combined, overlapping edits become a `content` conflict unless they are identical. Binary files and
files above `textMergeMaxBytes` never reach the merger; they are compared by hash only, and if both sides
changed them differently, the result is a conflict. The 1 MiB default keeps line diffs of large
or binary files out of memory.

### Output is deterministic

Operations and conflicts come out in a stable order for the same inputs, so plans built on them
can be compared and tested.

### Dependencies

Only `@statewalker/webrun-files`, for the `FilesApi` and `FileKind` types. No runtime
dependencies.

## License

MIT
