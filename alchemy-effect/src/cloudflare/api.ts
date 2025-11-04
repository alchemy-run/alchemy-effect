import * as cf from "cloudflare";
import { isRequestOptions, type APIPromise } from "cloudflare/core.mjs";
import type { APIError } from "cloudflare/src/error.js";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";

export class CloudflareAccountId extends Context.Tag("CloudflareAccountId")<
  CloudflareAccountId,
  string
>() {}

type ToEffect<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? (
        ...args: Parameters<T[K]>
      ) => Effect.Effect<UnwrapAPIPromise<ReturnType<T[K]>>, cf.APIError>
    : T[K] extends Record<string, any>
      ? ToEffect<T[K]>
      : T[K];
};

type UnwrapAPIPromise<T> = T extends APIPromise<infer U> ? U : T;

const createRecursiveProxy = <T extends object>(target: T): ToEffect<T> => {
  return new Proxy(target as any, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return Effect.fnUntraced(function* (...args: any[]) {
          return yield* Effect.promise(async (signal) => {
            let modifiedArgs: any[];
            if (isRequestOptions(args[args.length - 1])) {
              modifiedArgs = [
                ...args.slice(0, -1),
                { ...args[args.length - 1], signal },
              ];
            } else {
              modifiedArgs = [...args, { signal }];
            }
            const result = await value(...modifiedArgs);
            return result;
          });
        });
      }
      return createRecursiveProxy(value);
    },
  });
};

export class Cloudflare extends Effect.Service<Cloudflare>()("Cloudflare", {
  effect: (input?: {
    apiEmail?: string;
    apiKey?: string;
    apiToken?: string;
    baseUrl?: string;
  }) => {
    const api = new cf.Cloudflare({
      apiEmail: input?.apiEmail ?? import.meta.env.CLOUDFLARE_EMAIL,
      apiKey: input?.apiKey ?? import.meta.env.CLOUDFLARE_API_KEY,
      apiToken: input?.apiToken ?? import.meta.env.CLOUDFLARE_API_TOKEN,
      baseURL: input?.baseUrl ?? import.meta.env.CLOUDFLARE_BASE_URL,
    });
    return Effect.succeed(createRecursiveProxy(api));
  },
}) {}

export function notFoundToUndefined(): <T>(
  self: Effect.Effect<T, APIError>,
) => Effect.Effect<T | undefined, APIError> {
  return Effect.catchIf(
    (error) => error.status === 404,
    () => Effect.succeed(undefined),
  );
}
