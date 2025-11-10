import * as Layer from "effect/Layer";
import * as ESBuild from "../esbuild.ts";
import { CloudflareAccountId, CloudflareApi } from "./api.ts";
import * as KV from "./kv/index.ts";
import * as R2 from "./r2/index.ts";
import * as Worker from "./worker/index.ts";

export function providers() {
  return Layer.mergeAll(
    Layer.provideMerge(
      Worker.workerProvider(),
      Layer.mergeAll(ESBuild.layer(), Worker.assetsProvider()),
    ),
    KV.namespaceProvider(),
    R2.bucketProvider(),
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
