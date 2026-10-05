# webrun-sync

Domain-neutral storage, transfer, merge and file-sync building blocks over the
[`@statewalker/webrun-files`](https://github.com/statewalker/webrun-files) `FilesApi`.
None of these packages know about git. The VCS in
[statewalker/webrun-vcs](https://github.com/statewalker/webrun-vcs) is built on top of them.

The packages were extracted from webrun-vcs with their history.

## Packages

| Package | Description | npm |
| --- | --- | --- |
| [`@statewalker/webrun-storage`](packages/webrun-storage) | Byte-persistence seam: immutable `BlobStore`, mutable `KvStore` with compare-and-set, `RefStore` facade. | [npm](https://www.npmjs.com/package/@statewalker/webrun-storage) |
| [`@statewalker/webrun-content-store`](packages/webrun-content-store) | Content-addressed large-object store with content-defined chunking, over a `BlobStore`. | [npm](https://www.npmjs.com/package/@statewalker/webrun-content-store) |
| [`@statewalker/webrun-content-transfer`](packages/webrun-content-transfer) | Resumable transfer of missing chunks between two content stores, over `webrun-streams`. | [npm](https://www.npmjs.com/package/@statewalker/webrun-content-transfer) |
| [`@statewalker/webrun-merge`](packages/webrun-merge) | Three-way merge/diff of `FilesApi` trees; returns operations and conflicts, never writes. | [npm](https://www.npmjs.com/package/@statewalker/webrun-merge) |
| [`@statewalker/webrun-files-sync`](packages/webrun-files-sync) | rclone-like copy / sync / bisync / move / check between two `FilesApi` endpoints. | [npm](https://www.npmjs.com/package/@statewalker/webrun-files-sync) |

These packages were previously published as `@statewalker/storage`, `@statewalker/content-store`,
`@statewalker/content-transfer`, `@statewalker/merge-core` and `@statewalker/files-sync`. The old
names are deprecated.

Internal dependencies:

```
webrun-storage  <-  webrun-content-store  <-  webrun-content-transfer
webrun-merge    <-  webrun-files-sync
```

## Related repositories

This repository consumes:

- [statewalker/webrun-files](https://github.com/statewalker/webrun-files): `@statewalker/webrun-files`
  (all packages); `@statewalker/webrun-files-mem` (tests only).
- [statewalker/webrun-wire](https://github.com/statewalker/webrun-wire): `@statewalker/webrun-streams`
  (`webrun-content-transfer`).

It is consumed by [statewalker/webrun-vcs](https://github.com/statewalker/webrun-vcs)
(`vcs-core`, `vcs-transport-adapters`, `vcs-transport-lfs`, `vcs-transport-xet`, `vcs-workspace`).

## Requirements

- Node.js 24
- pnpm 10, through corepack (`corepack enable`). The version is pinned in `packageManager`.

## Development

```sh
pnpm install          # install dependencies
pnpm build            # build all packages (rolldown + tsc declarations)
pnpm test             # run vitest in every package
pnpm typecheck        # tsc --noEmit in every package
pnpm lint             # biome check --write
pnpm lint:check       # biome check, no writes
pnpm format           # biome format --write
pnpm format:check     # biome format, no writes
```

To work on one package: `pnpm --filter @statewalker/webrun-merge test`.

Internal dependencies use `workspace:^`. External dependencies use the pnpm catalog in
`pnpm-workspace.yaml` (`catalog:`).

CI runs the shared workflow from [statewalker/.github](https://github.com/statewalker/.github#readme):
frozen install, dependency-reference checks, lint, format, build, typecheck, tests, and checks on
exports, dist imports and packed manifests.

## Releases

Releases are automatic and use changesets. After CI passes on `main`, a job adds a changeset for
each package whose packed contents differ from the version on npm, and opens a
"chore: version packages" pull request. Merging that pull request publishes to npm with provenance.

To choose the bump or write the changelog entry yourself, add a changeset in your pull request with
`pnpm changeset`. Dependency updates come from Renovate.

Details: [statewalker/.github](https://github.com/statewalker/.github#readme).

## License

MIT. See [LICENSE](LICENSE).
