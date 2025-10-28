import * as SQS from "@alchemy.run/effect-aws/sqs";
import * as S from "effect/Schema";

export class Message extends S.Class<Message>("Message")({
  id: S.Int,
  value: S.String,
}) {}

export class Messages extends SQS.Queue("messages", {
  fifo: true,
  schema: Message,
}) {}
