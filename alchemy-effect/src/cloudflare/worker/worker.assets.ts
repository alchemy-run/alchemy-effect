// todo: make this a binding

import * as FileSystem from "@effect/platform/FileSystem";
import * as Path from "@effect/platform/Path";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import Ignore from "ignore";
import crypto from "node:crypto";
import { Cloudflare } from "../api.ts";

export declare namespace WorkerAssets {
  export interface Result {
    manifest: WorkerAssets.Manifest;
    _headers: string;
    _redirects: string;
  }

  export interface Manifest {
    [name: string]: {
      hash: string;
      size: number;
    };
  }
}

const MAX_ASSET_SIZE = 1024 * 1024 * 25; // 25MB

// todo: improve errors
export class AssetsError extends Data.TaggedError("AssetsError")<{
  message: string;
}> {}

export class WorkerAssets extends Effect.Service<WorkerAssets>()(
  "WorkerAssets",
  {
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const cloudflare = yield* Cloudflare;

      const maybeReadString = Effect.fn(function* (file: string) {
        return yield* fs
          .readFileString(file)
          .pipe(
            Effect.mapError((error) =>
              error._tag === "SystemError" && error.reason === "NotFound"
                ? Effect.succeed(undefined)
                : Effect.fail(error),
            ),
          );
      });

      const read = Effect.fn(function* (directory: string) {
        const [files, ignore, _headers, _redirects] = yield* Effect.all([
          // todo: glob might be more efficient
          fs.readDirectory(directory, { recursive: true }),
          maybeReadString(path.join(directory, ".assetsignore")),
          maybeReadString(path.join(directory, "_headers")),
          maybeReadString(path.join(directory, "_redirects")),
        ]);
        const matcher = yield* Effect.sync(() => {
          return Ignore().add([ignore, "_headers", "_redirects"]);
        });
        const manifest: Record<string, { hash: string; size: number }> = {};
        yield* Effect.forEach(
          files,
          Effect.fn(function* (name) {
            const file = path.join(directory, name);
            if (matcher.ignores(file)) return;
            const stat = yield* fs.stat(file);
            if (stat.type !== "File") return;
            const hash = yield* fs
              .readFile(file)
              .pipe(
                Effect.map((content) =>
                  crypto.createHash("sha256").update(content).digest("hex"),
                ),
              );
            const size = Number(stat.size);
            if (size > MAX_ASSET_SIZE) {
              return yield* new AssetsError({
                message: `Asset ${name} is too large (the maximum size is ${MAX_ASSET_SIZE / 1024 / 1024} MB; this asset is ${size / 1024 / 1024} MB)`,
              });
            }
            manifest[name] = { hash, size };
          }),
          { concurrency: "unbounded" },
        );
        return { manifest, _headers, _redirects } satisfies WorkerAssets.Result;
      });

      const upload = Effect.fn(function* (
        workerId: string,
        accountId: string,
        directory: string,
        manifest: WorkerAssets.Manifest,
      ) {
        const session = yield* cloudflare.workers.scripts.assets.upload.create(
          workerId,
          {
            account_id: accountId,
            manifest,
          },
        );
        if (!session.buckets?.length) {
          return { jwt: session.jwt };
        }
        const assetsByHash = new Map<string, string>();
        for (const [name, { hash }] of Object.entries(manifest)) {
          assetsByHash.set(hash, name);
        }
        let jwt: string | undefined;
        yield* Effect.forEach(
          session.buckets,
          Effect.fn(function* (bucket) {
            const body: Record<string, string> = {};
            yield* Effect.forEach(
              bucket,
              Effect.fn(function* (hash) {
                const name = assetsByHash.get(hash);
                if (!name) {
                  return yield* new AssetsError({
                    message: `Asset ${hash} not found in manifest`,
                  });
                }
                const file = yield* fs.readFile(path.join(directory, name));
                body[hash] = Buffer.from(file).toString("base64");
              }),
            );
            const result = yield* cloudflare.workers.assets.upload.create(
              {
                account_id: accountId,
                base64: true,
                body,
              },
              {
                headers: {
                  Authorization: `Bearer ${session.jwt}`,
                },
              },
            );
            if (result.jwt) {
              jwt = result.jwt;
            }
          }),
        );
        return { jwt };
      });

      return {
        read,
        upload,
      };
    }),
  },
) {}
