import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import util from "node:util";
import type { AnyBinding, SerializedBinding } from "./binding.ts";
import type { Capability } from "./capability.ts";
import type { Instance } from "./policy.ts";
import { Provider, type ProviderService } from "./provider.ts";
import type { Resource } from "./resource.ts";
import type { Service } from "./service.ts";
import { State, type ResourceState } from "./state.ts";

export type PlanError = never;

export const isBindNode = (node: any): node is BindNode => {
  return (
    node &&
    typeof node === "object" &&
    (node.action === "attach" ||
      node.action === "detach" ||
      node.action === "noop")
  );
};

/**
 * A node in the plan that represents a binding operation acting on a resource.
 */
export type BindNode<B extends AnyBinding = AnyBinding> =
  | Attach<B>
  | Detach<B>
  | NoopBind<B>;

export type Attach<B extends AnyBinding = AnyBinding> = {
  action: "attach";
  binding: B;
  olds?: SerializedBinding<B>;
  attributes: Capability.Attr<Cap>;
};

export type Detach<B extends AnyBinding = AnyBinding> = {
  action: "detach";
  binding: B;
  attributes: Capability.Attr<Cap>;
};

export type NoopBind<B extends AnyBinding = AnyBinding> = {
  action: "noop";
  binding: B;
  attributes: Capability.Attr<Cap>;
};

export const isCRUD = (node: any): node is CRUD => {
  return (
    node &&
    typeof node === "object" &&
    (node.action === "create" ||
      node.action === "update" ||
      node.action === "replace" ||
      node.action === "noop")
  );
};

/**
 * A node in the plan that represents a resource CRUD operation.
 */
export type CRUD<R extends Resource = Resource> =
  | Create<R>
  | Update<R>
  | Delete<R>
  | Replace<R>
  | NoopUpdate<R>;

export type Apply<R extends Resource> =
  | Create<R>
  | Update<R>
  | Replace<R>
  | NoopUpdate<R>;

const BaseNode = {
  action: undefined! as "create" | "update" | "replace" | "noop",
  resource: undefined! as Resource,
  toString() {
    return `${this.action.charAt(0).toUpperCase()}${this.action.slice(1)}(${this.resource})`;
  },
  [Symbol.toStringTag]() {
    return this.toString();
  },
  [util.inspect.custom]() {
    return this.toString();
  },
};

export type Create<R extends Resource> = {
  action: "create";
  resource: R;
  news: any;
  provider: ProviderService;
  attributes: R["attr"];
  bindings: BindNode[];
};

export type Update<R extends Resource> = {
  action: "update";
  resource: R;
  olds: any;
  news: any;
  output: any;
  provider: ProviderService;
  attributes: R["attr"];
  bindings: BindNode[];
};

export type Delete<R extends Resource> = {
  action: "delete";
  resource: R;
  olds: any;
  output: any;
  provider: ProviderService;
  bindings: BindNode[];
  attributes: R["attr"];
  downstream: string[];
};

export type NoopUpdate<R extends Resource> = {
  action: "noop";
  resource: R;
  attributes: R["attr"];
  bindings: BindNode[];
};

export type Replace<R extends Resource> = {
  action: "replace";
  resource: R;
  olds: any;
  news: any;
  output: any;
  provider: ProviderService;
  bindings: BindNode[];
  attributes: R["attr"];
  deleteFirst?: boolean;
};

export type Plan = {
  [id in string]: CRUD;
};

export const plan = <
  const Phase extends "update" | "destroy",
  const Services extends Service[],
