# @statewalker/webrun-storage

Domain-neutral byte-persistence seam: an immutable content-addressed `BlobStore` and a mutable `KvStore` with atomic compare-and-set.

## Overview

This package defines two small primitives and one facade. A `BlobStore` is immutable and keyed by a caller-supplied id; it supports ranged reads and reports byte `size`. A `KvStore` is mutable and keyed, with an atomic `cas`. `RefStore` is a typed string facade over a `KvStore`. The package stores bytes only. It knows nothing of git objects, chunks or hashing: the caller owns every id.

It ships an in-memory adapter and an adapter over any `@statewalker/webrun-files` `FilesApi`. `@statewalker/webrun-content-store` and `@statewalker/vcs-core` build on it.

## Installation

```bash
pnpm add @statewalker/webrun-storage
```

No peer dependencies. Depends on `@statewalker/webrun-files` (types and the `FilesApi` contract).

## Entry points

| Import | Contents |
| --- | --- |
| `@statewalker/webrun-storage` | Everything listed under [API](#api). ESM only, environment-neutral (browser, Node, workers). |

The package ships built JS and `.d.ts` in `dist/` and the TypeScript sources in `src/`.

## Quick start

```typescript
import { MemFilesApi } from "@statewalker/webrun-files-mem";
import { filesBlobStore, memBlobStore, memKvStore, refStore } from "@statewalker/webrun-storage";

// Immutable, content-addressed blobs (in memory, or over any FilesApi):
const blobs = memBlobStore();
const overFiles = filesBlobStore(new MemFilesApi(), { root: "/objects" });

async function* streamOf(...parts: string[]) {
  for (const p of parts) yield new TextEncoder().encode(p);
}

await blobs.put("a1", streamOf("hello ", "world")); // the caller owns the id
await blobs.has("a1"); // true
await blobs.size("a1"); // 11, or -1 if absent
const tail = blobs.get("a1", { start: 6 }); // ranged read -> "world"

// Mutable KV with atomic compare-and-set, and the ref facade over it:
const kv = memKvStore();
const created = await kv.cas("head", undefined, new TextEncoder().encode("v1")); // true (create)

const refs = refStore(kv);
await refs.compareAndSet("refs/heads/main", undefined, "commit-1");
const id = await refs.read("refs/heads/main"); // "commit-1"
```

## API

- **`BlobStore`**: `put(id, bytes, opts?)` (streaming; `opts.verify` re-derives the id from the bytes and rejects on mismatch), `get(id, range?)` with `{ start?, end? }` (`end` exclusive; empty stream if absent), `has(id)`, `remove(id)`, `size(id)` (`-1` when absent), `list(prefix?)`. Re-putting the same id is idempotent. `ObjectStore` is an alias.
- **`KvStore`**: `get`, `put`, `remove`, `list(prefix?)`, plus `cas(key, expected, next)`. `cas` writes and returns `true` only if the current value equals `expected` byte by byte; `next === undefined` deletes.
- **`RefStore`**: string-id facade over a `KvStore`: `read`, `compareAndSet`, `list`.
- **Adapters and facade**: `memBlobStore()`, `memKvStore()`, `filesBlobStore(files, opts?)` (`opts.root`, default `/`; blobs are stored at `<root>/<id[0..2]>/<id[2..]>`), `refStore(kv)`.
- Types: `BlobStore`, `KvStore`, `RefStore`, `ObjectStore`, `ByteStream`, `FilesBlobStoreOptions`.

## Notes

- **Hash-agnostic.** `put(id, ...)` takes the id from the caller. `webrun-content-store` hashes chunks; `vcs-core` computes git object ids. Integrity checking is an optional caller-supplied `verify` on `put`.
- **CAS is required**, so `RefStore` always gets atomic compare-and-set.
- **One backend object per blob.** Packing and chunk grouping live in the layers above.
- The same behavioural test suite runs against the memory and files adapters.

## License

MIT
