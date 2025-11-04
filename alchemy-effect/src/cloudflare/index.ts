import * as Layer from "effect/Layer";
import { Cloudflare } from "./api.ts";
import * as KVNamespace from "./kv-namespace/index.ts";
import * as Worker from "./worker/index.ts";

export * as KVNamespace from "./kv-namespace/index.ts";

export const providers = Layer.merge(
  KVNamespace.kvNamespaceProvider(),
  Worker.workerProvider(),
);

export const live = providers.pipe(Layer.provide(Cloudflare.Default({})));
