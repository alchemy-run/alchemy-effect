import { $ } from "@alchemy.run/effect";
import type {
  Context as LambdaContext,
  LambdaFunctionURLEvent,
  LambdaFunctionURLResult,
} from "aws-lambda";
import * as Effect from "effect/Effect";
import * as Lambda from "./function.ts";

export const serve =
  <const ID extends string, Req>(
    id: ID,
    {
      fetch,
    }: {
      fetch: (
        event: LambdaFunctionURLEvent,
        context: LambdaContext,
      ) => Effect.Effect<LambdaFunctionURLResult, never, Req>;
    },
  ) =>
  <const Props extends Lambda.FunctionProps<Req>>(props: Props) => {
    const f = Lambda.Function(id, fetch);
    return f({
      main: "",
      bindings: $(),
    });
  };
