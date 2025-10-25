import { $, Capability, Policy } from "@alchemy.run/effect";
import * as Lambda from "@alchemy.run/effect-aws/lambda";
import * as SQS from "@alchemy.run/effect-aws/sqs";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

// src/my-component.ts
class Message extends S.Class<Message>("Message")({
  id: S.Int,
  value: S.String,
}) {}

export interface MonitorSimpleProps extends Lambda.FunctionProps {}

const MonitorSimple = <
  const ID extends string,
  const Props extends MonitorSimpleProps,
  Req,
>(
  id: ID,
  props: Props & {
    bindings: Policy<Extract<Req, Capability>>;
  },
  onAlarm: (message: Message) => Effect.Effect<void, never, Req>,
) => {
  class Messages extends SQS.Queue(`${id}-Messages`, {
    fifo: true,
    schema: Message,
  }) {}

  return Lambda.Function(id, {
    handle: Effect.fn(function* (event, context) {
      yield* SQS.sendMessage(Messages, {
        id: 1,
        value: "1",
      }).pipe(Effect.catchAll(() => Effect.void));

      return yield* onAlarm(event);
    }),
  })({
    main: import.meta.filename,
    bindings: props.bindings.and(SQS.SendMessage(Messages)),
  });
};

export interface MonitorComplexProps<ReqAlarm, ReqResolved>
  extends Lambda.FunctionProps {
  onAlarm: (
    batch: SQS.QueueEvent<Message>,
  ) => Effect.Effect<void, never, ReqAlarm>;
  onResolved?: (
    batch: SQS.QueueEvent<Message>,
  ) => Effect.Effect<void, never, ReqResolved>;
}

const MonitorComplex = <const ID extends string, ReqAlarm, ReqResolved>(
  id: ID,
  props: {
    onAlarm: (
      batch: SQS.QueueEvent<Message>,
    ) => Effect.Effect<void, never, ReqAlarm>;
    onResolved?: (
      batch: SQS.QueueEvent<Message>,
    ) => Effect.Effect<void, never, ReqResolved>;
  },
) => {
  class Messages extends SQS.Queue(`${id}-Messages`, {
    fifo: true,
    schema: Message,
  }) {}

  return ({
    main,
    bindings,
  }: {
    main: string;
    bindings: Policy<Extract<ReqAlarm | ReqResolved, Capability>>;
  }) =>
    Lambda.consume(id, {
      queue: Messages,
      handle: Effect.fn(function* (batch) {
        yield* SQS.sendMessage(Messages, {
          id: 1,
          value: "1",
        }).pipe(Effect.catchAll(() => Effect.void));
        if (props.onAlarm) {
          yield* props.onAlarm(batch);
        }
        if (props.onResolved) {
          yield* props.onResolved(batch);
        }
      }),
    })({
      main,
      bindings: bindings.and(SQS.SendMessage(Messages)),
    });
};

// src/my-api.ts
class Outer extends SQS.Queue("Outer", {
  fifo: true,
  schema: Message,
}) {}

export const MySimpleMonitor = MonitorSimple(
  "MyMonitor",
  {
    main: import.meta.filename,
    bindings: $(SQS.SendMessage(Outer)),
  },
  Effect.fn(function* (message) {
    yield* SQS.sendMessage(Outer, message).pipe(
      Effect.catchAll(() => Effect.void),
    );
  }),
);

export class MyMonitor extends MonitorComplex("MyMonitor", {
  onAlarm: Effect.fn(function* (batch) {
    for (const record of batch.Records) {
      yield* SQS.sendMessage(Outer, record.body).pipe(
        Effect.catchAll(() => Effect.void),
      );
    }
  }),
  onResolved: Effect.fn(function* (batch) {
    for (const record of batch.Records) {
      yield* SQS.sendMessage(Outer, record.body).pipe(
        Effect.catchAll(() => Effect.void),
      );
    }
  }),
})({
  main: import.meta.filename,
  bindings: $(SQS.SendMessage(Outer)),
}) {}

export default MyMonitor.pipe(
  Effect.provide(SQS.clientFromEnv()),
  Lambda.toHandler,
);
