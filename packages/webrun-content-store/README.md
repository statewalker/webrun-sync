# @statewalker/webrun-content-store

## What it is

A content-addressed store for large byte streams. It splits content into content-defined chunks,
stores each distinct chunk once, and keeps a manifest per object listing its chunks. Chunks and
manifests live in two `BlobStore`s from `@statewalker/webrun-storage`; object and chunk ids come
from a hash function you supply.

## Why it exists

Large files are expensive to store twice and to send whole. With content-defined chunking, two
versions of a file share most of their chunks, so storage grows by the changed region only, and a
peer that already has most chunks needs only the missing ones. This package provides that chunk
layer for any domain: it knows nothing of git, LFS or sync, and treats every id as an opaque
string. `@statewalker/webrun-content-transfer` moves its chunks between stores.

## How to use

```bash
pnpm add @statewalker/webrun-content-store @statewalker/webrun-storage
```

| Import | Contents |
| --- | --- |
| `@statewalker/webrun-content-store` | `createContentStore` and the types `ContentStore`, `ContentStoreDeps`, `ContentStoreOptions`, `ObjectDescriptor`, `ChunkRef`, `ObjectId`, `ChunkId`, `CdcParams`, `ByteStream`. ESM, runs in browsers, Node and workers. |

`createContentStore(deps, opts?)`:

- `deps`: `{ chunks: BlobStore, manifests: BlobStore, hashContent }`.
- `opts`: `{ chunkThreshold?, cdc? }`. Defaults: `chunkThreshold` 4096 bytes,
  `cdc` `{ min: 2048, avg: 8192, max: 32768 }`.

The returned `ContentStore`:

| Level | Methods |
| --- | --- |
| Object | `put(content)` returns `{ id, size, chunks }`; `read(id, { offset?, length? }?)`; `has(id)`; `getManifest(id)`; `remove(id)` |
| Chunk | `hasChunks(ids)` returns the ids that are **not** stored; `putChunk(id, bytes)`; `getChunk(id)` |
| Maintenance | `gc(liveRoots)` returns `{ removedObjects, removedChunks }` |

## Examples

Store, read back and slice an object:

```typescript
import { createHash } from "node:crypto";
import { memBlobStore } from "@statewalker/webrun-storage";
import { createContentStore } from "@statewalker/webrun-content-store";

async function sha256(bytes: AsyncIterable<Uint8Array>): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of bytes) h.update(chunk);
  return `sha256:${h.digest("hex")}`;
}
async function* streamOf(bytes: Uint8Array) {
  yield bytes;
}

const store = createContentStore({
  chunks: memBlobStore(),
  manifests: memBlobStore(),
  hashContent: sha256,
});

const payload = new Uint8Array(100_000).map((_, i) => (i * 7919) % 251);
const d = await store.put(streamOf(payload)); // { id, size: 100000, chunks: [...] }
const whole = store.read(d.id);
const slice = store.read(d.id, { offset: 30_000, length: 2_500 }); // crosses chunk borders
```

Find what a peer is missing, and clean up:

```typescript
const missing = await store.hasChunks(d.chunks.map((c) => c.id)); // [] here: all present
await store.remove(d.id); // removes the manifest only
await store.gc([]); // no live roots: removes every remaining object and chunk
```

## Internals

### How content is cut into chunks

```
bytes ──> Gear rolling hash ──> cut where low bits are zero ──> chunks (min..max bytes)
            (restarts at every cut)        (stricter mask below avg, looser above)
```

The chunker is a minimal FastCDC: a Gear rolling fingerprint that restarts at each boundary, with
normalized masks that pull chunk sizes toward `avg`. Because a cut depends only on the bytes since
the previous cut, boundaries re-synchronise shortly after an insert or delete, and the chunks
around the edit keep their ids. Content strictly smaller than `chunkThreshold` is stored as one
chunk; chunking small files only adds manifest overhead.

### Memory stays bounded

`put` reads the input one chunk at a time. The whole-object id is computed by re-streaming the
stored chunks in order through `hashContent`, so an object is never held in memory in one piece.
`read` with a range skips chunks outside the range.

### Ids are opaque

Object and chunk ids are whatever `hashContent` returns, including any prefix such as `sha256:`.
The store commits to no algorithm. Use the same `hashContent` for every store that exchanges
chunks; ids from different hashes never match.

### Liveness is external

There are no reference counts. `remove(id)` deletes only the manifest: chunks stay, because
another object may share them. `gc(liveRoots)` marks every chunk reachable from the manifests you
list and deletes all other manifests and chunks. Anything not in `liveRoots` is removed, so pass
the complete set of objects you still need.

### Dependencies

`@statewalker/webrun-storage`, for the `BlobStore` type. `@statewalker/webrun-files` is declared in
`package.json` but not imported by the sources. The chunker and manifest format are in-package. No runtime dependencies.

## License

MIT
