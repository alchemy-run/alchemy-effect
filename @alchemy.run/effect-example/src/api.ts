import { $ } from "@alchemy.run/effect";
import * as Lambda from "@alchemy.run/effect-aws/lambda";
import * as SQS from "@alchemy.run/effect-aws/sqs";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Message, Messages } from "./messages.ts";

// Biz Logic (isolated) easy to test, portable, decoupled from physical infrastructure
export class Api extends Lambda.serve(
  "Api",
  {
    main: import.meta.filename,
    bindings: $(SQS.SendMessage(Messages)),
    // TODO(sam): wish it could be this, but inference seems to fail without .fn wrapper
    // *fetch(req) { .. }
  },
  Effect.fn(function* (event, _ctx) {
    // _ctx.getRemainingTimeInMillis()
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
) {}

// coupled to physical infrastructure (actual SQS client)
export default Api.pipe(Effect.provide(SQS.clientFromEnv()), Lambda.toHandler);
