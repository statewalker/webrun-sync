# @statewalker/webrun-storage

## What it is

A small byte-persistence layer with two primitives: an immutable `BlobStore` keyed by a
caller-supplied id, and a mutable `KvStore` with atomic compare-and-set. A `RefStore` facade
stores string ids on top of a `KvStore`. Adapters are included for memory and for any
`FilesApi` from `@statewalker/webrun-files`.

## Why it exists

Higher layers (a chunked content store, a git object store, ref tables) all need the same two
things from a backend: write an immutable blob under a known id, and update a pointer atomically.
This package defines exactly that contract and nothing more. A new backend (SQL, KV, cloud
object storage) implements two interfaces, and every layer above works on it unchanged.

## How to use

```bash
pnpm add @statewalker/webrun-storage
```

| Import | Contents |
| --- | --- |
| `@statewalker/webrun-storage` | `memBlobStore`, `memKvStore`, `filesBlobStore`, `refStore`, and the types `BlobStore`, `KvStore`, `RefStore`, `ObjectStore`, `ByteStream`, `FilesBlobStoreOptions`. ESM, runs in browsers, Node and workers. |

`BlobStore`:

- `put(id, bytes, opts?)`: stores a byte stream. Re-putting the same id is idempotent.
  `opts.verify(bytes)` re-derives the id; on mismatch `put` rejects and stores nothing.
- `get(id, range?)`: byte stream; `range` is `{ start?, end? }` with `end` exclusive. An absent id
  yields an empty stream.
- `has(id)`, `remove(id)` (resolves `false` if absent), `size(id)` (`-1` if absent),
  `list(prefix?)`.

`KvStore`: `get`, `put`, `remove`, `list(prefix?)`, and `cas(key, expected, next)`, which writes
and returns `true` only when the current value equals `expected` byte for byte. `expected ===
undefined` means "must not exist"; `next === undefined` deletes.

`RefStore`: `read(name)`, `compareAndSet(name, expected, next)`, `list(prefix?)`, all with string
ids. `ObjectStore` is an alias of `BlobStore`.

## Examples

Blobs in memory and over a `FilesApi`:

```typescript
import { MemFilesApi } from "@statewalker/webrun-files-mem";
import { filesBlobStore, memBlobStore } from "@statewalker/webrun-storage";

async function* streamOf(...parts: string[]) {
  for (const p of parts) yield new TextEncoder().encode(p);
}

const blobs = memBlobStore();
await blobs.put("a1b2c3", streamOf("hello ", "world")); // the caller owns the id
await blobs.size("a1b2c3"); // 11
const tail = blobs.get("a1b2c3", { start: 6 }); // "world"

const onDisk = filesBlobStore(new MemFilesApi(), { root: "/objects" });
await onDisk.put("a1b2c3", streamOf("hello")); // stored at /objects/a1/b2c3
```

Atomic pointer updates:

```typescript
import { memKvStore, refStore } from "@statewalker/webrun-storage";

const refs = refStore(memKvStore());
await refs.compareAndSet("refs/heads/main", undefined, "commit-1"); // true: created
await refs.compareAndSet("refs/heads/main", "commit-0", "commit-2"); // false: lost the race
await refs.read("refs/heads/main"); // "commit-1"
```

## Internals

### Ids belong to the caller

`put` never hashes. A git store passes git object ids, a chunk store passes its own chunk hashes.
The package therefore depends on no hash library and works with any id scheme. Integrity checking
is opt-in through `verify`; a mismatch fails with
`blob id mismatch: supplied "<id>", verify computed "<computed>"`.

### Compare-and-set is part of the contract

`cas` is a required method, not an optional capability, so `RefStore` can always offer atomic
updates without checking what the backend supports. The in-memory adapter is atomic because
JavaScript runs it in one turn.

### One backend object per blob

`filesBlobStore` writes each blob to its own file, sharded like git's loose objects:
`<root>/<first two chars>/<rest>`. Ids shorter than three characters produce odd paths; use
hash-like ids. Packing and chunk grouping are left to the layers above.

### Ranged reads

`get(id, { start, end })` matches the usual "inclusive start, exclusive end" slice convention, so
random access into pack files and large blobs needs no full read.

### Dependencies

Only `@statewalker/webrun-files`, for the `FilesApi` type used by `filesBlobStore`. No runtime
dependencies.

## License

MIT
