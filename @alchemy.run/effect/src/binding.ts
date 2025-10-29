import * as Context from "effect/Context";
import type { Effect } from "effect/Effect";
import type { Layer } from "effect/Layer";
import type { Capability } from "./capability.ts";
import type { Resource } from "./resource.ts";
import type { Runtime } from "./runtime.ts";

export interface BindingProps {
  [key: string]: any;
}

export const isBinding = (b: any): b is Binding<any, any, any> =>
  "runtime" in b && "capability" in b && "tag" in b && "output" in b;

export type AnyBinding<F extends Runtime = any> = Binding<F, any, any>;

export type Binding<
  Run extends Runtime,
  Cap extends Capability = Capability,
  Tag extends string = Cap["type"],
> = {
  runtime: Run;
  capability: Cap;
  tag: BindingTag<Run, Cap, Tag>;
};

export interface BindingTag<
  Run extends Runtime,
  Cap extends Capability,
  Tag extends string,
> extends Context.Tag<
    `${Run["type"]}(${Cap["type"]}, ${Tag})`,
    BindingService<
      Run,
      Extract<Extract<Cap["resource"], Resource>["parent"], Resource>,
      Run["props"]
    >
  > {
  /** @internal phantom */
  tagName: Tag;
}

export const Binding = <F extends (resource: any, props?: any) => AnyBinding>(
  runtime: ReturnType<F>["runtime"],
  resource: new () => ReturnType<F>["capability"]["resource"],
  tag: ReturnType<F>["tag"]["tagName"],
  // _tag: ReturnType<F>,
): F & BindingDeclaration<ReturnType<F>["runtime"], F> => {
  type Runtime = ReturnType<F>["runtime"];
  type Tag = ReturnType<F>["tag"];
  type Resource = new () => ReturnType<F>["capability"]["resource"];

  const handler = (() => {
    throw new Error(`Should never be called`);
  }) as unknown as F;

  return Object.assign(handler, {
    layer: {
      effect: () => {
        throw new Error(`Not implemented`);
      },
      succeed: () => {
        throw new Error(`Not implemented`);
      },
    },
  });
};

export interface BindingDeclaration<
  Run extends Runtime,
  F extends (target: any, props?: any) => Binding<Run, any>,
  Tag = ReturnType<F>["tag"],
> {
  layer: {
    effect<Err, Req>(
      eff: Effect<
        BindingService<Run["props"], Parameters<F>[0], Parameters<F>[1]>,
        Err,
        Req
      >,
    ): Layer<Tag, Err, Req>;
    succeed(
      service: BindingService<Run["props"], Parameters<F>[0], Parameters<F>[1]>,
    ): Layer<BindingService<Run["props"], Parameters<F>[0], Parameters<F>[1]>>;
  };
}

// <Self>(): Self =>
//   Object.assign(
//     Context.Tag(
//       `${capability.action}(${tag}, ${runtime})` as `${Cap["action"]}(${Tag}, ${Runtime})`,
//     )<Self, BindingService<Cap["resource"], Props>>(),
//     {
//       Kind: "Binding",
//       Capability: capability,
//     },
//   ) as Self;

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
  ) => Effect<Partial<Props> | void, never, AttachReq>;
  detach?: (
    resource: {
      id: string;
      attr: R["attr"];
      props: R["props"];
    },
    from: Props,
  ) => Effect<void, never, DetachReq>;
};
