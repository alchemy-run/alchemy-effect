import { $ } from "alchemy-effect";
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
    const item = yield* DynamoDB.getItem({
      table: Users,
      key: {
        id: "hello",
        name: "world",
      },
      projectionExpression: "id, name",
    }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));
    return {
      body: JSON.stringify(item?.Item ?? null),
    };
  }),
})({
  main: import.meta.filename,
  bindings: $(
    // TODO(sam): reduce union of constraints to a single policy
    DynamoDB.GetItem(Users, {
      leadingKeys: $.anyOf("hello"),
      attributes: $.anyOf("id", "name"),
    }),
  ),
}) {}

export default Api.handler.pipe(
  Effect.provide(Layer.mergeAll(SQS.clientFromEnv(), DynamoDB.clientFromEnv())),
  Lambda.toHandler,
);
