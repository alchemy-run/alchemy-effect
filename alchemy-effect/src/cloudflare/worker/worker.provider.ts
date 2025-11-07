// import * as FileSystem from "@effect/platform/FileSystem";
// import * as Path from "@effect/platform/Path";
// import type { Workers } from "cloudflare/resources";
// import * as Effect from "effect/Effect";
// import * as Encoding from "effect/Encoding";
// import { App } from "../../app.ts";
// import { DotAlchemy } from "../../dot-alchemy.ts";
// import { ESBuild } from "../../esbuild.ts";
// import { CloudflareAccountId, CloudflareApi } from "../api.ts";
// import { Assets } from "../assets.provider.ts";
// import { Worker, type WorkerAttr, type WorkerProps } from "./worker.ts";

// import crypto from "node:crypto";
// import util from "node:util";

// export const workerProvider = () =>
//   Worker.provider.effect(
//     Effect.gen(function* () {
//       const app = yield* App;
//       const api = yield* CloudflareApi;
//       const accountId = yield* CloudflareAccountId;
//       const path = yield* Path.Path;
//       const fs = yield* FileSystem.FileSystem;
//       const assets = yield* Assets;
//       const dotAlchemy = yield* DotAlchemy;
//       const esbuild = yield* ESBuild;

//       const getAccountSubdomain = yield* Effect.cachedFunction(
//         Effect.fnUntraced(function* (accountId: string) {
//           const { subdomain } = yield* api.workers.subdomains.get({
//             account_id: accountId,
//           });
//           return subdomain;
//         }),
//       );

//       const hashCode = (code: Uint8Array<ArrayBufferLike>) =>
//         Effect.sync(() =>
//           crypto.createHash("sha256").update(code).digest("hex"),
//         );

//       const prepareBundle = Effect.fnUntraced(function* (
//         id: string,
//         main: string,
//       ) {
//         const file = path.relative(process.cwd(), main);
//         const outfile = path.join(
//           dotAlchemy,
//           "out",
//           `${app.name}-${app.stage}-${id}.js`,
//         );
//         yield* esbuild.build({
//           stdin: {
//             contents: `import { default as handler } from "./${file}";\nexport default handler;`,
//             resolveDir: process.cwd(),
//             loader: "ts",
//             sourcefile: "__index.ts",
//           },
//           bundle: true,
//           format: "esm",
//           sourcemap: false,
//           treeShaking: true,
//           write: true,
//           platform: "node",
//           outfile,
//         });
//         const code = yield* fs.readFile(outfile);
//         return {
//           code,
//           hash: yield* hashCode(code),
//         };
//       });

//       const createWorkerName = (id: string, props: WorkerProps | undefined) =>
//         props?.name ?? `${app.name}-${id}-${app.stage}`.toLowerCase();

//       const mapWorkerResult = Effect.fnUntraced(function* (
//         worker: Workers.Beta.Worker,
//         accountId: string,
//       ) {
//         let url: string | undefined;
//         if (worker.subdomain?.enabled) {
//           url = `https://${worker.name}.${yield* getAccountSubdomain(accountId)}.workers.dev`;
//         }
//         return {
//           id: worker.id,
//           name: worker.name,
//           logpush: worker.logpush,
//           observability: worker.observability,
//           subdomain: worker.subdomain as WorkerAttr<WorkerProps>["subdomain"],
//           url: url as WorkerAttr<WorkerProps>["url"],
//           tags: worker.tags,
//           accountId,
//         } satisfies WorkerAttr<WorkerProps>;
//       });
//       const createVersion = Effect.fnUntraced(function* (
//         workerId: string,
//         workerName: string,
//         accountId: string,
//         props: WorkerProps,
//         bindings: Array<Worker["binding"]>,
//       ) {
//         const bundle = yield* prepareBundle(workerId, props.main);
//         let resolvedAssets: Worker.Assets | undefined;
//         const resolvedBindings: Worker.Binding[] = [];
//         const modules: Worker.Module[] = [
//           {
//             name: "worker.js",
//             content_base64: Encoding.encodeBase64(bundle.code),
//             content_type: "application/javascript+module",
//           },
//         ];
//         for (const binding of bindings) {
//           if (binding.bindings) {
//             resolvedBindings.push(...binding.bindings);
//           }
//           if (binding.modules) {
//             modules.push(...binding.modules);
//           }
//         }
//         if (props.assets) {
//           const data = yield* assets.read(
//             typeof props.assets === "string"
//               ? { directory: props.assets }
//               : props.assets,
//           );
//           console.log("data", data);
//           // const { jwt } = yield* assets.upload(accountId, workerName, data);
//           resolvedAssets = {
//             // jwt,
//             config: data.config,
//           };
//           if (data._headers) {
//             modules.push({
//               name: "_headers",
//               content_base64: Encoding.encodeBase64(data._headers),
//               content_type: "text/plain",
//             });
//           }
//           if (data._redirects) {
//             modules.push({
//               name: "_redirects",
//               content_base64: Encoding.encodeBase64(data._redirects),
//               content_type: "text/plain",
//             });
//           }
//           resolvedBindings.push({
//             type: "inherit",
//             name: "ASSETS",
//           });
//         }
//         return yield* api.workers.beta.workers.versions.create(workerId, {
//           account_id: accountId,
//           deploy: true,
//           compatibility_date: props.compatibility?.date,
//           compatibility_flags: props.compatibility?.flags,
//           limits: props.limits,
//           placement: props.placement,
//           bindings: resolvedBindings,
//           main_module: "worker.js",
//           modules,
//           migrations: undefined,
//           annotations: undefined,
//           assets: resolvedAssets,
//         });
//       });

