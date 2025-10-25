import { $, Policy } from "@alchemy.run/effect";
import type {
  Context as LambdaContext,
  SQSBatchResponse,
  SQSEvent,
} from "aws-lambda";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SQS from "../sqs/index.ts";
import * as Lambda from "./function.ts";

export const consume =
  <Q extends SQS.Queue, ID extends string, Req>(
    id: ID,
    { queue, handle }: {
      queue: Q;
      handle: (
        event: SQS.QueueEvent<Q["props"]["schema"]["Type"]>,
        context: LambdaContext,
      ) => Effect.Effect<SQSBatchResponse | void, never, Req>;
    },
  ) =>
  <const Props extends Lambda.FunctionProps<Req>>(props: Props) =>
    Lambda.Function(id, {
      handle: Effect.fn(function* (event: SQSEvent, context: LambdaContext) {
        yield* Policy.declare<SQS.Consume<Q>>();
        const records = yield* Effect.all(
          event.Records.map(
            Effect.fn(function* (record) {
              return {
                ...record,
                body: yield* S.validate(queue.props.schema)(record.body).pipe(
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
    })({ ...props, bindings: $(SQS.Consume(queue)) });
