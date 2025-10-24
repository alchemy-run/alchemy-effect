import { Policy, type Capability } from "@alchemy.run/effect";
import type {
  Context as LambdaContext,
  SQSBatchResponse,
  SQSEvent,
} from "aws-lambda";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SQS from "../sqs/index.ts";
import * as Lambda from "./function.ts";

export interface ConsumeProps<Q extends SQS.Queue, Req>
  extends Lambda.FunctionProps {
  queue: Q;
  bindings: Policy<Extract<Req, Capability>>;
}

export function consume<Q extends SQS.Queue, ID extends string, Req>(
  id: ID,
  props: ConsumeProps<Q, Req>,
  handle: (
    event: SQS.QueueEvent<Q["props"]["schema"]["Type"]>,
    context: LambdaContext,
  ) => Effect.Effect<SQSBatchResponse | void, never, Req>,
) {
  const { queue, bindings } = props;
  const schema = queue.props.schema;
  return Lambda.Function(
    id,
    {
      ...props,
      bindings: bindings.and(SQS.Consume(queue)),
    },
    Effect.fn(function* (event: SQSEvent, context: LambdaContext) {
      yield* Policy.declare<SQS.Consume<Q>>();
      const records = yield* Effect.all(
        event.Records.map(
          Effect.fn(function* (record) {
            return {
              ...record,
              body: yield* S.validate(schema)(record.body).pipe(
                Effect.catchAll(() => Effect.void),
              ),
            };
          }),
        ),
      );
      const response = yield* handle(
        {
          Records: records.filter((record) => record.body !== undefined),
        },
        context,
      );
      return {
        batchItemFailures: [
          ...(response?.batchItemFailures ?? []),
          ...records
            .filter((record) => record.body === undefined)
            .map((failed) => ({
              itemIdentifier: failed.messageId,
            })),
        ],
      } satisfies SQSBatchResponse;
    }),
  );
}
