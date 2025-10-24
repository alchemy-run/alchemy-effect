import * as Effect from "effect/Effect";

import { Capability, Policy } from "@alchemy.run/effect";
import { FunctionClient } from "./function.client.ts";
import { FunctionRuntime } from "./function.ts";

export interface InvokeFunction<Resource = unknown>
  extends Capability<"AWS.Lambda.InvokeFunction", Resource> {
  constructor: InvokeFunction;
  construct: InvokeFunction<this["instance"]>;
}
export const InvokeFunction = Capability<InvokeFunction>(
  "AWS.Lambda.InvokeFunction",
);

export const invoke = <F extends FunctionRuntime>(func: F, input: any) =>
  Effect.gen(function* () {
    const lambda = yield* FunctionClient;
    const functionArn = process.env[`${func.id}-functionArn`]!;
    yield* Policy.declare<InvokeFunction<F>>();
    return yield* lambda.invoke({
      FunctionName: functionArn,
      InvocationType: "RequestResponse",
      Payload: JSON.stringify(input),
    });
  });
