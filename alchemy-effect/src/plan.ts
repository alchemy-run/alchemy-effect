import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import type { AnyBinding } from "./binding.ts";
import type { Capability } from "./capability.ts";
import type { Phase } from "./phase.ts";
import type { Instance } from "./policy.ts";
import { type ProviderService } from "./provider.ts";
import type { IResource, Resource } from "./resource.ts";
import { isService, type Service } from "./service.ts";
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
  olds?: BindNode;
};

export type Detach<B extends AnyBinding = AnyBinding> = {
  action: "detach";
  binding: B;
};

export type NoopBind<B extends AnyBinding = AnyBinding> = {
  action: "noop";
  binding: B;
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
export type CRUD<R extends IResource = IResource> =
  | Create<R>
  | Update<R>
  | Delete<R>
  | Replace<R>
  | NoopUpdate<R>;

export type Apply<R extends IResource = IResource> =
  | Create<R>
  | Update<R>
  | Replace<R>
  | NoopUpdate<R>;

const Node = <T extends Apply>(node: T) => ({
  ...node,
  toString(): string {
    return `${this.action.charAt(0).toUpperCase()}${this.action.slice(1)}(${this.resource})`;
  },
  [Symbol.toStringTag]() {
    return this.toString();
  },
});

export type Create<R extends IResource> = {
  action: "create";
  resource: R;
  news: any;
  provider: ProviderService;
  attributes: R["attr"];
  bindings: BindNode[];
};

export type Update<R extends IResource> = {
  action: "update";
  resource: R;
  olds: any;
  news: any;
  output: any;
  provider: ProviderService;
  attributes: R["attr"];
  bindings: BindNode[];
};

export type Delete<R extends IResource> = {
  action: "delete";
  resource: R;
  olds: any;
  output: any;
  provider: ProviderService;
  bindings: BindNode[];
  attributes: R["attr"];
  downstream: string[];
};

export type NoopUpdate<R extends IResource> = {
  action: "noop";
  resource: R;
  attributes: R["attr"];
  bindings: BindNode[];
};

export type Replace<R extends IResource> = {
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
  phase: Phase;
  resources: {
    [id in string]: CRUD;
  };
  deletions: {
    [id in string]?: Delete<Resource>;
  };
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
  type Resources = {
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
          bindings: BindNode[];
        } => !!resource?.bindings,
      )
      .flatMap((resource) =>
        resource.bindings.map(({ binding }) => [
          binding.capability.resource.id,
          binding.capability.resource,
        ]),
      )
      .reduce(
        (acc, [id, resourceId]) => ({
          ...acc,
          [id]: [...(acc[id] ?? []), resourceId],
        }),
        {} as Record<string, string[]>,
      );

    const resources =
      phase === "update"
        ? (Object.fromEntries(
            (yield* Effect.all(
              services
                .flatMap((service) => [
                  ...service.props.bindings.capabilities.map(
                    (cap: Capability) => cap.resource as Resource,
                  ),
                  service,
                ])
                .filter(
                  (node, i, arr) =>
                    arr.findIndex((n) => n.id === node.id) === i,
                )
                .map(
                  Effect.fn(function* (node) {
                    const id = node.id;
                    const resource = node;
                    const news = isService(node)
                      ? node.runtime.props
                      : resource.props;

                    const oldState = yield* state.get(id);
                    const provider = yield* resource.provider.tag;

                    const bindings = diffBindings(
                      oldState,
                      isService(node)
                        ? (
                            node.props.bindings as unknown as {
                              bindings: AnyBinding[];
                            }
                          ).bindings
                        : [],
                    );

                    if (
                      oldState === undefined ||
                      oldState.status === "creating"
                    ) {
                      return Node<Create<Resource>>({
                        action: "create",
                        news,
                        provider,
                        resource,
                        bindings,
                        // phantom
                        attributes: undefined!,
                      });
                    } else if (provider.diff) {
                      const diff = yield* provider.diff({
                        id,
                        olds: oldState.props,
                        news,
                        output: oldState.output,
                      });
                      if (diff.action === "noop") {
                        return Node<NoopUpdate<Resource>>({
                          action: "noop",
                          resource,
                          bindings,
                          // phantom
                          attributes: undefined!,
                        });
                      } else if (diff.action === "replace") {
                        return Node<Replace<Resource>>({
                          action: "replace",
                          olds: oldState.props,
                          news,
                          output: oldState.output,
                          provider,
                          resource,
                          bindings,
                          // phantom
                          attributes: undefined!,
                        });
                      } else {
                        return Node<Update<Resource>>({
                          action: "update",
                          olds: oldState.props,
                          news,
                          output: oldState.output,
                          provider,
                          resource,
                          bindings,
                          // phantom
                          attributes: undefined!,
                        });
                      }
                    } else if (compare(oldState, resource.props)) {
                      return Node<Update<Resource>>({
                        action: "update",
                        olds: oldState.props,
                        news,
                        output: oldState.output,
                        provider,
                        resource,
                        bindings,
                        // phantom
                        attributes: undefined!,
                      });
                    } else {
                      return Node<NoopUpdate<Resource>>({
                        action: "noop",
                        resource,
                        bindings,
                        // phantom
                        attributes: undefined!,
                      });
                    }
                  }),
                ),
            )).map((update) => [update.resource.id, update]),
          ) as Plan["resources"])
        : ({} as Plan["resources"]);

    const deletions = Object.fromEntries(
      (yield* Effect.all(
        (yield* state.list()).map(
          Effect.fn(function* (id) {
            if (id in resources) {
              return;
            }
            const oldState = yield* state.get(id);
            const context = yield* Effect.context<never>();
            if (oldState) {
              const provider: ProviderService = context.unsafeMap.get(
                oldState?.type,
              );
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
                    id: id,
                    parent: undefined,
                    type: oldState.type,
                    attr: oldState.output,
                    props: oldState.props,
                  } satisfies IResource as Resource,
                  downstream: downstream[id] ?? [],
                } satisfies Delete<Resource>,
              ] as const;
            }
          }),
        ),
      )).filter((v) => !!v),
    );

    for (const [resourceId, deletion] of Object.entries(deletions)) {
      const dependencies = deletion.downstream.filter((d) => d in resources);
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

    return {
      phase,
      resources,
      deletions,
    } satisfies Plan as Plan;
  }) as Effect.Effect<
    {
      phase: Phase;
      resources: {
        [ID in keyof Resources]: Resources[ID];
      };
      deletions: {
        [id in Exclude<string, keyof Resources>]?: Delete<Resource>;
      };
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

const diffBindings = (
  oldState: ResourceState | undefined,
  bindings: AnyBinding[],
) => {
  const actions: BindNode[] = [];
  const oldBindings = oldState?.bindings;
  const oldSids = new Set(
    oldBindings?.map(({ binding }) => binding.capability.sid),
  );
  for (const binding of bindings) {
    const cap = binding.capability;
    const sid = cap.sid ?? `${cap.action}:${cap.resource.ID}`;
    oldSids.delete(sid);

    const oldBinding = oldBindings?.find(
      ({ binding }) => binding.capability.sid === sid,
    );
    if (!oldBinding) {
      actions.push({
        action: "attach",
        binding,
      });
    } else if (isBindingDiff(oldBinding, binding)) {
      actions.push({
        action: "attach",
        binding,
        olds: oldBinding,
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

const isBindingDiff = (
  { binding: oldBinding }: BindNode,
  newBinding: AnyBinding,
) =>
  oldBinding.capability.action !== newBinding.capability.action ||
  oldBinding.capability.resource.id !== newBinding.capability.resource.id;
// TODO(sam): compare props
// oldBinding.props !== newBinding.props;
