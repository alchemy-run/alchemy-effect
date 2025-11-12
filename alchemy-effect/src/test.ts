import * as Effect from "effect/Effect";
import * as Console from "effect/Console";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import * as App from "./app.ts";
import * as State from "./state.ts";
import { it } from "@effect/vitest";
import { DotAlchemy, dotAlchemy } from "./dot-alchemy.ts";
import { NodeContext } from "@effect/platform-node";
import { FetchHttpClient, HttpClient, FileSystem } from "@effect/platform";
import { PlanStatusReporter } from "./apply.ts";

type Provided =
  | Scope.Scope
  | App.App
  | State.State
  | DotAlchemy
  | HttpClient.HttpClient
  | FileSystem.FileSystem;

export function test(
  name: string,
  testCase: Effect.Effect<void, any, Provided>,
  timeout: number = 120_000,
) {
  const appName = name.replaceAll(/[^a-zA-Z0-9_]/g, "-");
  const app = App.make({ name: appName, stage: "test" });

  const providers = Layer.provideMerge(
    Layer.mergeAll(State.localFs, reportProgress),
    Layer.mergeAll(app, dotAlchemy),
  );

  const layers = Layer.provideMerge(
    providers,
    Layer.mergeAll(NodeContext.layer, FetchHttpClient.layer),
  );

  return it.scoped(name, () => testCase.pipe(Effect.provide(layers)), timeout);
}

export const reportProgress = Layer.succeed(
  PlanStatusReporter,
  PlanStatusReporter.of({
    start: Effect.fn(function* (plan) {
      return {
        done: () => Effect.void,
        emit: (event) =>
          Console.log(
            event.kind === "status-change"
              ? `${event.status} ${event.id}(${event.type})`
              : event.message,
          ),
      };
    }),
  }),
);
