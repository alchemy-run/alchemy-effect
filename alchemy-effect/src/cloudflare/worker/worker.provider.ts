import type { Workers } from "cloudflare/resources/workers/beta.mjs";
import * as Effect from "effect/Effect";
import { App } from "../../app.ts";
import {
  Cloudflare,
  CloudflareAccountId,
  notFoundToUndefined,
} from "../api.ts";
import { WorkerAssets } from "./worker.assets.ts";
import { bundle } from "./worker.bundle.ts";
import { Worker, type WorkerAttr, type WorkerProps } from "./worker.ts";

export const workerProvider = () =>
  Worker.provider.effect(
    Effect.gen(function* () {
      const app = yield* App;
      const api = yield* Cloudflare;
      const accountId = yield* CloudflareAccountId;
      const workerAssets = yield* WorkerAssets;

      const createWorkerName = (id: string, props: WorkerProps | undefined) =>
        props?.name ?? `${app.name}-${id}-${app.stage}`;

      const mapResult = (
        worker: Workers.Worker,
        accountId: string,
      ): WorkerAttr<WorkerProps> => ({
        id: worker.id,
        name: worker.name,
        logpush: worker.logpush,
        observability: worker.observability,
        subdomain: worker.subdomain,
        tags: worker.tags,
        accountId,
      });

      const prepareAssets = Effect.fn(function* (
        workerId: string,
        props: WorkerProps,
      ) {
        if (!props.assets) return;
        const result = yield* workerAssets.read(props.assets.directory);
        const { jwt } = yield* workerAssets.upload(
          workerId,
          accountId,
          props.assets!.directory,
          result.manifest,
        );
        return {
          config: props.assets?.config,
          jwt,
          _headers: result._headers,
          _redirects: result._redirects,
        };
      });

      const createVersion = Effect.fn(function* (
        workerId: string,
        accountId: string,
        props: WorkerProps,
        bindings: Array<Worker["binding"]>,
      ) {
        const [assets, { code, hash }] = yield* Effect.all([
          prepareAssets(workerId, props),
          bundle({
            entryPoints: [props.main],
            bundle: true,
            format: "esm",
          }),
        ]);
        const modules: Workers.Version.Module[] = [];
        modules.push({
          name: "worker.js",
          content_base64: Buffer.from(code).toString("base64"),
          content_type: "application/javascript",
        });
        if (assets?._headers) {
          modules.push({
            name: "_headers",
            content_base64: Buffer.from(assets._headers).toString("base64"),
            content_type: "text/plain",
          });
        }
        if (assets?._redirects) {
          modules.push({
            name: "_redirects",
            content_base64: Buffer.from(assets._redirects).toString("base64"),
            content_type: "text/plain",
          });
        }
        return yield* api.workers.beta.workers.versions.create(workerId, {
          account_id: accountId,
          compatibility_date: props.compatibility?.date,
          compatibility_flags: props.compatibility?.flags,
          limits: props.limits,
          placement: props.placement,
          bindings: bindings.flatMap((binding) => binding.bindings),
          main_module: "worker.js",
          modules,
          migrations: undefined,
          annotations: undefined,
          assets: {
            config: assets?.config,
            jwt: assets?.jwt,
          },
        });
      });

      return {
        diff: ({ output }) =>
          Effect.sync(() => {
            if (output.accountId !== accountId) {
              return { action: "replace" };
            }
            // todo: diff
            return { action: "noop" };
          }),
        read: Effect.fn(function* ({ id, olds, output }) {
          const workerId = output?.id ?? createWorkerName(id, olds);
          const workerAccountId = output?.accountId ?? accountId;
          return yield* api.workers.beta.workers
            .get(workerId, {
              account_id: workerAccountId,
            })
            .pipe(
              Effect.map((worker) => mapResult(worker, workerAccountId)),
              notFoundToUndefined(),
            );
        }),
        create: Effect.fn(function* ({ id, news, bindings }) {
          const worker = yield* api.workers.beta.workers.create({
            account_id: accountId,
            name: createWorkerName(id, news),
            logpush: news.logpush,
            observability: news.observability,
            subdomain: news.subdomain,
            tags: news.tags,
            tail_consumers: [], // todo
          });
          const version = yield* createVersion(
            worker.id,
            accountId,
            news,
            bindings,
          );
          return mapResult(worker, accountId);
        }),
        update: Effect.fn(function* ({ id, news, output, bindings }) {
          const worker = yield* api.workers.beta.workers.update(output.id, {
            account_id: output.accountId,
            name: createWorkerName(id, news),
            logpush: news.logpush,
            observability: news.observability,
            subdomain: news.subdomain,
            tags: news.tags,
            tail_consumers: [], // todo
          });
          const version = yield* createVersion(
            worker.id,
            output.accountId,
            news,
            bindings,
          );
          return mapResult(worker, output.accountId);
        }),
        delete: Effect.fn(function* ({ output }) {
          yield* api.workers.beta.workers
            .delete(output.id, {
              account_id: output.accountId,
            })
            .pipe(notFoundToUndefined());
        }),
      };
    }),
  );
