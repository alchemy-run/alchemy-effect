import * as Effect from "effect/Effect";

import {
  Binding,
  Policy,
  type Capability,
  type Declared,
} from "@alchemy.run/effect";
import { Function } from "../lambda/index.ts";
import { QueueClient } from "./queue.client.ts";
import { Queue } from "./queue.ts";

export interface SendMessage<Q> extends Capability<"AWS.SQS.SendMessage", Q> {}

export const sendMessage = <Q extends Queue>(
  queue: Declared<Q>,
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

// provide a custom tag to uniquely identify your binding implementation of Function<SendMessage<Q>>
export const SendMessage2 = Binding<
  <Q extends Queue>(
    queue: Declared<Q>,
  ) => Binding<Function, SendMessage<Q>, "Hyperdrive">
>(Function, Queue, "Hyperdrive");

export const SendMessage = Binding<
  <Q extends Queue>(queue: Declared<Q>) => Binding<Function, SendMessage<Q>>
>(Function, Queue, "AWS.SQS.SendMessage");

export const sendMessageFromLambdaFunction = () =>
  SendMessage.layer.succeed({
    // oxlint-disable-next-line require-yield
    attach: Effect.fn(function* (queue, _props, _target) {
      return {
        env: {
          // ask what attribute is needed to interact? e.g. is it the Queue ARN or the Queue URL?
          [`${queue.id.toUpperCase().replace(/-/g, "_")}_QUEUE_URL`]:
            queue.attr.queueUrl,
        },
        policyStatements: [
          {
            Sid: capability.sid,
            Effect: "Allow",
            Action: ["sqs:SendMessage"], // <- ask LLM how to generate this
            Resource: [queue.attr.queueArn],
          },
        ],
      };
    }),
  });
