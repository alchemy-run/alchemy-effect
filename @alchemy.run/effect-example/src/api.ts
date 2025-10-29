import { $ } from "@alchemy.run/effect";
import * as Lambda from "@alchemy.run/effect-aws/lambda";
import * as SQS from "@alchemy.run/effect-aws/sqs";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Message, Messages } from "./messages.ts";

// SQS.SendMessage<Messages>
// -> FunctionBinding<SQS.SendMessage<Messages>>
//   -> FunctionBinding<SQS.SendMessage<Queue>>
//   -> "AWS.Lambda.Function(SQS.SendMessage(AWS.SQS.Queue))"

const ____ = $(SQS.SendMessage(Messages));
const _____ = $(SQS.SendMessage2(Messages));

const ___ = Lambda.serve("Api", {
  fetch: Effect.fn(function* (event) {
    const msg = yield* S.validate(Message)(event.body).pipe(
      Effect.catchAll(Effect.die),
    );
    yield* SQS.sendMessage(Messages, msg).pipe(
      Effect.catchAll(() => Effect.void),
    );
    return {
      body: JSON.stringify(null),
    };
  }),
})({
  main: import.meta.filename,
  bindings: $(SQS.SendMessage(Messages)),
});

export class Api extends Lambda.serve("Api", {
  fetch: Effect.fn(function* (event) {
    const msg = yield* S.validate(Message)(event.body).pipe(
      Effect.catchAll(Effect.die),
    );
    yield* SQS.sendMessage(Messages, msg).pipe(
      Effect.catchAll(() => Effect.void),
    );
    return {
      body: JSON.stringify(null),
    };
  }),
})({
  main: import.meta.filename,
  bindings: $(SQS.SendMessage(Messages)),
}) {}

// coupled to physical infrastructure (actual SQS client)
export default Api.pipe(Effect.provide(SQS.clientFromEnv()), Lambda.toHandler);
