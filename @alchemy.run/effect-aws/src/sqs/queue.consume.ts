import type * as lambda from "aws-lambda";

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { FunctionRuntime } from "../lambda/function.ts";

import { Capability } from "@alchemy.run/effect";
import { Queue } from "./queue.ts";

export interface Consume<Res = unknown>
  extends Capability<"AWS.SQS.Consume", Res> {
  constructor: Consume;
  construct: Consume<this["instance"]>;
}
export const Consume = Capability<Consume>("AWS.SQS.Consume");

export type QueueRecord<Data> = Omit<lambda.SQSRecord, "body"> & {
  body: Data;
};

export type QueueEvent<Data> = Omit<lambda.SQSEvent, "Records"> & {
  Records: QueueRecord<Data>[];
};

export const consumeFromLambdaFunction = () =>
  Layer.succeed(
    FunctionRuntime(Consume(Queue)),
    FunctionRuntime(Consume(Queue)).of({
      attach: Effect.fn(function* (queue, capability) {
        return {
          policyStatements: [
            {
              Sid: capability.sid,
              Effect: "Allow",
              Action: ["sqs:SendMessage"],
              Resource: [queue.attr.queueArn],
            },
          ],
        };
      }),
    }),
  );
