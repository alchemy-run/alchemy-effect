import * as Layer from "effect/Layer";
import * as Account from "./account.ts";
import * as Credentials from "./credentials.ts";
import * as IAM from "./iam.ts";
import * as Lambda from "./lambda/index.ts";
import * as Region from "./region.ts";
import * as S3 from "./s3.ts";
import * as SQS from "./sqs/index.ts";
import * as STS from "./sts.ts";

export * from "./profile.ts";

export const providers = Layer.merge(
  Layer.provide(Lambda.functionProvider(), Lambda.client()),
  Layer.provide(SQS.queueProvider(), SQS.client()),
);

export const bindings = Layer.mergeAll(
  //
  SQS.sendMessageFromLambdaFunction(),
  SQS.consumeFromLambdaFunction(),
);

export const clients = Layer.mergeAll(
  STS.client(),
  IAM.client(),
  S3.client(),
  SQS.client(),
  Lambda.client(),
);

export const defaultProviders = providers.pipe(
  Layer.provideMerge(bindings),
  Layer.provideMerge(Account.fromIdentity()),
  Layer.provide(clients),
);

export const live = defaultProviders.pipe(
  Layer.provide(Region.fromEnv()),
  Layer.provide(Credentials.fromSSO()),
);

export default live;