>({
  phase,
  services,
}: {
  phase: Phase;
  services: Services;
}) => {
  type ServiceIDs = Services[number]["id"];
  type ServiceHosts = {
    [ID in ServiceIDs]: Extract<Services[number], Service<Extract<ID, string>>>;
  };

  type UpstreamTags = {
    [ID in ServiceIDs]: ServiceHosts[ID]["props"]["bindings"]["tags"][number];
  }[ServiceIDs];
  type UpstreamResources = {
    [ID in ServiceIDs]: Extract<
      ServiceHosts[ID]["props"]["bindings"]["capabilities"][number]["resource"],
      Resource
    >;
  }[ServiceIDs];
  type Graph = {
    [ID in ServiceIDs]: Apply<Extract<Instance<ServiceHosts[ID]>, Resource>>;
  } & {
    [ID in UpstreamResources["id"]]: Apply<
      Extract<UpstreamResources, { id: ID }>
    >;
  };

  return Effect.gen(function* () {
    const state = yield* State;

    const resourceIds = yield* state.list();
    const resourcesState = yield* Effect.all(
      resourceIds.map((id) => state.get(id)),
    );
    // map of resource ID -> its downstream dependencies (resources that depend on it)
    const downstream = resourcesState
      .filter(
        (
          resource,
        ): resource is ResourceState & {
          capabilities: SerializedBinding[];
        } => !!resource?.capabilities,
      )
      .flatMap((resource) =>
        resource.capabilities.map((cap) => [cap.resource.id, resource.id]),
      )
      .reduce(
        (acc, [id, resourceId]) => ({
          ...acc,
          [id]: [...(acc[id] ?? []), resourceId],
        }),
        {} as Record<string, string[]>,
      );

    const updates = (
      phase === "update"
        ? yield* Effect.all(
            services.map((resource) =>
              Effect.flatMap(
                resource,
                Effect.fn(function* (subgraph: {
                  [x: string]: Resource | Bound;
                }) {
                  return Object.fromEntries(
                    (yield* Effect.all(
                      Object.entries(subgraph).map(
                        Effect.fn(function* ([id, node]) {
                          const resource = isBound(node) ? node.runtime : node;
                          const news = isBound(node)
                            ? node.runtime.input
                            : resource.input;

                          const oldState = yield* state.get(id);
                          const provider: ProviderService = yield* Provider(
                            resource.parent as Resource,
                          );
                          const capabilities = diffCapabilities(
                            oldState,
                            isBound(node) ? node.runtime.capability : [],
                          );

                          if (
                            oldState === undefined ||
                            oldState.status === "creating"
                          ) {
                            return {
                              ...BaseNode,
                              action: "create",
                              news,
                              provider,
                              resource,
                              bindings: capabilities,
                              // phantom
                              attributes: undefined!,
                            } satisfies Create<Resource>;
                          } else if (provider.diff) {
                            const diff = yield* provider.diff({
                              id,
                              olds: oldState.props,
                              news,
                              output: oldState.output,
                              bindings: capabilities,
                            });
                            if (diff.action === "noop") {
                              return {
                                ...BaseNode,
                                action: "noop",
                                resource,
                                capabilities,
                                // phantom
                                attributes: undefined!,
                              };
                            } else if (diff.action === "replace") {
                              return {
                                ...BaseNode,
                                action: "replace",
                                olds: oldState.props,
                                news,
                                output: oldState.output,
                                provider,
                                resource,
                                capabilities,
                                // phantom
                                attributes: undefined!,
                              };
                            } else {
                              return {
                                ...BaseNode,
                                action: "update",
                                olds: oldState.props,
                                news,
                                output: oldState.output,
                                provider,
                                resource,
                                capabilities,
                                // phantom
                                attributes: undefined!,
                              };
                            }
                          } else if (compare(oldState, resource.input)) {
                            return {
                              ...BaseNode,
                              action: "update",
                              olds: oldState.props,
                              news,
                              output: oldState.output,
                              provider,
                              resource,
                              capabilities,
                              // phantom
                              attributes: undefined!,
                            };
                          } else {
                            return {
                              ...BaseNode,
                              action: "noop",
                              resource,
                              capabilities,
                              // phantom
                              attributes: undefined!,
                            };
                          }
                        }),
                      ),
                    )).map((update) => [update.resource.id, update]),
                  ) as Plan;
                }),
              ),
            ),
          )
        : []
    ).reduce((acc, update: any) => ({ ...acc, ...update }), {} as Plan);

    const deletions = Object.fromEntries(
      (yield* Effect.all(
        (yield* state.list()).map(
          Effect.fn(function* (id) {
            if (id in updates) {
              return;
            }
            const oldState = yield* state.get(id);
            const context = yield* Effect.context<never>();
            if (oldState) {
              const provider = context.unsafeMap.get(oldState?.type);
              if (!provider) {
                yield* Effect.die(
                  new Error(`Provider not found for ${oldState?.type}`),
                );
              }
              return [
                id,
                {
                  action: "delete",
                  olds: oldState.props,
                  output: oldState.output,
                  provider,
                  attributes: oldState?.output,
                  // TODO(sam): Support Detach Bindings
                  bindings: [],
                  resource: {
                    kind: "Resource",
                    id: id,
                    parent: undefined,
                    type: oldState.type,
                    attr: oldState.output,
                    input: oldState.props,
                  },
                  downstream: downstream[id] ?? [],
                } satisfies Delete<Resource>,
              ] as const;
            }
          }),
        ),
      )).filter((v) => !!v),
    );

    for (const [resourceId, deletion] of Object.entries(deletions)) {
      const dependencies = deletion.downstream.filter((d) => d in updates);
      if (dependencies.length > 0) {
        return yield* Effect.fail(
          new DeleteResourceHasDownstreamDependencies({
            message: `Resource ${resourceId} has downstream dependencies`,
            resourceId,
            dependencies,
          }),
        );
      }
    }

    return [updates, deletions].reduce(
      (acc, plan) => ({ ...acc, ...plan }),
      {} as any,
    );
  }) as Effect.Effect<
    {
      [ID in keyof Graph]: Graph[ID];
    },
    never,
    UpstreamTags | State
  >;
};

class DeleteResourceHasDownstreamDependencies extends Data.TaggedError(
  "DeleteResourceHasDownstreamDependencies",
)<{
  message: string;
  resourceId: string;
  dependencies: string[];
}> {}

const compare = <R extends Resource>(
  oldState: ResourceState | undefined,
  newState: R["props"],
) => JSON.stringify(oldState?.props) === JSON.stringify(newState);

const diffCapabilities = (
  oldState: ResourceState | undefined,
  caps: Capability[],
) => {
  const actions: BindNode[] = [];
  const oldCaps = oldState?.capabilities;
  const oldSids = new Set(oldCaps?.map((binding) => binding.sid));
  for (const _cap of caps) {
    const cap = _cap as any;
    const sid = cap.sid ?? `${cap.action}:${cap.resource.ID}`;
    oldSids.delete(sid);

    const oldBinding = oldCaps?.find((cap) => cap.sid === sid);
    if (!oldBinding) {
      actions.push({
        action: "attach",
        capability: cap,
        // phantom
        attributes: cap.resource.Attr as never,
      });
    } else if (isCapabilityDiff(oldBinding, cap)) {
      actions.push({
        action: "attach",
        capability: cap,
        olds: oldBinding,
        // phantom
        attributes: cap.resource.Attr as never,
      });
    }
  }
  // for (const sid of oldSids) {
  //   actions.push({
  //     action: "detach",
  //     cap: oldBindings?.find((binding) => binding.sid === sid)!,
  //   });
  // }
  return actions;
};

const isCapabilityDiff = (oldCap: SerializedBinding, newCap: Capability) =>
  oldCap.action !== newCap.action || oldCap.resource.id !== newCap.resource.id;