//       const makeWorkerPayload = (
//         id: string,
//         props: WorkerProps,
//       ):
//         | Workers.Beta.Workers.WorkerCreateParams
//         | Workers.Beta.Workers.WorkerUpdateParams => ({
//         account_id: accountId,
//         name: createWorkerName(id, props),
//         logpush: props.logpush,
//         observability: props.observability ?? {
//           enabled: true,
//           logs: {
//             enabled: true,
//           },
//         },
//         subdomain: props.subdomain ?? {
//           enabled: true,
//           previews_enabled: true,
//         },
//         tags: props.tags,
//         tail_consumers: [], // todo
//       });

//       const deleteWorker = Effect.fnUntraced(function* (
//         workerId: string,
//         accountId: string,
//       ) {
//         yield* api.workers.beta.workers
//           .delete(workerId, {
//             account_id: accountId,
//           })
//           .pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined)));
//       });

//       return {
//         diff: ({ id, olds, news, output }) =>
//           Effect.sync(() => {
//             console.dir(
//               {
//                 olds,
//                 news,
//               },
//               { depth: null },
//             );
//             if (output.accountId !== accountId) {
//               return { action: "replace" };
//             }
//             if (
//               !util.isDeepStrictEqual(
//                 makeWorkerPayload(id, news),
//                 makeWorkerPayload(id, olds),
//               )
//             ) {
//               return { action: "update" };
//             }
//             return { action: "update" };
//           }),
//         read: Effect.fnUntraced(function* ({ id, olds, output }) {
//           const workerId = output?.id ?? createWorkerName(id, olds);
//           const workerAccountId = output?.accountId ?? accountId;
//           return yield* api.workers.beta.workers
//             .get(workerId, {
//               account_id: workerAccountId,
//             })
//             .pipe(
//               Effect.flatMap((worker) =>
//                 mapWorkerResult(worker, workerAccountId),
//               ),
//               Effect.catchTag("NotFound", () => Effect.succeed(undefined)),
//             );
//         }),
//         create: Effect.fnUntraced(function* ({ id, news, bindings }) {
//           console.log("worker create", id, news);
//           const worker = yield* api.workers.beta.workers
//             .create(makeWorkerPayload(id, news))
//             .pipe(
//               Effect.flatMap((worker) => mapWorkerResult(worker, accountId)),
//             );
//           const version = yield* createVersion(
//             worker.id,
//             worker.name,
//             accountId,
//             news,
//             bindings,
//           ).pipe(Effect.tapError(() => deleteWorker(worker.id, accountId)));
//           return worker;
//         }),
//         update: Effect.fnUntraced(function* ({
//           id,
//           olds,
//           news,
//           output,
//           bindings,
//         }) {
//           let worker = output;
//           if (
//             !util.isDeepStrictEqual(
//               makeWorkerPayload(id, news),
//               makeWorkerPayload(id, olds),
//             )
//           ) {
//             worker = yield* api.workers.beta.workers
//               .update(output.id, makeWorkerPayload(id, news))
//               .pipe(
//                 Effect.flatMap((worker) =>
//                   mapWorkerResult(worker, output.accountId),
//                 ),
//               );
//           }
//           const version = yield* createVersion(
//             worker.id,
//             worker.name,
//             output.accountId,
//             news,
//             bindings,
//           );
//           return worker;
//         }),
//         delete: Effect.fnUntraced(function* ({ output }) {
//           yield* deleteWorker(output.id, output.accountId);
//         }),
//       };
//     }),
//   );
