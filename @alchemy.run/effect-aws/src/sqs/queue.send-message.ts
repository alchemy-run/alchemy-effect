import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Capability, Policy } from "@alchemy.run/effect";
import { FunctionRuntime } from "../lambda/index.ts";
import { QueueClient } from "./queue.client.ts";
import { Queue } from "./queue.ts";

export interface SendMessage<Resource = unknown>
  extends Capability<"AWS.SQS.SendMessage", Resource> {
  constructor: SendMessage;
  construct: SendMessage<this["instance"]>;
}
export const SendMessage = Capability<SendMessage>("AWS.SQS.SendMessage");

export const sendMessage = <Q extends Queue>(
  queue: Q,
  message: Q["props"]["schema"]["Type"],
) =>
  Effect.gen(function* () {
    yield* Policy.declare<SendMessage<Q>>();
    const sqs = yield* QueueClient;
    const url =
      process.env[`${queue.id.toUpperCase().replace(/-/g, "_")}_QUEUE_URL`]!;
    return yield* sqs.sendMessage({
      QueueUrl: url,
      MessageBody: JSON.stringify(message),
    });
  });

export const sendMessageFromLambdaFunction = () =>
  Layer.succeed(
    FunctionRuntime(SendMessage(Queue)),
    FunctionRuntime(SendMessage(Queue)).of({
      attach: Effect.fn(function* (queue, capability) {
        return {
          env: {
            [`${queue.id.toUpperCase().replace(/-/g, "_")}_QUEUE_URL`]:
              queue.attr.queueUrl,
          },
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
