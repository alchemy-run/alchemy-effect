import type { Capability, Policy } from "@alchemy.run/effect";
import type {
  Context as LambdaContext,
  LambdaFunctionURLEvent,
  LambdaFunctionURLResult,
} from "aws-lambda";
import * as Effect from "effect/Effect";
import * as Lambda from "./function.ts";

export const serve = <
  const ID extends string,
  const Props extends Lambda.FunctionProps,
  Req,
>(
  id: ID,
  props: Props & {
    bindings: Policy<Extract<Req, Capability>>;
  },
  fetch: (
    event: LambdaFunctionURLEvent,
    context: LambdaContext,
  ) => Effect.Effect<LambdaFunctionURLResult, never, Req>,
) =>
  Lambda.Function(
    id,
    {
      ...props,
      url: true,
    },
    fetch,
  );
