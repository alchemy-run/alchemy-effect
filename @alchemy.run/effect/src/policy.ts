import * as Effect from "effect/Effect";
import type { Capability } from "./capability.ts";
import type { Resource } from "./resource.ts";

// in - Contravariance
// out - Covariance

// A policy is invariant over its allowed actions
export interface Policy<in out Caps extends Capability = any> {
  readonly capabilities: Caps[];
  and<C extends Capability[]>(...caps: C): Policy<C[number] | Caps>;
}

export namespace Policy {
  export const declare = <S extends Capability>() =>
    Effect.gen(function* () {}) as Effect.Effect<
      void,
      never,
      Capability.Instance<S, Resource.Instance<S["resource"]>>
    >;
}
