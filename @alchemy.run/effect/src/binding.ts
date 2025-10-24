import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { Capability } from "./capability.ts";
import type { Policy } from "./policy.ts";
import type { Resource } from "./resource.ts";
import type { Runtime, RuntimeType } from "./runtime.ts";

export interface BindingProps {
  [key: string]: any;
}

export interface Binding<
  Run extends RuntimeType<string, any, any> = RuntimeType<string, any, any>,
  Cap extends Capability.Concrete = Capability.Concrete,
  BindingProps = any,
> extends Context.TagClass<
    Runtime.Binding<Run, Cap>,
    `${Cap["action"]}(${Cap["resource"]["type"]}, ${Run["type"]})`,
    BindingService<Cap["resource"], BindingProps>
  > {
  Run: Run;
  BindingProps: BindingProps;
  Cap: Cap;
}

export const Binding =
  <
    const Runtime extends string,
    Cap extends Capability.Concrete,
    Props extends BindingProps,
  >(
    Runtime: Runtime,
    Cap: Cap,
  ) =>
  <Self>(): Self =>
    Object.assign(
      Context.Tag(
        `${Cap.action}(${Cap.resource.type}, ${Runtime})` as `${Cap["action"]}(${Cap["resource"]["type"]}, ${Runtime})`,
      )<Self, BindingService<Cap["resource"], Props>>(),
      {
        Kind: "Binding",
        Capability: Cap,
      },
    ) as Self;

export type BindingService<
  R extends Resource = Resource,
  Props = any,
  AttachReq = never,
  DetachReq = never,
> = {
  attach: (
    resource: {
      id: string;
      attr: R["attr"];
      props: R["props"];
    },
    capability: Capability.Concrete,
    to: Props,
  ) => Effect.Effect<Partial<Props> | void, never, AttachReq>;
  detach?: (
    resource: {
      id: string;
      attr: R["attr"];
      props: R["props"];
    },
    capability: Capability.Concrete,
    from: Props,
  ) => Effect.Effect<void, never, DetachReq>;
};

export type Bindings = ReturnType<typeof Bindings>;

export const Bindings = <S extends any[]>(
  ...capabilities: S
): Policy<S[number]> => ({
  capabilities,
  and: <C extends Capability[]>(...caps: C): Policy<C[number] | S[number]> =>
    Bindings(...capabilities, ...caps),
});

export type $ = typeof $;
export const $ = Bindings;
