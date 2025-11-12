import * as Schedule from "effect/Schedule";
import * as Data from "effect/Data";
import * as AWS from "@/aws";
import * as DynamoDB from "@/aws/dynamodb";
import { apply, destroy, type } from "@/index";
import { test } from "@/test";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

test(
  "create, update, delete table",
  Effect.gen(function* () {
    const dynamodb = yield* DynamoDB.DynamoDBClient;

    class Table extends DynamoDB.Table("Table", {
      tableName: "test",
      items: type<{ id: string }>,
      attributes: {
        id: S.String,
      },
      partitionKey: "id",
    }) {}

    const stack = yield* apply(Table);

    const actualTable = yield* dynamodb.describeTable({
      TableName: stack.Table.tableName,
    });
    expect(actualTable.Table?.TableArn).toEqual(stack.Table.tableArn);

    yield* destroy();

    // yield* dynamodb
    //   .describeTable({
    //     TableName: stack.Table.tableName,
    //   })
    //   .pipe(
    //     Effect.flatMap(() => Effect.fail(new TableStillExists())),
    //     Effect.retry({
    //       while: (e) => e._tag === "TableStillExists",
    //       schedule: Schedule.exponential(100),
    //     }),
    //     Effect.catchTag("ResourceNotFoundException", () => Effect.void),
    //   );
  }).pipe(Effect.provide(AWS.live)),
);

class TableStillExists extends Data.TaggedError("TableStillExists") {}
