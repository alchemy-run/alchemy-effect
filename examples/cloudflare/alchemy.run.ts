import { FetchHttpClient } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import * as Alchemy from "alchemy-effect";
import * as CLI from "alchemy-effect/cli";
import * as Cloudflare from "alchemy-effect/cloudflare";
import { Layer } from "effect";
import * as Effect from "effect/Effect";
import { Api } from "./src/api.ts";

const plan = Alchemy.plan({
  phase: process.argv.includes("--destroy") ? "destroy" : "update",
  services: [Api],
});

const app = Alchemy.app({ name: "my-app", stage: "dev-5" });

const providers = Layer.provideMerge(
  Layer.mergeAll(Cloudflare.live, Alchemy.State.localFs, CLI.layer),
  Layer.mergeAll(app, Alchemy.dotAlchemy),
);

const layers = Layer.provideMerge(
  providers,
  Layer.mergeAll(NodeContext.layer, FetchHttpClient.layer),
);

const stack = await plan.pipe(
  Effect.tap((plan) => Effect.log(plan)),
  Alchemy.apply,
  Effect.provide(layers),
  Effect.tap((stack) => Effect.log(stack?.Api.url)),
  Effect.runPromise,
);

if (stack) {
  console.log(stack.Api.url);
}
