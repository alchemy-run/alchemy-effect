import * as AWS from "@/aws";
import * as DynamoDB from "@/aws/dynamodb";
import { apply, destroy, type } from "@/index";
import { test } from "@/test";
import { expect } from "@effect/vitest";
import { LogLevel } from "effect";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";

test(
  "create, update, delete table",
  Effect.gen(function* () {
    const dynamodb = yield* DynamoDB.DynamoDBClient;

    let stack;

    // Create table with basic config
    {
      class Table extends DynamoDB.Table("Table", {
        tableName: "test",
        items: type<{ id: string }>,
        attributes: {
          id: S.String,
        },
        partitionKey: "id",
      }) {}

      stack = yield* apply(Table);

      const actualTable = yield* dynamodb.describeTable({
        TableName: stack.Table.tableName,
      });
      expect(actualTable.Table?.TableArn).toEqual(stack.Table.tableArn);
      expect(actualTable.Table?.BillingModeSummary?.BillingMode).toEqual(
        "PAY_PER_REQUEST",
      );
    }

    // Update to provisioned billing
    {
      class Table extends DynamoDB.Table("Table", {
        tableName: "test",
        items: type<{ id: string }>,
        attributes: {
          id: S.String,
        },
        partitionKey: "id",
        billingMode: "PROVISIONED",
        provisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      }) {}

      stack = yield* apply(Table);

      const actualTable = yield* dynamodb.describeTable({
        TableName: stack.Table.tableName,
      });
      expect(actualTable.Table?.BillingModeSummary?.BillingMode).toEqual(
        "PROVISIONED",
      );
      expect(
        actualTable.Table?.ProvisionedThroughput?.ReadCapacityUnits,
      ).toEqual(5);
    }

    // Update provisioned throughput
    {
      class Table extends DynamoDB.Table("Table", {
        tableName: "test",
        items: type<{ id: string }>,
        attributes: {
          id: S.String,
        },
        partitionKey: "id",
        billingMode: "PROVISIONED",
        provisionedThroughput: {
          ReadCapacityUnits: 10,
          WriteCapacityUnits: 10,
        },
      }) {}

      stack = yield* apply(Table);

      const actualTable = yield* dynamodb.describeTable({
        TableName: stack.Table.tableName,
      });
      expect(
        actualTable.Table?.ProvisionedThroughput?.ReadCapacityUnits,
      ).toEqual(10);
      expect(
        actualTable.Table?.ProvisionedThroughput?.WriteCapacityUnits,
      ).toEqual(10);
    }

    // Add TTL
    {
      class Table extends DynamoDB.Table("Table", {
        tableName: "test",
        items: type<{ id: string; ttl: number }>,
        attributes: {
          id: S.String,
        },
        partitionKey: "id",
        billingMode: "PROVISIONED",
        provisionedThroughput: {
          ReadCapacityUnits: 10,
          WriteCapacityUnits: 10,
        },
        timeToLiveSpecification: {
          AttributeName: "ttl",
          Enabled: true,
        },
      }) {}

      stack = yield* apply(Table);

      const ttl = yield* dynamodb.describeTimeToLive({
        TableName: stack.Table.tableName,
      });
      expect(ttl.TimeToLiveDescription?.AttributeName).toEqual("ttl");
      expect(ttl.TimeToLiveDescription?.TimeToLiveStatus).toBeOneOf([
        "ENABLING",
        "ENABLED",
      ]);
    }

    // Switch back to on-demand billing
    {
      class Table extends DynamoDB.Table("Table", {
        tableName: "test",
        items: type<{ id: string; ttl: number }>,
        attributes: {
          id: S.String,
        },
        partitionKey: "id",
        billingMode: "PAY_PER_REQUEST",
        timeToLiveSpecification: {
          AttributeName: "ttl",
          Enabled: true,
        },
      }) {}

      stack = yield* apply(Table);

      const actualTable = yield* dynamodb.describeTable({
        TableName: stack.Table.tableName,
      });
      expect(actualTable.Table?.BillingModeSummary?.BillingMode).toEqual(
        "PAY_PER_REQUEST",
      );
    }

    yield* destroy();

    yield* waitForTableToBeDeleted(stack.Table.tableName);
  }).pipe(Effect.provide(AWS.live), Logger.withMinimumLogLevel(LogLevel.Info)),
);

const waitForTableToBeDeleted = Effect.fn(function* (tableName: string) {
  const dynamodb = yield* DynamoDB.DynamoDBClient;
  dynamodb
    .describeTable({
      TableName: tableName,
    })
    .pipe(
      Effect.flatMap(() => Effect.fail(new TableStillExists())),
      Effect.retry({
        while: (e) => e._tag === "TableStillExists",
        schedule: Schedule.exponential(100),
      }),
      Effect.catchTag("ResourceNotFoundException", () => Effect.void),
    );
});

class TableStillExists extends Data.TaggedError("TableStillExists") {}
