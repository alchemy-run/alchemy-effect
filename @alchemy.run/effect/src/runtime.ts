import type { Types } from "effect";
import * as Context from "effect/Context";
import type { Effect } from "effect/Effect";
import type { Layer } from "effect/Layer";
import type { Capability } from "./capability.ts";
import type { Policy } from "./policy.ts";
import type { ProviderService } from "./provider.ts";
import type { Resource } from "./resource.ts";
import type { IService, Service } from "./service.ts";

export type RuntimeHandler<
  Inputs extends any[] = any[],
  Output = any,
  Err = any,
  Req = any,
> = (...inputs: Inputs) => Effect<Output, Err, Req>;

export declare namespace RuntimeHandler {
  export type Caps<H extends RuntimeHandler | unknown> = Extract<
    Effect.Context<ReturnType<Extract<H, RuntimeHandler>>>,
    Capability
  >;
}

export declare namespace Runtime {
  export type Binding<F, Cap> = F extends {
    readonly Binding: unknown;
  }
    ? (F & {
        readonly cap: Cap;
      })["Binding"]
    : {
        readonly F: F;
        readonly cap: Types.Contravariant<Cap>;
      };
}

export type AnyRuntime = Runtime<string>;

export interface RuntimeProps<Run extends Runtime, Req> {
  bindings: Policy<Run, Extract<Req, Capability>>;
}

export interface Runtime<
  Type extends string = string,
  Handler = unknown,
  Props = unknown,
> extends Resource<Type, string, Props, unknown> {
  type: Type;
  props: Props;
  handler: Handler;
  binding: unknown;
  /** @internal phantom */
  capability: unknown;
  new (): {};
  <
    const ID extends string,
    Inputs extends any[],
    Output,
    Err,
    Req,
    Handler extends RuntimeHandler<Inputs, Output, Err, Req>,
  >(
    id: ID,
    { handle }: { handle: Handler },
  ): <const Props extends this["props"]>(
    props: Props,
  ) => Service<ID, this, Handler, Extract<Props, RuntimeProps<this, any>>>;
}

export const Runtime =
  <const Type extends string>(type: Type) =>
  <Self extends Runtime>(): Self & {
    provider: {
      effect<Err, Req>(
        eff: Effect<ProviderService<Self>, Err, Req>,
      ): Layer<Self, Err, Req>;
      succeed(service: ProviderService<Self>): Layer<Self>;
    };
  } => {
    const self = Object.assign(
      (
        ...args:
          | [cap: Capability]
          | [
              id: string,
              { handle: (...args: any[]) => Effect<any, never, any> },
            ]
      ) => {
        if (args.length === 1) {
          const [cap] = args;
          const tag = `${type}(${cap})` as const;
          return class extends Context.Tag(tag)<Self, string>() {
            Capability = cap;
          };
        } else {
          const [id, { handle }] = args;
          return <const Props extends RuntimeProps<Self, any>>(props: Props) =>
            Object.assign(
              class {
                constructor() {
                  throw new Error("Cannot instantiate a Service directly");
                }
              },
              {
                kind: "Service",
                type,
                id,
                attr: undefined!,
                handler: handle,
                props,
                runtime: self,
                // TODO(sam): is this right?
                parent: self,
              } satisfies IService<string, Self, any, any>,
            );
        }
      },
      {
        kind: "Runtime",
        type: type,
        id: undefined! as string,
        capability: undefined! as Capability[],
        toString() {
          return `${this.type}(${this.id}${this.capability?.length ? `, ${this.capability.map((c) => `${c}`).join(", ")}` : ""})`;
        },
      },
    ) as unknown as Self;
    return self;
  };
