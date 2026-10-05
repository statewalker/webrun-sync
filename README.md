# webrun-sync

A pnpm workspace of five TypeScript packages that store, move, merge and synchronise bytes and
file trees over the `FilesApi` from `@statewalker/webrun-files`. None of them know about git,
commits or refs; they are the domain-neutral layer a VCS or a sync tool builds on.

## Two stacks, one seam

```
                 @statewalker/webrun-files (FilesApi)
                    |                          |
   webrun-storage (BlobStore, KvStore)    webrun-merge (3-way merge of FilesApi trees)
                    |                          |
   webrun-content-store (chunked objects) webrun-files-sync (copy/sync/bisync/move/check)
                    |
   webrun-content-transfer (move missing chunks over @statewalker/webrun-streams)
```

| Package | What it does |
| --- | --- |
| [`@statewalker/webrun-storage`](packages/webrun-storage) | Immutable `BlobStore` and mutable `KvStore` with compare-and-set, in memory or over a `FilesApi`. |
| [`@statewalker/webrun-content-store`](packages/webrun-content-store) | Content-addressed large-object store with content-defined chunking, over a `BlobStore`. |
| [`@statewalker/webrun-content-transfer`](packages/webrun-content-transfer) | Resumable transfer of only the missing chunks between two content stores, locally or over a duplex stream. |
| [`@statewalker/webrun-merge`](packages/webrun-merge) | Three-way merge of `FilesApi` trees; returns operations and conflicts, never writes. |
| [`@statewalker/webrun-files-sync`](packages/webrun-files-sync) | rclone-like copy / sync / bisync / move / check between two `FilesApi` endpoints. |

All five are public on npm under the same names. Each ships built ESM and `.d.ts` in `dist/` plus
the TypeScript sources in `src/`.

## How to work on it

1. Use Node.js 24 and enable corepack: `corepack enable`. pnpm 10.16.1 is pinned in
   `packageManager`.
2. `pnpm install`
3. `pnpm build`: builds every package in dependency order (rolldown for JS, `tsc` for
   declarations).
4. `pnpm test`, `pnpm typecheck`, `pnpm lint:check`, `pnpm format:check`.

Work on one package with a filter, for example `pnpm --filter @statewalker/webrun-merge test`.

## Why it is shaped this way

- **The packages know nothing about git.** Ids, hashes and file trees are opaque or injected
  (`hashContent` is a parameter everywhere). That lets a git engine and a plain file-sync engine
  share the same storage, chunking, transfer and merge code without importing each other.
- **Two small persistence primitives.** Every backend only has to implement an immutable blob
  store and a key-value store with compare-and-set. Chunking, manifests and packing live above
  that line, so a new backend stays small.
- **Plan, then execute.** Merge returns operations instead of writing; sync returns a
  serializable plan before touching anything. Both can be inspected, tested and dry-run.
- Internal dependencies use `workspace:^`; external ones come from the pnpm catalog in
  `pnpm-workspace.yaml` (`catalog:`), so one version of each dependency serves all packages.

## What will surprise you

- **`pnpm typecheck` on a fresh clone fails until you build.** Each package's `tsc` resolves its
  sibling packages through their `exports`, which point at `dist/`. Without a build you get
  `TS2307: Cannot find module '@statewalker/webrun-content-store' or its corresponding type
  declarations`. Run `pnpm build` first.
- **Tests do not need a build.** Each `vitest.config.ts` aliases sibling packages to their
  `src/index.ts`, so `pnpm test` always runs against the current sources.
- **`pnpm lint` and `pnpm format` rewrite files.** Use `lint:check` and `format:check` to only
  report.

## Reference

### Commands

| Command | What it runs |
| --- | --- |
| `pnpm build` | `pnpm -r run build` |
| `pnpm test` | `pnpm -r run test` (vitest) |
| `pnpm typecheck` | `pnpm -r run typecheck` (`tsc --noEmit`) |
| `pnpm lint` / `pnpm lint:check` | `biome check --write .` / `biome check .` |
| `pnpm format` / `pnpm format:check` | `biome format --write .` / `biome format .` |

### CI and releases

CI runs on every pull request and on `main`: frozen install, dependency-reference checks, lint,
format, build, typecheck, tests, and checks that every export target exists, that `dist/` imports
only declared dependencies and that packed manifests contain no `workspace:` or `catalog:`
specifiers. Packages are published to npm from CI with changesets and npm provenance.

### Files

| Path | Contents |
| --- | --- |
| `packages/*` | The five packages. |
| `pnpm-workspace.yaml` | Workspace globs and the dependency catalog. |
| `biome.json` | Lint and format configuration for the whole repository. |
| `tsconfig.base.json` | Shared compiler options. |
| `LICENSE` | MIT. |
