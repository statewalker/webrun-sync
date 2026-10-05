# @statewalker/webrun-content-transfer

## What it is

Moves objects between two content stores (`ContentStore` from `@statewalker/webrun-content-store`)
by sending only the chunks the destination does not have. Either store can be remote: one side
serves its store as a `Duplex` from `@statewalker/webrun-streams`, the other wraps a `Duplex` as a
store proxy.

## Why it exists

Chunked storage only saves bandwidth if the transfer asks first which chunks are missing. This
package does that negotiation in batches, sends the missing chunks through a bounded worker pool,
re-hashes each one on arrival, and registers the object on the destination. Because it talks to
stores through the `ContentStore` interface and to peers through a plain `Duplex`, it works the
same in one process, over WebSocket, WebRTC or HTTP streams. `chunkTransfer` plugs it into
`@statewalker/webrun-files-sync` so file copies move only changed chunks.

## How to use

```bash
pnpm add @statewalker/webrun-content-transfer @statewalker/webrun-content-store
```

| Import | Contents |
| --- | --- |
| `@statewalker/webrun-content-transfer` | `transfer`, `remoteStore`, `serveStore`, `chunkTransfer`, and the types `TransferOptions`, `TransferLimits`, `TransferCheckpoint`, `TransferEvent`, `HashContent`, `AssemblingStore`, `Capabilities`, `FileTransfer`, `FileSyncAction`. ESM, runs in browsers, Node and workers. |

- `transfer(objectIds, from, to, opts?)`: async generator of events: `resumed`, `negotiated`
  (`objects`, `chunks`, `missing`), `chunk-sent` (`chunkId`, `size`), `object-done` (`objectId`).
  Drain it to run the transfer.
- `serveStore(store)`: returns a `Duplex` handler that serves a `ContentStore`.
- `remoteStore(call)`: wraps a `Duplex` as an `AssemblingStore` (a `ContentStore` with
  `putManifest` and `capabilities`).
- `chunkTransfer(local, remote)`: a `Transfer` for `@statewalker/webrun-files-sync`. For each
  copied file it stores the source in `local`, transfers missing chunks to `remote`, and writes the
  file from `remote` to the destination.

`TransferOptions`: `hashContent?` (enables per-chunk verification), `limits?`
(`concurrency`, default 4; `maxBufferedBytes`, default 8 MiB; `batchSize`, default 256), and
`checkpoint?`.

## Examples

Between two local stores:

```typescript
import { createHash } from "node:crypto";
import { memBlobStore } from "@statewalker/webrun-storage";
import { createContentStore } from "@statewalker/webrun-content-store";
import { transfer } from "@statewalker/webrun-content-transfer";

async function sha256(bytes: AsyncIterable<Uint8Array>): Promise<string> {
  const h = createHash("sha256");
  for await (const chunk of bytes) h.update(chunk);
  return `sha256:${h.digest("hex")}`;
}
async function* streamOf(b: Uint8Array) {
  yield b;
}
const mkStore = () =>
  createContentStore({ chunks: memBlobStore(), manifests: memBlobStore(), hashContent: sha256 });

const from = mkStore();
const to = mkStore();
const { id } = await from.put(streamOf(new Uint8Array(100_000).map((_, i) => (i * 7919) % 251)));

for await (const event of transfer([id], from, to, { hashContent: sha256 })) {
  if (event.type === "negotiated") console.log(`${event.missing} of ${event.chunks} chunks to send`);
}
// to.read(id) now yields the same bytes.
```

To a store behind a duplex (here served in the same process):

```typescript
import { remoteStore, serveStore, transfer } from "@statewalker/webrun-content-transfer";

const remote = remoteStore(serveStore(mkStore()));
for await (const _ of transfer([id], from, remote, { hashContent: sha256 })) {
}
```

In a real deployment, the server passes `serveStore(store)` to its `webrun-streams` transport and
the client passes the transport's `Duplex` to `remoteStore`.

Inside a file sync:

```typescript
import { execute, plan } from "@statewalker/webrun-files-sync";
import { chunkTransfer } from "@statewalker/webrun-content-transfer";

const opts = { hashContent: sha256, transfer: chunkTransfer(mkStore(), mkStore()) };
for await (const _ of execute(await plan(a, b, "copy", opts), a, b, opts)) {
}
```

## Internals

### One transfer, four steps

```
from.getManifest(id) for each object ──> union of chunk ids
        │
        ▼
to.hasChunks(batch of 256) ──> missing chunk list          (negotiated)
        │
        ▼
N workers: from.getChunk ─> re-hash ─> to.putChunk          (chunk-sent)
        │
        ▼
register each manifest on the destination                   (object-done)
```

Negotiation is batched, so N chunk ids cost `ceil(N / batchSize)` requests instead of N. The worker
pool is capped by `concurrency` and by `maxBufferedBytes` of chunk data in flight.

### Assembling on the remote side costs only the manifest

When the destination is a `remoteStore`, the last step sends the manifest with `putManifest`; the
server assembles the object from chunks it already holds. Against a local store, the object is
registered from its chunks directly.

### The wire format

Each call is one request and one response. A message is a 4-byte big-endian header length, a JSON
header, then the body bytes. Operations: `capabilities`, `getManifest`, `hasChunks`, `getChunk`,
`putChunk`, `putManifest`. The server reports protocol `content-transfer/1`.

### Resuming is re-running

The destination's own chunk set is the resume point: calling `transfer` again re-negotiates and
sends only what is still missing. A `checkpoint` is optional; when given, the generator first
emits `{ type: "resumed", done }` with the number of chunks in `checkpoint.done`. The source is
always re-checked for every requested object.

### What fails, and how it looks

- Without `hashContent` in the options, chunks are **not** verified. With it, a corrupted chunk
  stops the transfer with `content-transfer: integrity check failed for chunk <id> (re-hash <hash>)`
  and the object is not registered. Both stores must use the same hash.
- A requested object the source does not have:
  `content-transfer: source is missing object <id>`.
- A `remoteStore` proxy supports only the chunk-level and manifest operations. Calling `put`,
  `has`, `read`, `remove` or `gc` on it throws
  `content-transfer: remote proxy does not support "<name>"`.
- A peer that closes the stream mid-message: `content-transfer protocol: unexpected end of stream`.
- `chunkTransfer` handles only `copy` and `update` actions; anything else throws
  `content-transfer: chunkTransfer only handles copy/update, got <kind>`.
- `chunkTransfer` writes the destination file by reading the object back from `remote`, so
  `remote` must be a full `ContentStore`. A `remoteStore` proxy as `remote` fails with
  `content-transfer: remote proxy does not support "read"`. `chunkTransfer` also calls `transfer`
  without `hashContent`, so its chunks are not re-hashed.

### Dependencies

`@statewalker/webrun-content-store` (store types), `@statewalker/webrun-streams` (the `Duplex`
type) and `@statewalker/webrun-files` (the `FilesApi` type used by `chunkTransfer`). All imports
are type-only; the package has no runtime dependencies.

## License

MIT
