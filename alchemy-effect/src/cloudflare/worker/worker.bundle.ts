import * as Effect from "effect/Effect";
import esbuild from "esbuild";
import crypto from "node:crypto";

// wip
export const bundle = Effect.fn(function* (props: esbuild.BuildOptions) {
  const result = yield* Effect.promise(() =>
    esbuild.build({
      ...props,
      write: false,
    }),
  );
  return {
    code: result.outputFiles[0].text,
    hash: crypto
      .createHash("sha256")
      .update(result.outputFiles[0].text)
      .digest("hex"),
  };
});
