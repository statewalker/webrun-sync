---
"@statewalker/webrun-content-store": minor
"@statewalker/webrun-content-transfer": minor
"@statewalker/webrun-files-sync": minor
"@statewalker/webrun-merge": minor
"@statewalker/webrun-storage": minor
---

Move to `@statewalker/webrun-files` 0.12 (and `-mem` 0.12 in tests). The dependency range moves from `^0.10.0` to `^0.12.0`, a breaking line: webrun-files 0.12 resolves `..` segments before any filter, guard or mount sees a path, and throws `Path climbs above the root` for a path above the root. Consumers must use webrun-files 0.12 too, so a single copy of the core is installed.

`filesBlobStore` now refuses a blob id that contains `/` or `\`, or whose shard parts are `.` or `..` (`Invalid blob id`): with webrun-files 0.12 resolving `..`, such an id from a remote peer would otherwise write outside the store's `root`.
