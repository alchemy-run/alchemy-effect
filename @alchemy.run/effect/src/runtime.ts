import type { Types } from "effect";
import * as Context from "effect/Context";
import type { Effect } from "effect/Effect";
import { bind, type Bind } from "./bind.ts";
import type { Capability } from "./capability.ts";
import type { Policy } from "./policy.ts";

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
> {
  type: Type;
  props: Props;
  handler: Handler;
  /** @internal phantom */
  cap: Handler extends unknown
    ? unknown
    : Extract<
        Effect.Context<ReturnType<Extract<Handler, RuntimeHandler<any>>>>,
        Capability
      >;
  capability: Extract<this["cap"], Capability>;
  Provider: unknown;
  <const ID extends string, Inputs extends any[], Output, Err, Req>(
    id: ID,
    { handle }: { handle: RuntimeHandler<Inputs, Output, Err, Req> },
  ): <const Props extends this["props"] & RuntimeProps<this, Req>>(
    props: Props,
  ) => Bind<this, ID, (...args: Inputs) => Effect<Output, Err, Req>, Props>;
}

export const Runtime =
  <const Type extends string>(type: Type) =>
  <Self extends Runtime>() => {
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
          return (<const Props extends RuntimeProps<Self, any>>(
            props: Props,
          ) => {
            return bind(
              self as Runtime,
              Service(id, handle, props.bindings as any),
              props,
            );
          }) as Self;
        }
      },
      {
        kind: "Runtime",
        type: type,
        service: undefined! as Service,
        capability: undefined! as Capability[],
        toString() {
          return `${this.type}(${this.service?.id}${this.capability?.length ? `, ${this.capability.map((c) => `${c}`).join(", ")}` : ""})`;
        },
      },
    ) as unknown as Self;
    return self;
  };
