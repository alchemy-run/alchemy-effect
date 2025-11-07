import type { ExecutionContext } from "@cloudflare/workers-types";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export class CloudflareContext extends Context.Tag("Cloudflare.Context")<
  CloudflareContext,
  {
    env: unknown;
    ctx: ExecutionContext;
  }
>() {
  static readonly getEnvKey = Effect.fnUntraced(function* <T>(key: string) {
    return yield* Effect.serviceOptional(CloudflareContext).pipe(
      Effect.mapError(
        () =>
          new CloudflareContextNotFound({
            message: "Cloudflare context not found",
          }),
      ),
      Effect.flatMap((context) => {
        const env = context.env as Record<string, unknown>;
        if (!(key in env)) {
          return new CloudflareContextKeyNotFound({
            message: `${key} is not set in cloudflare context (found ${Object.keys(env).join(", ")})`,
            key,
          });
        }
        return Effect.succeed(env[key] as T);
      }),
      Effect.orDie,
    );
  });

  static readonly layer = ({
    env,
    ctx,
  }: {
    env: unknown;
    ctx: ExecutionContext;
  }) => Layer.succeed(CloudflareContext, { env, ctx });
}

export class CloudflareContextNotFound extends Data.TaggedError(
  "Cloudflare.Context.NotFound",
)<{
  message: string;
}> {}

export class CloudflareContextKeyNotFound extends Data.TaggedError(
  "Cloudflare.Context.KeyNotFound",
)<{
  message: string;
  key: string;
}> {}
