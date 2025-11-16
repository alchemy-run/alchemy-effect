import { $ } from "@/index";
import * as SQS from "@/aws/sqs";
import * as AWS from "@/aws";
import * as DynamoDB from "@/aws/dynamodb";
import * as Lambda from "@/aws/lambda";
import { apply, destroy, type } from "@/index";
import { test } from "@/test";
import { expect } from "@effect/vitest";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import path from "pathe";

const main = path.resolve(import.meta.dirname, "..", "..", "handler.ts");

// these never run, we just use them to test our types
// TODO(sam): set up attest
function typeOnlyTests() {
  class Table extends DynamoDB.Table("Table", {
    tableName: "test",
    items: type<{ id: string; sk: string }>,
    attributes: {
      id: S.String,
      sk: S.String,
    },
    partitionKey: "id",
    sortKey: "sk",
  }) {}
  class Queue extends SQS.Queue("Queue", {
    queueName: "test",
    schema: S.String,
  }) {}

  const func = Lambda.serve("MyFunction", {
    fetch: Effect.fn(function* (event) {
      const item = yield* DynamoDB.getItem({
        table: Table,
        key: {
          id: "id",
          sk: "sk",
        },
      }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));
      return {
        body: JSON.stringify(item?.Item),
      };
    }),
  });

  {
    class MyFunction extends func({
      main,
      bindings: $(
        DynamoDB.GetItem(Table, {
          leadingKeys: $.anyOf("id"),
        }),
      ),
    }) {}
  }
  {
    class MyFunction extends func({
      main,
      // @ts-expect-error - missing DynamoDB.GetItem(Table)
      bindings: $(),
    }) {}
  }
  {
    class MyFunction extends func({
      main,
      // @ts-expect-error - missing leading keys
      bindings: $(DynamoDB.GetItem(Table)),
    }) {}
  }
  {
    class MyFunction extends func({
      main,
      // @ts-expect-error - wrong leading key
      bindings: $(
        DynamoDB.GetItem(Table, {
          leadingKeys: $.anyOf("sk"),
        }),
      ),
    }) {}
  }
  {
    class MyFunction extends func({
      main,
      // @ts-expect-error - additional SQS.SendMessage(Queue)
      bindings: $(
        DynamoDB.GetItem(Table, {
          leadingKeys: $.anyOf("id"),
        }),
        SQS.SendMessage(Queue),
      ),
    }) {}
  }
}
