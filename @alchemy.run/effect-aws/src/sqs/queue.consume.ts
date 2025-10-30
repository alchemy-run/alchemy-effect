import { Binding, type Capability, type From } from "@alchemy.run/effect";
import type * as lambda from "aws-lambda";
import * as Effect from "effect/Effect";
import { Function } from "../lambda/index.ts";
import { Queue } from "./queue.ts";

export type QueueRecord<Data> = Omit<lambda.SQSRecord, "body"> & {
  body: Data;
};

export type QueueEvent<Data> = Omit<lambda.SQSEvent, "Records"> & {
  Records: QueueRecord<Data>[];
};

export interface Consume<Q = Queue> extends Capability<"AWS.SQS.Consume", Q> {}

export interface QueueEventSourceProps {
  batchSize?: number;
  maxBatchingWindow?: number;
  maxConcurrency?: number;
  reportBatchItemFailures?: boolean;
}

export const QueueEventSource = Binding<
  <Q extends Queue, const Props extends QueueEventSourceProps>(
    queue: Q,
    props?: Props,
  ) => Binding<Function, Consume<From<Q>>, Props, "QueueEventSource">
>(Function, Queue, "AWS.SQS.Consume", "QueueEventSource");

export const consumeFromLambdaFunction = () =>
  QueueEventSource.layer.succeed({
    // oxlint-disable-next-line require-yield
    attach: Effect.fn(function* (queue, _props, _target) {
      return {
        policyStatements: [
          {
            Sid: capability.sid,
            Effect: "Allow",
            Action: [
              "sqs:ReceiveMessage",
              "sqs:DeleteMessage",
              "sqs:ChangeMessageVisibility",
            ],
            Resource: [queue.attr.queueArn],
          },
        ],
      };
    }),
  });
