import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { Capability } from "./capability.ts";
import type { Policy } from "./policy.ts";
import type { Resource } from "./resource.ts";
import type { Runtime } from "./runtime.ts";

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

export interface BindingProps {
  [key: string]: any;
}

export interface Binding<
  Run extends Runtime,
  Cap extends Capability = Capability,
  Output = any,
> extends Context.TagClass<
    Runtime.Binding<Run, Cap>,
    `${Cap["action"]}(${Cap["resource"]["type"]}, ${Run["type"]})`,
    BindingService<Cap["resource"], Output>
  > {
  runtime: Run;
  capability: Cap;
  output: Output;
}

export const Binding =
  <
    const Runtime extends string,
    Cap extends Capability,
    Props extends BindingProps,
  >(
    runtime: Runtime,
    capability: Cap,
  ) =>
  <Self>(): Self =>
    Object.assign(
      Context.Tag(
        `${capability.action}(${capability.resource.type}, ${runtime})` as `${Cap["action"]}(${Cap["resource"]["type"]}, ${Runtime})`,
      )<Self, BindingService<Cap["resource"], Props>>(),
      {
        Kind: "Binding",
        Capability: capability,
      },
    ) as Self;

export type BindingService<
  Target = any,
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
    to: Props,
    target: Target,
  ) => Effect.Effect<Partial<Props> | void, never, AttachReq>;
  detach?: (
    resource: {
      id: string;
      attr: R["attr"];
      props: R["props"];
    },
    from: Props,
  ) => Effect.Effect<void, never, DetachReq>;
};
