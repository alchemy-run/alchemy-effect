import { $, Policy } from "alchemy-effect";
import * as DynamoDB from "alchemy-effect/aws/dynamodb";
import * as Lambda from "alchemy-effect/aws/lambda";
import * as SQS from "alchemy-effect/aws/sqs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";

export class Users extends DynamoDB.Table("Users", {
  partitionKey: "id",
  sortKey: "name",
  attributes: {
    id: S.String,
    name: S.String,
  },
}) {}

export class UsersByName extends DynamoDB.SecondaryIndex("UsersByName", {
  table: Users,
  partitionKey: "name",
  sortKey: "id",
}) {}

export class Api extends Lambda.serve("Api", {
  fetch: Effect.fn(function* (event) {
    yield* DynamoDB.getItem({
      table: Users,
      key: {
        id: "hello",
        name: "world",
      },
      projectionExpression: "id, name",
    }).pipe(Effect.catchAll(() => Effect.void));

    yield* DynamoDB.getItem({
      table: Users,
      key: {
        id: "goodbye",
        name: "world",
      },
      returnConsumedCapacity: "INDEXES",
    }).pipe(Effect.catchAll(() => Effect.void));
    return undefined!;
  }),
})({
  bindings: $(
    // TODO(sam): reduce union of constraints to a single policy
    DynamoDB.GetItem(Users, {
      leadingKeys: $.anyOf("hello"),
      attributes: $.anyOf("id", "name"),
    }),
    DynamoDB.GetItem(Users, {
      leadingKeys: $.anyOf("goodbye"),
      returnConsumedCapacity: $.anyOf("INDEXES"),
    }),
  ),
  main: import.meta.filename,
}) {}

type ____ = DynamoDB.GetItem<
  Users,
  {
    readonly leadingKeys: Policy.AnyOf<"hello">;
    readonly attributes: Policy.AnyOf<"id" | "name">;
  }
> &
  DynamoDB.GetItem<
    Users,
    {
      readonly leadingKeys: Policy.AnyOf<"goodbye">;
      readonly returnConsumedCapacity: Policy.AnyOf<"INDEXES">;
    }
  >;

export default Api.handler.pipe(
  Effect.provide(Layer.mergeAll(SQS.clientFromEnv(), DynamoDB.clientFromEnv())),
  Lambda.toHandler,
);
