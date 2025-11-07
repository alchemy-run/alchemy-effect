import * as Layer from "effect/Layer";
import { ESBuild } from "../esbuild.ts";
import { CloudflareAccountId, CloudflareApi } from "./api.ts";
import { assetsProvider } from "./assets.provider.ts";
import * as KV from "./kv/index.ts";
import * as R2 from "./r2/index.ts";
import * as Worker from "./worker/index.ts";

export * as Assets from "./assets.fetch.ts";
export * as KV from "./kv/index.ts";
export * as R2 from "./r2/index.ts";
export * as Worker from "./worker/index.ts";

export type * as Alchemy from "../index.ts";

export const providers = Layer.mergeAll(
  Layer.provideMerge(
    Worker.workerProvider(),
    Layer.mergeAll(ESBuild.Default, assetsProvider()),
  ),
  KV.namespaceProvider(),
  R2.bucketProvider(),
);

export const bindings = Layer.mergeAll(
  //
  KV.bindFromWorker(),
  R2.bindFromWorker(),
);

export const defaultProviders = providers.pipe(Layer.provideMerge(bindings));

export const live = defaultProviders.pipe(
  Layer.provide(CloudflareAccountId.fromEnv),
  Layer.provide(CloudflareApi.Default()),
);

export default live;
