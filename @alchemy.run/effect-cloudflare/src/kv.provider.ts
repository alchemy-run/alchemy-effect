import { App, Provider } from "@alchemy.run/effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { CloudflareAccountId, CloudflareApi } from "./api.ts";
import { KV, type KVProps } from "./kv.ts";

export const kvProvider = () =>
  Layer.effect(
    Provider(KV),
    Effect.gen(function* () {
      const app = yield* App;
      const api = yield* CloudflareApi;
      const accountId = yield* CloudflareAccountId;

      const createTitle = (id: string, news: KVProps) =>
        news.title ?? `${app.name}-${id}-${app.stage}`;

      return Provider(KV).of({
        create: Effect.fn(function* ({ id, news }) {
          const result = yield* Effect.promise(() =>
            api.kv.namespaces.create({
              account_id: accountId,
              title: createTitle(id, news),
            }),
          );
          return {
            title: result.title,
            namespaceId: result.id,
          };
        }),
        update: Effect.fn(function* ({ id, news, output }) {
          const title = createTitle(id, news);
          yield* Effect.promise(() =>
            api.kv.namespaces.update(output.namespaceId, {
              account_id: accountId,
              title,
            }),
          );
          return {
            title,
            namespaceId: output.namespaceId,
          };
        }),
        delete: Effect.fn(function* ({ output }) {
          yield* Effect.promise(() =>
            api.kv.namespaces.delete(output.namespaceId, {
              account_id: accountId,
            }),
          );
        }),
      });
    }),
  );
