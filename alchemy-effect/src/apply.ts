import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type { Simplify } from "effect/Types";
import { PlanReviewer, type PlanRejected } from "./approve.ts";
import type { Capability } from "./capability.ts";
import type { ApplyEvent, ApplyStatus } from "./event.ts";
import { type BindNode, type CRUD, type Delete, type Plan } from "./plan.ts";
import type { Resource } from "./resource.ts";
import { State } from "./state.ts";

export interface PlanStatusSession {
  emit: (event: ApplyEvent) => Effect.Effect<void>;
  done: () => Effect.Effect<void>;
}

export interface ScopedPlanStatusSession extends PlanStatusSession {
  note: (note: string) => Effect.Effect<void>;
}

export class PlanStatusReporter extends Context.Tag("PlanStatusReporter")<
  PlanStatusReporter,
  {
    start(plan: Plan): Effect.Effect<PlanStatusSession, never>;
  }
>() {}

export const apply = <P extends Plan, Err, Req>(
  plan: Effect.Effect<P, Err, Req>,
) =>
  plan.pipe(
    Effect.flatMap((plan) =>
      Effect.gen(function* () {
        const state = yield* State;
        const outputs = {} as Record<string, Effect.Effect<any, any>>;
        const reviewer = yield* Effect.serviceOption(PlanReviewer);

        if (Option.isSome(reviewer)) {
          yield* reviewer.value.approve(plan);
        }

        const events = yield* Effect.serviceOption(PlanStatusReporter);

        const session = Option.isSome(events)
          ? yield* events.value.start(plan)
          : ({
              emit: () => Effect.void,
              done: () => Effect.void,
            } satisfies PlanStatusSession);
        const { emit, done } = session;

        const apply: (
          node: BindNode[] | CRUD,
        ) => Effect.Effect<any, never, never> = (node) =>
          Effect.gen(function* () {
            if (Array.isArray(node)) {
              return yield* Effect.all(
                node.map((node) => {
                  const resourceId = node.binding.capability.resource.id;
                  const resource = plan.resources[resourceId];
                  return !resource
                    ? Effect.dieMessage(`Resource ${resourceId} not found`)
                    : apply(resource);
                }),
              );
            }

            const checkpoint = <Out, Err>(
              effect: Effect.Effect<Out, Err, never>,
            ) =>
              effect.pipe(
                Effect.flatMap((output) =>
                  state
                    .set(node.resource.id, {
                      id: node.resource.id,
                      type: node.resource.type,
                      status: node.action === "create" ? "created" : "updated",
                      props: node.resource.props,
                      output,
                      bindings: node.bindings.map((binding) => ({
                        ...binding,
                        resource: {
                          type: binding.binding.capability.resource.type,
                          id: binding.binding.capability.resource.id,
                        },
                      })),
                    })
                    .pipe(Effect.map(() => output)),
                ),
              );

            const hydrate = <A extends BindNode>(bindings: Capability[]) =>
              node.bindings.map(
                (binding, i) =>
                  Object.assign(binding, {
                    attributes: bindings[i],
                  }) as A & {
                    attributes: any;
                  },
              );

            const id = node.resource.id;

            const scopedSession = {
              ...session,
              note: (note: string) =>
                session.emit({
                  id,
                  kind: "annotate",
                  message: note,
                }),
            } satisfies ScopedPlanStatusSession;

            return yield* (outputs[id] ??= yield* Effect.cached(
              Effect.gen(function* () {
                const report = (status: ApplyStatus) =>
                  emit({
                    kind: "status-change",
                    id,
                    type: node.resource.type,
                    status,
                  });

                if (node.action === "noop") {
                  return (yield* state.get(id))?.output;
                } else if (node.action === "create") {
                  const bindings = yield* apply(node.bindings);
                  yield* report("creating");
                  return yield* node.provider
                    .create({
                      id,
                      news: node.news,
                      bindings: hydrate(bindings),
                      session: scopedSession,
                    })
                    .pipe(
                      checkpoint,
                      Effect.tap(() => report("created")),
                    );
                } else if (node.action === "update") {
                  const bindings = yield* apply(node.bindings);
                  yield* report("updating");
                  return yield* node.provider
                    .update({
                      id,
                      news: node.news,
                      olds: node.olds,
                      output: node.output,
                      bindings: hydrate(bindings),
                      session: scopedSession,
                    })
                    .pipe(
                      checkpoint,
                      Effect.tap(() => report("updated")),
                    );
                } else if (node.action === "delete") {
                  yield* Effect.all(
                    node.downstream.map((dep) =>
                      dep in plan.resources
                        ? apply(
                            plan.resources[
                              dep
                            ] as P["resources"][keyof P["resources"]],
                          )
                        : Effect.void,
                    ),
                  );
                  yield* report("deleting");

                  return yield* node.provider
                    .delete({
                      id,
                      olds: node.olds,
                      output: node.output,
                      session: scopedSession,
                      bindings: [],
                    })
                    .pipe(
                      Effect.flatMap(() => state.delete(id)),
                      Effect.tap(() => report("deleted")),
                    );
                } else if (node.action === "replace") {
                  const destroy = Effect.gen(function* () {
                    yield* report("deleting");
                    return yield* node.provider.delete({
                      id,
                      olds: node.olds,
                      output: node.output,
                      session: scopedSession,
                      bindings: [],
                    });
                  });
                  const create = Effect.gen(function* () {
                    yield* report("creating");
                    return yield* (
                      node.provider
                        .create({
                          id,
                          news: node.news,
                          // TODO(sam): these need to only include attach actions
                          bindings: hydrate(yield* apply(node.bindings)),
                          session: scopedSession,
                        })
                        // TODO(sam): delete and create will conflict here, we need to extend the state store for replace
                        .pipe(
                          checkpoint,
                          Effect.tap(() => report("created")),
                        )
                    );
                  });
                  if (!node.deleteFirst) {
                    const outputs = yield* create;
                    yield* destroy;
                    return outputs;
                  } else {
                    yield* destroy;
                    return yield* create;
                  }
                }
              }),
            ));
          }) as Effect.Effect<any, never, never>;

        const nodes = [
          ...Object.entries(plan.resources),
          ...Object.entries(plan.deletions),
        ];

        const resources: any = Object.fromEntries(
          yield* Effect.all(
            nodes.map(
              Effect.fn(function* ([id, node]) {
                return [id, yield* apply(node as CRUD)];
              }),
            ),
          ),
        );
        yield* done();
        if (Object.keys(plan.resources).length === 0) {
          // all resources are deleted, return undefined
          return undefined;
        }
        return resources;
      }),
    ),
  ) as Effect.Effect<
    "update" extends P["phase"]
      ?
          | {
              [id in keyof P["resources"]]: P["resources"][id] extends
                | Delete<Resource>
                | undefined
                | never
                ? never
                : Simplify<P["resources"][id]["resource"]["attr"]>;
            }
          // union distribution isn't happening, so we gotta add this additional void here just in case
          | ("destroy" extends P["phase"] ? void : never)
      : void,
    Err | PlanRejected,
    Req
  >;
