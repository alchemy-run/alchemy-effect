import * as Context from "effect/Context";

import { DynamoDB } from "itty-aws/dynamodb";
import { createAWSServiceClientLayer } from "../client.ts";

export class DynamoDBClient extends Context.Tag("AWS::DynamoDB::Client")<
  DynamoDBClient,
  DynamoDB
>() {}

export const client = createAWSServiceClientLayer<
  typeof DynamoDBClient,
  DynamoDB
>(DynamoDBClient, DynamoDB);
