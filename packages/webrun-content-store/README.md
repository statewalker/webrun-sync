# @statewalker/webrun-content-store

Domain-neutral, content-addressed large-object store with content-defined chunking and deduplication.

## Overview

`webrun-content-store` stores large byte streams as deduplicated, content-defined chunks over the `@statewalker/webrun-storage` `BlobStore`. Object and chunk ids are computed by a `hashContent` function you pass in, and every id is treated as an opaque string (it carries whatever prefix your hasher produces). Content below a size threshold is stored as one blob without chunking.

It backs the chunk transfer in `@statewalker/webrun-content-transfer` ("which chunks do you have, send only the missing ones, assemble") and the LFS object storage in `@statewalker/vcs-transport-lfs` and `@statewalker/vcs-transport-xet`. It knows nothing of git, LFS, commits or sync.

## Installation

```bash
pnpm add @statewalker/webrun-content-store @statewalker/webrun-storage
```

No peer dependencies. You need a `BlobStore` implementation, for example from `@statewalker/webrun-storage`.

## Entry points

| Import | Contents |
| --- | --- |
| `@statewalker/webrun-content-store` | `createContentStore` and the types listed under [API](#api). ESM only, environment-neutral (browser, Node, workers). |

The package ships built JS and `.d.ts` in `dist/` and the TypeScript sources in `src/`.

## Quick start

```typescript
import { createHash } from "node:crypto";
import { memBlobStore } from "@statewalker/webrun-storage";
import { createContentStore } from "@statewalker/webrun-content-store";

async function sha256(bytes: AsyncIterable<Uint8Array>): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of bytes) h.update(chunk);
  return `sha256:${h.digest("hex")}`;
}

const store = createContentStore(
  { chunks: memBlobStore(), manifests: memBlobStore(), hashContent: sha256 },
  { chunkThreshold: 64, cdc: { min: 64, avg: 256, max: 1024 } },
);

async function* streamOf(bytes: Uint8Array) {
  yield bytes;
}
const payload = new Uint8Array(10_000).map((_, i) => i % 251);

// Object level: chunk and hash in one bounded-memory pass.
const d = await store.put(streamOf(payload)); // ObjectDescriptor { id, size, chunks }
const whole = store.read(d.id); // reassembled stream
const slice = store.read(d.id, { offset: 3000, length: 2500 }); // range across chunks

// Chunk level: find out what is missing, move only that.
const missing = await store.hasChunks(d.chunks.map((c) => c.id)); // ids NOT present
await store.gc([d.id]); // remove everything not reachable from the live roots
```

## API

`createContentStore(deps, opts?)`:

- `deps`: `{ chunks: BlobStore, manifests: BlobStore, hashContent }`.
- `opts`: `{ chunkThreshold?, cdc? }`. Defaults: `chunkThreshold` 4096 bytes; `cdc` `{ min: 2048, avg: 8192, max: 32768 }`. Content strictly below the threshold is stored as one blob.

The returned `ContentStore`:

- Object level: `put(content): Promise<ObjectDescriptor>`, `read(id, range?)` (`{ offset?, length? }`; empty stream if absent), `has(id)`, `getManifest(id)`, `remove(id)`.
- Chunk level: `hasChunks(ids): Promise<ChunkId[]>` (returns the ids that are **not** present), `putChunk(id, bytes)`, `getChunk(id)`.
- Maintenance: `gc(liveRoots): Promise<{ removedObjects, removedChunks }>`, a mark-sweep from roots you supply.

Types: `ContentStore`, `ContentStoreDeps`, `ContentStoreOptions`, `ObjectDescriptor`, `ChunkRef`, `ObjectId`, `ChunkId`, `CdcParams`, `ByteStream`.

## Notes

- **Injected hash, opaque ids.** The store commits to no algorithm.
- **Content-defined chunking** keeps deduplication working when bytes are inserted or shifted.
- **Immutable, no refcounts.** Chunks and objects never change. `gc(liveRoots)` walks objects to chunks from your roots and removes the rest.

## License

MIT
