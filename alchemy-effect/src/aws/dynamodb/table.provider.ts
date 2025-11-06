import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

import { App, type ProviderService } from "alchemy-effect";
import { isNumberSchema, isStringSchema } from "../../schema.ts";
import { createTagger, validateTags } from "../../tags.ts";
import { Account } from "../account.ts";
import { Region } from "../region.ts";
import { DynamoDBClient } from "./client.ts";
import { Table, type TableAttrs, type TableProps } from "./table.ts";

export const tableProvider = () =>
  Table.provider.effect(
    // @ts-expect-error
    Effect.gen(function* () {
      const dynamodb = yield* DynamoDBClient;
      const app = yield* App;
      const region = yield* Region;
      const accountId = yield* Account;

      const createTableName = (id: string, props: TableProps) =>
        props.tableName ?? `${app.name}-${id}-${app.stage}`;

      const tagged = yield* createTagger();

      return {
        diff: Effect.fn(function* ({ id, news, olds }) {
          const oldTableName = createTableName(id, olds);
          const newTableName = createTableName(id, news);
          if (oldTableName !== newTableName) {
            return { action: "replace" } as const;
          }

          // Check if partition key or sort key changed
          if (olds.partitionKey !== news.partitionKey) {
            return { action: "replace" } as const;
          }
          if (olds.sortKey !== news.sortKey) {
            return { action: "replace" } as const;
          }

          // For other attribute changes, we can do a noop
          // (DynamoDB doesn't require updates for most attribute changes)
          return { action: "noop" } as const;
        }),

        create: Effect.fn(function* ({ id, news, session }) {
          const tableName = createTableName(id, news);

          const response = yield* dynamodb
            .createTable({
              TableName: tableName,
              KeySchema: [
                {
                  AttributeName: news.partitionKey as string,
                  KeyType: "HASH",
                },
                ...(news.sortKey
                  ? [
                      {
                        AttributeName: news.sortKey as string,
                        KeyType: "RANGE" as const,
                      },
                    ]
                  : []),
              ],
              AttributeDefinitions: Object.entries(news.attributes).map(
                ([name, schema]) => ({
                  AttributeName: name,
                  AttributeType: isStringSchema(schema)
                    ? "S"
                    : isNumberSchema(schema)
                      ? "N"
                      : // TODO(sam): how to detect binary?
                        "S",
                }),
              ),
              BillingMode: "PAY_PER_REQUEST", // On-demand billing
              Tags: [
                { Key: "alchemy::app", Value: app.name },
                { Key: "alchemy::stage", Value: app.stage },
                { Key: "alchemy::id", Value: id },
              ],
            })
            .pipe(
              Effect.map((r) => r.TableDescription!),
              Effect.retry({
                while: (e) =>
                  e.name === "LimitExceededException" ||
                  e.name === "InternalServerError",
                schedule: Schedule.exponential(100),
              }),
              Effect.catchTag("ResourceInUseException", () =>
                dynamodb.describeTable({ TableName: tableName }).pipe(
                  Effect.flatMap((r) =>
                    dynamodb
                      .listTagsOfResource({
                        ResourceArn: r.Table?.TableArn!,
                      })
                      .pipe(
                        Effect.map((tags) => [r, tags.Tags] as const),
                        Effect.flatMap(([r, tags]) => {
                          if (validateTags(tagged(id), tags)) {
                            return Effect.succeed(r.Table!);
                          }
                          return Effect.fail(
                            new Error(
                              "Table tags do not match expected values",
                            ),
                          );
                        }),
                      ),
                  ),
                ),
              ),
            );

          yield* session.note(tableName);

          return {
            tableName,
            tableId: response.TableId!,
            tableArn: response.TableArn! as TableAttrs<TableProps>["tableArn"],
            partitionKey: news.partitionKey,
            sortKey: news.sortKey,
          } satisfies TableAttrs<TableProps> as TableAttrs<any>;
        }),

        update: Effect.fn(function* ({ output, session }) {
          // DynamoDB tables have limited update capabilities
          // Most changes (like key schema) require replacement
          // For now, just return the existing output
          yield* session.note(output.tableName);
          return output;
        }),

        delete: Effect.fn(function* ({ output }) {
          yield* dynamodb
            .deleteTable({
              TableName: output.tableName,
            })
            .pipe(
              //   Effect.catchTag("ResourceInUseException", () => Effect.void),
              Effect.catchTag("ResourceNotFoundException", () => Effect.void),
            );
        }),
      } satisfies ProviderService<Table<string, TableProps>>;
    }),
  );
