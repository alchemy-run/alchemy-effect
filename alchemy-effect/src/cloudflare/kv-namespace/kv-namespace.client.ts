import type { KVNamespace } from "@cloudflare/workers-types";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export class KVNamespaceClient extends Context.Tag(
  "Cloudflare.KVNamespace.Client",
)<KVNamespaceClient, KVNamespace>() {}

export const client = () =>
  Layer.effect(
    KVNamespaceClient,
    Effect.gen(function* () {
      // TODO: provide effect-native interface
      // TODO: use policy.declare
      // TODO: provide node client as well?
      // @ts-expect-error - TODO: fix this
      const { env } = yield* Effect.promise(() => import("cloudflare:workers"));
      return env["<todo>"] as KVNamespace;
    }),
  );
