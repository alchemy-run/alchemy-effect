import * as SQS from "@alchemy.run/effect-aws/sqs";
import * as S from "effect/Schema";

export class Message extends S.Struct({
  id: S.Int,
  value: S.String,
}) {}

// Declared queue dependency
export class Messages extends SQS.Queue("messages", {
  fifo: true,
  schema: Message,
}) {}

// triangulation
// 1. Runtime Business Logic
// 2. Deloyed Bundle
// 3. Infrastructure
