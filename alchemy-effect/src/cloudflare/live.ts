import * as Layer from "effect/Layer";
import * as ESBuild from "../esbuild.ts";
import { CloudflareAccountId, CloudflareApi } from "./api.ts";
import * as KV from "./kv/index.ts";
import { namespaceProvider } from "./kv/namespace.provider.ts";
import { bucketProvider } from "./r2/bucket.provider.ts";
import * as R2 from "./r2/index.ts";
import { assetsProvider } from "./worker/assets.provider.ts";
import { workerProvider } from "./worker/worker.provider.ts";

export function providers() {
  return Layer.mergeAll(
    Layer.provideMerge(
      workerProvider(),
      Layer.mergeAll(ESBuild.layer(), assetsProvider()),
    ),
    namespaceProvider(),
    bucketProvider(),
  );
}

export function bindings() {
  return Layer.mergeAll(KV.bindFromWorker(), R2.bindFromWorker());
}

export function defaultProviders() {
  return providers().pipe(Layer.provideMerge(bindings()));
}

export function live() {
  return defaultProviders().pipe(
    Layer.provide(CloudflareAccountId.fromEnv),
    Layer.provide(CloudflareApi.Default()),
  );
}

export default live;
