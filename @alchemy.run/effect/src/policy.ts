import * as Effect from "effect/Effect";
import type { Capability } from "./capability.ts";

// A policy is invariant over its allowed actions
export interface Policy<in out Caps = any> {
  readonly capabilities: Caps[];
  /** Add more Capabilities to a Policy */
  and<C extends any[]>(...caps: C): Policy<C[number] | Caps>;
}

export namespace Policy {
  /** declare a Policy requiring Capabilities in some context */
  export const declare = <S extends Capability>() =>
    Effect.gen(function* () {}) as Effect.Effect<void, never, S>;
}
