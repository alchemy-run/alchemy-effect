import type { Effect } from "effect/Effect";
import type { Layer } from "effect/Layer";
import type { Provider, ProviderService } from "./provider.ts";

export interface IResource<
  Type extends string = string,
  ID extends string = string,
  Props = any,
  Attrs = any,
> {
  id: ID;
  type: Type;
  props: Props;
  attr: Attrs;
  parent: unknown;
}
export interface Resource<
  Type extends string = string,
  ID extends string = string,
  Props = unknown,
  Attrs = unknown,
> extends IResource<Type, ID, Props, Attrs> {
  // oxlint-disable-next-line no-misused-new
  new (): Resource<Type, ID, Props, Attrs>;
}

export const Resource = <Ctor extends (id: string, props: any) => Resource>(
  type: ReturnType<Ctor>["type"],
) =>
  class {
    static readonly type = type;
    constructor(id: string, props: any) {
      if (!new.target) {
        return class {
          static readonly id = id;
          static readonly type = type;
          static readonly props = props;

          readonly id = id;
          readonly type = type;
          readonly props = props;
        };
      }
    }
  } as unknown as Ctor & {
    type: ReturnType<Ctor>["type"];
    new (): ReturnType<Ctor> & {
      parent: ReturnType<Ctor>;
    };
    provider: {
      effect<Err, Req>(
        eff: Effect<ProviderService<ReturnType<Ctor>>, Err, Req>,
      ): Layer<Provider<ReturnType<Ctor>>, Err, Req>;
      succeed(
        service: ProviderService<ReturnType<Ctor>>,
      ): Layer<Provider<ReturnType<Ctor>>>;
    };
  };
