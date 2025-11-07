import * as FileSystem from "@effect/platform/FileSystem";
import * as Path from "@effect/platform/Path";
import type { Workers } from "cloudflare/resources.mjs";
import * as Effect from "effect/Effect";
import crypto from "node:crypto";
import { App } from "../../app";
import type { ScopedPlanStatusSession } from "../../apply";
import { DotAlchemy } from "../../dot-alchemy";
import { ESBuild } from "../../esbuild";
import { CloudflareAccountId, CloudflareApi } from "../api";
import { Assets } from "../assets.provider";
import { Worker, type WorkerAttr, type WorkerProps } from "./worker";

type EffectReturn<T extends (...args: any) => any> =
  ReturnType<T> extends Effect.Effect<infer U, any, any> ? U : never;

export const workerProvider = () =>
  Worker.provider.effect(
    Effect.gen(function* () {
      const app = yield* App;
      const api = yield* CloudflareApi;
      const accountId = yield* CloudflareAccountId;
      const { read, upload } = yield* Assets;
      const { build } = yield* ESBuild;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dotAlchemy = yield* DotAlchemy;

      const getAccountSubdomain = yield* Effect.cachedFunction(
        Effect.fnUntraced(function* (accountId: string) {
          console.log("getAccountSubdomain", accountId);
          const { subdomain } = yield* api.workers.subdomains.get({
            account_id: accountId,
          });
          return subdomain;
        }),
      );

      const setWorkerSubdomain = Effect.fnUntraced(function* (
        name: string,
        enabled: boolean,
      ) {
        yield* api.workers.scripts.subdomain.create(name, {
          account_id: accountId,
          enabled,
        });
      });

      const createWorkerName = (id: string, props: WorkerProps | undefined) =>
        props?.name ?? `${app.name}-${id}-${app.stage}`.toLowerCase();

      const prepareAssets = Effect.fnUntraced(function* (
        assets: WorkerProps["assets"],
      ) {
        if (!assets) return undefined;
        const result = yield* read(
          typeof assets === "string" ? { directory: assets } : assets,
        );
        return {
          ...result,
          hash: yield* sha256(JSON.stringify(result)),
        };
      });

      const prepareBundle = Effect.fnUntraced(function* (
        id: string,
        main: string,
      ) {
        const outfile = path.join(dotAlchemy, "out", `${id}.js`);
        yield* build({
          entryPoints: [path.relative(process.cwd(), main)],
          outfile,
          write: true,
          bundle: true,
          format: "esm",
          sourcemap: false,
          treeShaking: true,
          platform: "node",
        });
        const code = yield* fs.readFileString(outfile);
        return {
          code,
          hash: yield* sha256(code),
        };
      });

      const prepareMetadata = Effect.fnUntraced(function* (props: WorkerProps) {
        const metadata: Workers.ScriptUpdateParams.Metadata = {
          assets: undefined,
          bindings: [],
          body_part: undefined,
          compatibility_date: props.compatibility?.date,
          compatibility_flags: props.compatibility?.flags,
          keep_assets: undefined,
          keep_bindings: undefined,
          limits: props.limits,
          logpush: props.logpush,
          main_module: "worker.js",
          migrations: undefined,
          observability: props.observability ?? {
            enabled: true,
            logs: {
              enabled: true,
              invocation_logs: true,
            },
          },
          placement: props.placement,
          tags: props.tags,
          tail_consumers: undefined,
          usage_model: undefined,
        };
        return {
          metadata,
          hash: yield* sha256(JSON.stringify(metadata)),
        };
      });

      const putWorker = Effect.fnUntraced(function* (
        id: string,
        news: WorkerProps,
        bindings: Worker["binding"][],
        olds: WorkerProps | undefined,
        output: WorkerAttr<WorkerProps> | undefined,
        session: ScopedPlanStatusSession,
      ) {
        const name = createWorkerName(id, news);
        const [assets, bundle, { metadata, hash: metadataHash }] =
          yield* Effect.all([
            prepareAssets(news.assets),
            prepareBundle(id, news.main),
            prepareMetadata(news),
          ]).pipe(Effect.orDie);
        metadata.bindings = bindings.flatMap((binding) => binding.bindings);
        if (assets) {
          if (output?.hash.assets !== assets.hash) {
            const { jwt } = yield* upload(accountId, name, assets, session);
            metadata.assets = {
              jwt,
              config: assets.config,
            };
          } else {
            metadata.assets = {
              config: assets.config,
            };
            metadata.keep_assets = true;
          }
          metadata.bindings.push({
            type: "assets",
            name: "ASSETS",
          });
        }
        yield* session.note("Updating worker...");
        const worker = yield* api.workers.scripts.update(name, {
          account_id: accountId,
          metadata: metadata,
          files: [
            new File([bundle.code], "worker.js", {
              type: "application/javascript+module",
            }),
          ],
        });
        const subdomain = news.subdomain ?? {
          enabled: true,
          previews_enabled: true,
        };
        if (!olds || subdomain.enabled !== olds.subdomain?.enabled) {
          yield* session.note("Updating worker subdomain...");
          yield* setWorkerSubdomain(name, subdomain.enabled !== false);
        }
        return {
          id: worker.id,
          name,
          logpush: worker.logpush,
          observability: metadata.observability,
          subdomain: news.subdomain ?? {
            enabled: true,
            previews_enabled: true,
          },
          url: subdomain.enabled
            ? `https://${name}.${yield* getAccountSubdomain(accountId)}.workers.dev`
            : undefined,
          tags: metadata.tags,
          accountId,
          hash: {
            assets: assets?.hash ?? "",
            bundle: bundle.hash,
            metadata: metadataHash,
          },
        } as WorkerAttr<WorkerProps>;
      });

      return {
        diff: Effect.fnUntraced(function* ({ id, news, output }) {
          if (output.accountId !== accountId) {
            return { action: "replace" };
          }
          const workerName = createWorkerName(id, news);
          if (workerName !== output.name) {
            return { action: "replace" };
          }
          const [assets, bundle, metadata] = yield* Effect.all([
            prepareAssets(news.assets),
            prepareBundle(id, news.main),
            prepareMetadata(news),
            Effect.runFork(
              getAccountSubdomain(accountId).pipe(
                Effect.catchAll(() => Effect.succeed(undefined)),
              ),
            ),
          ]).pipe(Effect.orDie);
          return {
            action:
              bundle.hash === output.hash.bundle &&
              assets?.hash === output.hash.assets &&
              metadata.hash === output.hash.metadata
                ? "noop"
                : "update",
          };
        }),
        create: Effect.fnUntraced(function* ({ id, news, bindings, session }) {
          const name = createWorkerName(id, news);
          const existing = yield* api.workers.beta.workers
            .get(name, {
              account_id: accountId,
            })
            .pipe(Effect.catchTag("NotFound", () => Effect.void));
          if (existing) {
            return yield* Effect.fail(
              new Error(`Worker "${name}" already exists`),
            );
          }
          return yield* putWorker(
            id,
            news,
            bindings,
            undefined,
            undefined,
            session,
          );
        }),
        update: Effect.fnUntraced(function* ({
          id,
          olds,
          news,
          output,
          bindings,
          session,
        }) {
          return yield* putWorker(id, news, bindings, olds, output, session);
        }),
        delete: Effect.fnUntraced(function* ({ output }) {
          yield* api.workers.scripts
            .delete(output.id, {
              account_id: output.accountId,
            })
            .pipe(Effect.catchTag("NotFound", () => Effect.void));
        }),
      };
    }),
  );

const sha256 = Effect.fnUntraced(function* (...parts: crypto.BinaryLike[]) {
  const hash = crypto.createHash("sha256");
  for (const part of parts) {
    hash.update(part);
  }
  return hash.digest("hex");
});
