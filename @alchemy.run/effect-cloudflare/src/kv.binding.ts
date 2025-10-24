import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Binding } from "./binding.ts";
import { KV } from "./kv.ts";
import { Worker } from "./worker.ts";

export const kvBinding = () =>
  Layer.effect(
    Worker(Binding(KV)),
    Effect.gen(function* () {
      return Worker(Binding(KV)).of({
        attach: Effect.fn(function* (binding) {
          return {
            bindings: {
              [binding.id]: {
                type: "kv_namespace",
                kv_namespace: binding.attr.namespaceId,
                name: binding.id,
              },
            },
          };
        }),
      });
    }),
  );
