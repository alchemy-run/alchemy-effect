import util from "node:util";

import type { Types } from "effect";
import * as Context from "effect/Context";
import type { Capability } from "./capability.ts";
import type { Resource } from "./resource.ts";
import type { Service } from "./service.ts";

export interface RuntimeType<
  Type extends string = string,
  Svc = unknown,
  Cap = unknown,
  Props = unknown,
> extends Resource<Type> {
  new (_: never): {};
  type: Type;
  props: Props;
  /** @internal - we need to use `unknown` or else implicit intersections are performed, so instead we expose the mapped form */
  svc: Svc;
  service: Extract<this["svc"], Service>;
  /** @internal - we need to use `unknown` or else implicit intersections are performed, so instead we expose the mapped form */
  cap: Cap;
  capability: Extract<this["cap"], Capability.Concrete>;
}
export declare namespace Runtime {
  export type Binding<
    F extends RuntimeType<string, any, any, any>,
    Cap,
  > = F extends {
    readonly Binding: unknown;
  }
    ? (F & {
        readonly cap: Cap;
      })["Binding"]
    : {
        readonly F: F;
        readonly cap: Types.Contravariant<Cap>;
      };

  export type Provider<
    F extends RuntimeType<string, any, any, any>,
    Cap,
    Svc,
    Props,
    // @ts-expect-error
  > = (F & {
    cap: Cap;
    svc: InstanceType<Extract<Svc, Service>>;
    props: Props;
  })["Provider"];
}

export type AnyRuntime = RuntimeType<string, any, any, any>;

export interface Runtime<
  Type extends string = string,
  Svc = unknown,
  Cap = unknown,
  Props = unknown,
> extends RuntimeType<Type, Svc, Cap, Props> {
  <T>(T: T): Runtime.Binding<this, T>;
}

export const Runtime =
  <const Type extends string>(type: Type) =>
  <Self>() =>
    Object.assign(
      (cap: Capability) => {
        const tag = `${type}(${cap})` as const;
        return class extends Context.Tag(tag)<Self, string>() {
          Capability = cap;
          static toString() {
            return tag;
          }
          static [Symbol.toStringTag]() {
            return this.toString();
          }
          static [util.inspect.custom]() {
            return this.toString();
          }
        };
      },
      {
        kind: "Runtime",
        type: type,
        service: undefined! as Service,
        capability: undefined! as Capability[],
        toString() {
          return `${this.type}(${this.service?.id}${this.capability?.length ? `, ${this.capability.map((c) => `${c}`).join(", ")}` : ""})`;
        },
        [Symbol.toStringTag]() {
          return this.toString();
        },
        [util.inspect.custom]() {
          return this.toString();
        },
      },
    ) as Self;
