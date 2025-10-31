import * as Alchemy from "@alchemy.run/effect";
import * as AWS from "@alchemy.run/effect-aws";
import * as AlchemyCLI from "@alchemy.run/effect-cli";
import { FetchHttpClient } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import { Api } from "./src/index.ts";

const phase = process.argv.includes("--destroy") ? "destroy" : "update";

const plan = Alchemy.plan({
  phase,
  // phase: "update",
  // phase: "destroy",
  services: [Api],
});

const stack = await plan.pipe(
  Alchemy.apply,
  Effect.catchTag("PlanRejected", () => Effect.die("Plan rejected")),
  Effect.provide(AlchemyCLI.layer),
  Effect.provide(AWS.live),
  Effect.provide(Alchemy.State.localFs),
  Effect.provide(Alchemy.dotAlchemy),
  Effect.provide(Alchemy.app({ name: "my-iae-app", stage: "dev" })),
  Effect.provide(NodeContext.layer),
  Effect.provide(FetchHttpClient.layer),
  Effect.tap((stack) => Effect.log(stack?.Api.functionUrl)),
  Effect.runPromiseExit,
);

if (stack) {
  // Effect.log(stack?.Api.functionUrl);
}
