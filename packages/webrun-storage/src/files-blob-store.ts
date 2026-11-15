import type { FilesApi } from "@statewalker/webrun-files";
import { assertVerified } from "./blob-store.js";
import type { BlobStore, ByteStream } from "./types.js";

export interface FilesBlobStoreOptions {
  /** Directory the sharded blob tree lives under. Defaults to `/`. */
  root?: string;
}

const isDotSegment = (segment: string): boolean => segment === "." || segment === "..";

/**
 * {@link BlobStore} backed by a {@link FilesApi}. Ids map to git-style sharded
 * paths (`ab/cdef…`) so a large id space never lands in one flat directory.
 */
export function filesBlobStore(files: FilesApi, opts?: FilesBlobStoreOptions): BlobStore {
  const base = (opts?.root ?? "/").replace(/\/+$/, "");

  const pathFor = (id: string): string => {
    const shard = id.slice(0, 2);
    const rest = id.slice(2);
    // webrun-files resolves `..` before any mount or guard sees the path, so an
    // id carrying a separator or a dot segment would land outside `root`. Ids
    // come from remote peers (content-transfer's serve-store), so refuse them.
    if (id === "" || /[/\\]/.test(id) || isDotSegment(shard) || isDotSegment(rest)) {
      throw new Error(`Invalid blob id: ${JSON.stringify(id)}`);
    }
    return `${base}/${shard}/${rest}`;
  };
  const idFrom = (relative: string): string => relative.replace("/", "");

  return {
    async put(id, bytes, opts) {
      const path = pathFor(id);
      if (opts?.verify) {
        // Verify needs the bytes replayed to the caller's hash, so buffer the
        // chunk list (not one contiguous concat), check, then write.
        const chunks: Uint8Array[] = [];
        for await (const chunk of bytes) chunks.push(chunk);
        await assertVerified(id, chunks, opts.verify);
        await files.write(path, chunks);
      } else {
        // No verify: pass the stream straight through — the backend drives
        // iteration, so nothing is buffered up front.
        await files.write(path, bytes);
      }
    },
    get(id, range): ByteStream {
      if (!range) return files.read(pathFor(id));
      // FilesApi.read takes {start,length}; our range is {start,end} with end
      // exclusive — translate length = end - start (undefined ⇒ read to end).
      const start = range.start ?? 0;
      const length = range.end !== undefined ? range.end - start : undefined;
      return files.read(pathFor(id), { start, length });
    },
    async has(id) {
      return files.exists(pathFor(id));
    },
    async size(id) {
      const stats = await files.stats(pathFor(id));
      return stats?.kind === "file" ? stats.size : -1;
    },
    async remove(id) {
      return files.remove(pathFor(id));
    },
    async *list(prefix) {
      const rootPath = base === "" ? "/" : base;
      const cut = rootPath === "/" ? 1 : rootPath.length + 1;
      for await (const info of files.list(rootPath, { recursive: true })) {
        if (info.kind !== "file") continue;
        const id = idFrom(info.path.slice(cut));
        if (prefix === undefined || id.startsWith(prefix)) yield id;
      }
    },
  };
}
