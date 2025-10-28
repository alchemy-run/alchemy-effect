import type { Capability, Declared } from "@alchemy.run/effect";
import type * as lambda from "aws-lambda";
import * as Effect from "effect/Effect";
import { Function, type FunctionBinding } from "../lambda/index.ts";
import { Queue } from "./queue.ts";

export interface Consume<Q> extends Capability<"AWS.SQS.Consume", Q> {}

export const Consume = Function.binding<
  <Q extends Queue>(
    queue: Declared<Q>,
    props?: {
      batchSize?: number;
      maxBatchingWindow?: number;
      maxConcurrency?: number;
      reportBatchItemFailures?: boolean;
    },
  ) => FunctionBinding<Consume<Q>>
>("AWS.SQS.Consume", Queue);

export type QueueRecord<Data> = Omit<lambda.SQSRecord, "body"> & {
  body: Data;
};

export type QueueEvent<Data> = Omit<lambda.SQSEvent, "Records"> & {
  Records: QueueRecord<Data>[];
};

export const consumeFromLambdaFunction = () =>
  Consume.layer.succeed({
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
