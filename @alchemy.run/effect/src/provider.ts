import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { ScopedPlanStatusSession } from "./apply.ts";
import type { BindNode } from "./plan.ts";
import type { Resource, ResourceClass } from "./resource.ts";
import type { AnyRuntime } from "./runtime.ts";

export type Provider<R extends Resource> = Context.TagClass<
  Provider<R>,
  R["type"],
  ProviderService<R>
>;
export const Provider = <R extends ResourceClass | AnyRuntime | Resource>(
  R: R,
) => {
  return Context.Tag(R.type)() as Provider<Resource.Instance<R>>;
};

export type Diff =
  | {
      action: "update" | "noop";
      deleteFirst?: undefined;
    }
  | {
      action: "replace";
      deleteFirst?: boolean;
    };

export interface ProviderService<Res extends Resource = Resource> {
  // tail();
  // watch();
  // replace(): Effect.Effect<void, never, never>;
  read?(input: {
    id: string;
    olds: Res["props"] | undefined;
    // what is the ARN?
    output: Res["attr"] | undefined; // current state -> synced state
    // TODO(sam): remove the below items from the API
    bindings: BindNode[];
    session: ScopedPlanStatusSession;
  }): Effect.Effect<Res["attr"] | undefined, any, never>;
  diff?(input: {
    id: string;
    olds: Res["props"];
    news: Res["props"];
    output: Res["attr"];
    // TODO(sam): remove the below items from the API
    bindings: BindNode[];
  }): Effect.Effect<Diff, never, never>;
  stub?(input: {
    id: string;
    news: Res["props"];
    // TODO(sam): remove the below items from the API
    bindings: BindNode[];
    session: ScopedPlanStatusSession;
  }): Effect.Effect<Res["attr"], any, never>;
  create(input: {
    id: string;
    news: Res["props"];
    // TODO(sam): remove the below items from the API
    bindings: BindNode[];
    session: ScopedPlanStatusSession;
  }): Effect.Effect<Res["attr"], any, never>;
  update(input: {
    id: string;
    news: Res["props"];
    olds: Res["props"];
    output: Res["attr"];
    // TODO(sam): remove the below items from the API
    bindings: BindNode[];
    session: ScopedPlanStatusSession;
  }): Effect.Effect<Res["attr"], any, never>;
  delete(input: {
    id: string;
    olds: Res["props"];
    output: Res["attr"];
    // TODO(sam): remove the below items from the API
    bindings: BindNode[];
    session: ScopedPlanStatusSession;
  }): Effect.Effect<void, any, never>;
}
