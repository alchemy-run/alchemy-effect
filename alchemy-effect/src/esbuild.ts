import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Queue from "effect/Queue";
import esbuild from "esbuild";

export class ESBuild extends Effect.Service<ESBuild>()("ESBuild", {
  effect: Effect.gen(function* () {
    const esbuild = yield* Effect.promise(() => import("esbuild"));
    return {
      build: Effect.fnUntraced(function* <T extends esbuild.BuildOptions>(
        options: esbuild.SameShape<esbuild.BuildOptions, T>,
      ) {
        return yield* Effect.tryPromise({
          try: () => esbuild.build<T>(options),
          catch: ESBuildError.map,
        });
      }),
      context: Effect.fnUntraced(function* <T extends esbuild.BuildOptions>(
        options: esbuild.SameShape<esbuild.BuildOptions, T>,
      ) {
        const queue = yield* Queue.unbounded<esbuild.BuildResult<T>>();
        const context = yield* Effect.tryPromise({
          try: async () =>
            esbuild.context({
              ...options,
              plugins: [
                ...(options.plugins ?? []),
                {
                  name: "queue",
                  setup: (build) => {
                    build.onEnd((result) => {
                      Queue.unsafeOffer(
                        queue,
                        result as esbuild.BuildResult<T>,
                      );
                    });
                  },
                },
              ],
            }),
          catch: ESBuildError.map,
        });
        yield* Effect.addFinalizer(() =>
          Effect.promise(() => context.dispose()),
        );
        yield* Effect.tryPromise({
          try: () => context.watch(),
          catch: ESBuildError.map,
        });
        return {
          queue,
          rebuild: Effect.fnUntraced(function* () {
            return yield* Effect.tryPromise({
              try: (): Promise<esbuild.BuildResult<T>> => context.rebuild(),
              catch: ESBuildError.map,
            });
          }),
        };
      }),
    };
  }),
}) {}

export class ESBuildError extends Data.TaggedError("ESBuildError")<{
  message: string;
  errors: esbuild.Message[];
  messages: esbuild.Message[];
}> {
  static map(error: unknown): ESBuildError {
    const cause = error as esbuild.BuildFailure;
    return new ESBuildError({
      message: cause.message,
      errors: cause.errors,
      messages: cause.warnings,
    });
  }
}
