import * as Context from "effect/Context";
import type { Effect } from "effect/Effect";
import type { Layer } from "effect/Layer";
import type { Capability } from "./capability.ts";
import type { Resource } from "./resource.ts";
import type { Runtime } from "./runtime.ts";

export type SerializedBinding<B extends AnyBinding = AnyBinding> = Omit<
  B,
  "resource"
> & {
  resource: {
    type: string;
    id: string;
  };
};

export interface BindingProps {
  [key: string]: any;
}

export const isBinding = (b: any): b is AnyBinding =>
  "runtime" in b && "capability" in b && "tag" in b && "output" in b;

export type AnyBinding<F extends Runtime = any> = Binding<
  F,
  any,
  any,
  string,
  boolean
>;

export interface Binding<
  Run extends Runtime,
  Cap extends Capability = Capability,
  Props = any,
  Tag extends string = Cap["type"],
  IsCustom extends boolean = Cap["type"] extends Tag ? false : true,
> {
  runtime: Run;
  capability: Cap;
  tag: Tag;
  props: Props;
  isCustom: IsCustom;
}

/** Tag for a Service that can bind a Capability to a Runtime */
export interface Bind<
  F extends Runtime,
  Cap extends Capability,
  Tag extends string,
> extends Context.Tag<
    `${F["type"]}(${Cap["type"]}, ${Tag})`,
    BindingService<
      F,
      Extract<Extract<Cap["resource"], Resource>["parent"], Resource>,
      F["props"]
    >
  > {
  /** @internal phantom */
  name: Tag;
}

export const Binding: {
  <F extends (resource: any, props?: any) => AnyBinding & { isCustom: true }>(
    runtime: ReturnType<F>["runtime"],
    resource: new () => ReturnType<F>["capability"]["resource"],
    type: ReturnType<F>["capability"]["type"],
    tag: ReturnType<F>["tag"],
  ): F & BindingDeclaration<ReturnType<F>["runtime"], F>;
  <F extends (resource: any, props?: any) => AnyBinding & { isCustom: false }>(
    runtime: ReturnType<F>["runtime"],
    resource: new () => ReturnType<F>["capability"]["resource"],
    type: ReturnType<F>["capability"]["type"],
  ): F & BindingDeclaration<ReturnType<F>["runtime"], F>;
} = (runtime: any, resource: any, type: string, tag?: string) =>
  Object.assign(
    () => {
      throw new Error(`Should never be called`);
    },
    {
      provider: {
        effect: () => {
          throw new Error(`Not implemented`);
        },
        succeed: () => {
          throw new Error(`Not implemented`);
        },
      },
    } satisfies BindingDeclaration<Runtime, any>,
  );

export interface BindingDeclaration<
  Run extends Runtime,
  F extends (target: any, props?: any) => AnyBinding<Run>,
  Tag extends string = ReturnType<F>["tag"],
  Cap extends Capability = ReturnType<F>["capability"],
> {
  provider: {
    effect<Err, Req>(
      eff: Effect<
        BindingService<Run, Parameters<F>[0], Parameters<F>[1]>,
        Err,
        Req
      >,
    ): Layer<Bind<Run, Cap, Tag>, Err, Req>;
    succeed(
      service: BindingService<Run, Parameters<F>[0], Parameters<F>[1]>,
    ): Layer<Bind<Run, Cap, Tag>>;
  };
}

export type BindingService<
  Target extends Runtime = any,
  Source extends Resource = Resource,
  Props = any,
  AttachReq = never,
  DetachReq = never,
> = {
  attach: (
    resource: {
      id: string;
      attr: Source["attr"];
      props: Source["props"];
    },
    props: Props,
    target: {
      props: Target["props"];
      attr: Target["attr"];
      binding: Target["binding"];
    },
  ) =>
    | Effect<Partial<Target["binding"]> | void, never, AttachReq>
    | Partial<Target["binding"]>
    | void;
  detach?: (
    resource: {
      id: string;
      attr: Source["attr"];
      props: Source["props"];
    },
    from: Target["binding"],
  ) => Effect<void, never, DetachReq> | void;
};
