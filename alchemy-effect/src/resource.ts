import * as Context from "effect/Context";
import type { Effect } from "effect/Effect";
import * as Layer from "effect/Layer";
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
  provider: {
    tag: Context.TagClass<Provider<Resource>, Type, ProviderService<Resource>>;
    effect<Err, Req>(
      eff: Effect<ProviderService<Resource>, Err, Req>,
    ): Layer.Layer<Provider<Resource>, Err, Req>;
    succeed(
      service: ProviderService<Resource>,
    ): Layer.Layer<Provider<Resource>>;
  };
}

export const Resource = <Ctor extends (id: string, props: any) => Resource>(
  type: ReturnType<Ctor>["type"],
) => {
  const Tag = Context.Tag(type)();

  return Object.assign(
    function (id: string, props: any) {
      return class Resource {
        static readonly id = id;
        static readonly type = type;
        static readonly props = props;

        static readonly provider = {
          tag: Tag,
          effect: <Err, Req>(
            eff: Effect<ProviderService<ReturnType<Ctor>>, Err, Req>,
          ) => Layer.effect(Tag, eff),
          succeed: (service: ProviderService<ReturnType<Ctor>>) =>
            Layer.succeed(Tag, service),
        };

        readonly id = id;
        readonly type = type;
        readonly props = props;
      };
    } as unknown as Ctor & {
      type: ReturnType<Ctor>["type"];
      new (): ReturnType<Ctor> & {
        parent: ReturnType<Ctor>;
      };
      provider: {
        tag: typeof Tag;
        effect<Err, Req>(
          eff: Effect<ProviderService<ReturnType<Ctor>>, Err, Req>,
        ): Layer.Layer<Provider<ReturnType<Ctor>>, Err, Req>;
        succeed(
          service: ProviderService<ReturnType<Ctor>>,
        ): Layer.Layer<Provider<ReturnType<Ctor>>>;
      };
    },
    {
      type: type,
      provider: {
        tag: Tag,
        effect: <Err, Req>(
          eff: Effect<ProviderService<ReturnType<Ctor>>, Err, Req>,
        ) => Layer.effect(Tag, eff),
        succeed: (service: ProviderService<ReturnType<Ctor>>) =>
          Layer.succeed(Tag, service),
      } as const,
    },
  );
};
