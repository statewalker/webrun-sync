# @statewalker/webrun-content-transfer

Resumable, chunk-aware byte mover between two content stores, over the `@statewalker/webrun-streams` duplex.

## Overview

Given the object ids a destination needs, `transfer` copies only the chunks the destination is **missing** from a source `ContentStore` (see `@statewalker/webrun-content-store`) to a destination store. Either side can be remote: `serveStore` exposes a store as a `webrun-streams` `Duplex` handler, and `remoteStore` wraps a `Duplex` as a store proxy (upload: remote `to`; download: remote `from`). Every received chunk is re-hashed and checked against its id before it is written. A serializable checkpoint lets an interrupted transfer resume.

`chunkTransfer` adapts the mover to the `Transfer` seam of `@statewalker/webrun-files-sync`. `@statewalker/vcs-transport-xet` wraps it as a Git LFS custom transfer agent. The package knows nothing of git, LFS or sync.

## Installation

```bash
pnpm add @statewalker/webrun-content-transfer @statewalker/webrun-content-store
```

No peer dependencies. Depends on `@statewalker/webrun-content-store`, `@statewalker/webrun-streams` and `@statewalker/webrun-files`.

## Entry points

| Import | Contents |
| --- | --- |
| `@statewalker/webrun-content-transfer` | Everything listed under [API](#api). ESM only, environment-neutral (browser, Node, workers). |

The package ships built JS and `.d.ts` in `dist/` and the TypeScript sources in `src/`.

## Quick start

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
const mkStore = () =>
  createContentStore({ chunks: memBlobStore(), manifests: memBlobStore(), hashContent: sha256 });

async function* streamOf(b: Uint8Array) {
  yield b;
}

const from = mkStore();
const to = mkStore();
const { id } = await from.put(streamOf(new Uint8Array(100_000).map((_, i) => i % 251)));

// Move only the chunks `to` is missing; each one is re-hashed and verified.
for await (const event of transfer([id], from, to, { hashContent: sha256 })) {
  if (event.type === "object-done") console.log("done", event.objectId);
}
// to.read(id) now yields the same bytes.
```

Over a duplex (here both ends run in the same process):

```typescript
import { remoteStore, serveStore, transfer } from "@statewalker/webrun-content-transfer";

const handler = serveStore(serverStore); // server side: a Duplex over a ContentStore
const remote = remoteStore(handler); // client side: an AssemblingStore proxy over a Duplex

for await (const _ of transfer([id], from, remote, { hashContent: sha256 })) {
  // upload to the remote store
}
```

In a real deployment, pass `remoteStore` a `Duplex` that reaches the server through a `webrun-streams` transport.

## API

- **`transfer(objectIds, from, to, opts?): AsyncGenerator<TransferEvent>`**: negotiates missing chunks per object, streams them, verifies by re-hash, and assembles. Events: `resumed`, `negotiated`, `chunk-sent`, `object-done`.
- **`remoteStore(call: Duplex): AssemblingStore`**: client-side `ContentStore` proxy over a duplex; adds `putManifest` and `capabilities`.
- **`serveStore(store): Duplex`**: server-side handler exposing a `ContentStore` over a duplex.
- **`chunkTransfer(local, remote): FileTransfer`**: an object structurally compatible with the `Transfer` of `@statewalker/webrun-files-sync`. For `copy` and `update` actions it ingests the source file into `local`, moves missing chunks to `remote`, and writes the reassembled bytes to the destination.

`TransferOptions`: `limits?` (`TransferLimits`: `concurrency`, `maxBufferedBytes`, `batchSize`), `checkpoint?` (`TransferCheckpoint`: `objectIds`, `done`, `pending`), `hashContent?`.

Types: `AssemblingStore`, `Capabilities`, `HashContent`, `TransferCheckpoint`, `TransferEvent`, `TransferLimits`, `TransferOptions`, `FileTransfer`, `FileSyncAction`.

## Notes

- **Integrity by re-hash.** The re-hash of a received chunk must equal its id (both stores use the same `hashContent`), or the transfer fails.
- **Resumable and bounded.** A `TransferCheckpoint` resumes an interrupted transfer after checking that the source still holds every object. Memory is bounded by `TransferLimits`.
- **Batched negotiation.** `hasChunks` calls are batched. The `remoteStore` proxy can `putManifest`, so assembling on the remote side costs only the manifest.

## License

MIT
