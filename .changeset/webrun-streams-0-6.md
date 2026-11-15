---
"@statewalker/webrun-content-transfer": minor
---

Move to `@statewalker/webrun-streams` 0.6. The dependency range moves from `^0.2.0` to `^0.6.0`, a breaking line. The package uses only the `Duplex` type, which is unchanged between 0.2 and 0.6 (`(input: AsyncIterable<Uint8Array> | Iterable<Uint8Array>) => AsyncGenerator<Uint8Array>`), so `remoteStore` and `serveStore` keep their signatures and behaviour. Consumers that wire these into webrun-streams transports should move to webrun-streams 0.6 too, so a single copy is installed.
