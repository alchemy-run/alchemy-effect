import {
  Binding,
  declare,
  Policy,
  toEnvKey,
  type Capability,
  type From,
} from "alchemy-effect";
import { Effect } from "effect";
import type { ReturnConsumedCapacity } from "itty-aws/dynamodb";
import { Function } from "../lambda/index.ts";
import { DynamoDBClient } from "./client.ts";
import type { Identifier } from "./expr.ts";
import type { ParseProjectionExpression } from "./projection.ts";
import { Table } from "./table.ts";

export interface GetItemConstraint {
  leadingKeys?: Policy.AnyOf<any>;
  attributes?: Policy.AnyOf<any>;
  returnConsumedCapacity?: Policy.AnyOf<any>;
}

export interface GetItem<
  T = Table,
  Constraint extends GetItemConstraint = GetItemConstraint,
> extends Capability<"AWS.DynamoDB.GetItem", T, Constraint> {}

export const GetItem = Binding<
  <T extends Table, const Constraint extends GetItemConstraint = never>(
    table: T,
    constraint?: Constraint,
  ) => Binding<Function, GetItem<From<T>, Constraint>>
>(Function, "AWS.DynamoDB.GetItem");

// see: https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazondynamodb.html
export const getItem = <
  T extends Table,
  const Key extends Table.Key<T>,
  const ProjectionExpression extends string = never,
  const Capacity extends ReturnConsumedCapacity = never,
>({
  table,
  key,
  projectionExpression,
  returnConsumedCapacity,
}: {
  table: T;
  key: Key;
  projectionExpression?: ProjectionExpression;
  returnConsumedCapacity?: Capacity;
}) =>
  Effect.gen(function* () {
    type Parsed = ParseProjectionExpression<ProjectionExpression>;
    type Attributes = Extract<Parsed[number], Identifier>["name"];
    // @ts-expect-error
    type LeadingKeys = Extract<Key[T["props"]["partitionKey"]], string>;
    type Constraint = Policy.Constraint<{
      leadingKeys: Policy.AnyOf<LeadingKeys>;
      attributes: Policy.AnyOf<Attributes>;
      returnConsumedCapacity: Policy.AnyOf<Capacity>;
    }>;
    yield* declare<
      GetItem<
        From<T>,
        {
          [k in keyof Constraint]: Constraint[k];
        }
      >
    >();
    const tableNameEnv = toEnvKey(table.id, "TABLE_NAME");
    const tableName = process.env[tableNameEnv];
    if (!tableName) {
      return yield* Effect.die(new Error(`${tableNameEnv} is not set`));
    }
    const ddb = yield* DynamoDBClient;
    return yield* ddb.getItem({
      TableName: tableName,
      Key: {
        [table.props.partitionKey]: {
          S: (key as any)[table.props.partitionKey] as string,
        },
        ...(table.props.sortKey
          ? {
              [table.props.sortKey]: {
                S: (key as any)[table.props.sortKey] as string,
              },
            }
          : {}),
      },
      ProjectionExpression: projectionExpression,
      ReturnConsumedCapacity: returnConsumedCapacity,
    });
  });
