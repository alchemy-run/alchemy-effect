export type ResourceType = string;
export type ResourceID = string;
export type ResourceProps = Record<string, any>;
export type ResourceAttr = Record<string, any>;

export const Resource = <Self extends Resource<string>>(
  type: Self["type"],
): ResourceClass<Self> => {
  const cls = (<const ID extends string, const Props extends Self["props"]>(
    id: ID,
    props: Props,
  ) => {
    class Resource {}
    return Object.assign(Resource, {
      kind: "Resource",
      type,
      id,
      props,
      attr: undefined!,
      parent: Resource!,
    });
  }) as unknown as ResourceClass<Self>;
  return Object.assign(cls, {
    kind: "ResourceClass",
    type,
  });
};

export interface ResourceClass<R extends Resource = Resource> {
  kind: "ResourceClass";
  type: R["type"];
  props: R["props"];
  attr: R["attr"];
  resource: R;
  <const ID extends string, const Props extends R["props"]>(
    id: ID,
    props: Props,
  ): {
    type: R["type"];
    kind: "Resource";
    id: ID;
    props: Props;
    attr: {
      [a in keyof (R & { props: Props })["attr"]]: (R & {
        props: Props;
      })["attr"][a];
    };
    parent: R;
    new (
      _: never,
    ): {
      type: R["type"];
      kind: "Resource";
      parent: R;
      id: ID;
      props: Props;
      attr: {
        [a in keyof (R & { props: Props })["attr"]]: (R & {
          props: Props;
        })["attr"][a];
      };
    };
  };
}

type IsEmptyObject<T> = keyof T extends never ? true : false;

export declare namespace Resource {
  // TODO(sam): this is a mess
  export type Instance<R> = R extends { kind: "Resource" }
    ? R extends new (_: never) => infer I
      ? IsEmptyObject<I> extends true
        ? R
        : I
      : R
    : R extends {
          kind: "ResourceClass";
          resource: unknown;
        }
      ? R["resource"]
      : R extends (...args: any[]) => infer I
        ? I
        : R extends new (...args: any[]) => infer I
          ? I
          : R extends new (_: never) => infer I
            ? I
            : R;
}

export interface Resource<type extends ResourceType = ResourceType> {
  kind: "Resource";
  type: type;
  id: ResourceID;
  props: unknown;
  /** @internal phantom type */
  attr: unknown;
  parent: unknown;
  capability?: unknown;
}
