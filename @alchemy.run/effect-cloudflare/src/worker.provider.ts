import { App, Provider } from "@alchemy.run/effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { CloudflareAccountId, CloudflareApi } from "./api.ts";
import { Binding } from "./binding.ts";
import { Worker, type WorkerProps } from "./worker.ts";

export const workerProvider = () =>
  Layer.effect(
    Provider(Worker),
    Effect.gen(function* () {
      const api = yield* CloudflareApi;
      const accountId = yield* CloudflareAccountId;
      const app = yield* App;

      const createName = (id: string, news: WorkerProps) =>
        news.name ?? `${app.name}-${id}-${app.stage}`;

      return Provider(Worker).of({
        create: Effect.fn(function* ({ id, news, bindings }) {
          const workerName = createName(id, news);
          const worker = yield* Effect.promise(() =>
            api.workers.beta.workers.create({
              account_id: accountId,
              name: workerName,
            }),
          );
          for (const binding of bindings) {
            const binder = yield* Worker(Binding(binding));
            yield* binder.attach(
              {
                id: binding.id,
                capability: binding.capability,
                to: binding.to,
              },
              binding.capability,
              binding.to,
            );
          }
          yield* Effect.promise(() =>
            api.workers.beta.workers.versions.create(workerName, {
              account_id: accountId,
              bindings: bindings.map((binding) => ({
                a: binding.attributes,
              })),
            }),
          );
          return {
            id: worker.id,
          };
        }),
        delete: Effect.fn(function* (props) {
          return {
            url: props.url,
          };
        }),
        update: Effect.fn(function* (props) {
          return {
            url: props.url,
          };
        }),
      });
    }),
  );
