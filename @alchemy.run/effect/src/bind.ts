import * as Effect from "effect/Effect";
import type { Capability } from "./capability.ts";
import type { Runtime, RuntimeHandler } from "./runtime.ts";

export const isBound = (value: any): value is Bound =>
  value && typeof value === "object" && value.type === "bound";

export type Bound<Run extends Runtime = Runtime<string, any, any>> = {
  type: "bound";
  runtime: Run;
};

export type Bind<
  Run extends Runtime,
  ID extends string,
  Handler extends RuntimeHandler,
  Props extends Run["props"],
> = ReturnType<typeof bind<Run, ID, Handler, Props>>;

export const bind = <
  Run extends Runtime,
  const ID extends string,
  Handler extends RuntimeHandler,
  const Props extends Run["props"],
>(
  runtime: Run,
  id: ID,
  handler: Handler,
  props: Props,
) => {
  type Cap = Extract<Effect.Effect.Context<ReturnType<Handler>>, Capability>;

  type Plan = {
    [id in ID]: Bound<
      // @ts-expect-error
      (Run & { handler: Handler; cap: Cap; props: Props })["Instance"]
    >;
  } & {
    [id in Exclude<
      Extract<Cap["resource"], { id: string }>["id"],
      ID
    >]: Extract<Cap["resource"], { id: id }>;
  };

  type Providers<C extends Capability> = C extends any
    ?
        | Run["Provider"]
        | Runtime.Binding<
            Run,
            // @ts-expect-error
            Capability.Instance<C["constructor"], Cap["resource"]["parent"]>
          >
    : never;

  // oxlint-disable-next-line require-yield
  const eff = Effect.gen(function* () {
    const self = {
      ...runtime,
      id,
      handler,
      // capability: service.policy?.capabilities as any,
      parent: runtime,
      props,
    };
    return {
      ...(Object.fromEntries(
        service.policy?.capabilities.map((cap: any) => [
          cap.resource.id,
          cap.resource,
        ]) ?? [],
      ) as {
        // @ts-expect-error
        [id in Cap["resource"]["id"]]: Extract<Cap["resource"], { id: id }>;
      }),
      [service.id]: {
        runtime: self,
        type: "bound",
        toString() {
          return `${self}` as const;
        },
      },
    };
  }) as unknown as Effect.Effect<
    {
      [k in keyof Plan]: Plan[k];
    },
    never,
    // distribute over each capability class and compute Runtime<Capability<Resource.class>
    Providers<Cap>
  >;
  return Object.assign(
    class {
      static readonly props = props;
    },
    eff,
    {
      pipe: eff.pipe.bind(eff),
    },
  );
};
