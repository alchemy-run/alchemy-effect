import * as Effect from "effect/Effect";
import { type AnyBinding } from "./binding.ts";
import type { Capability } from "./capability.ts";
import type { Runtime } from "./runtime.ts";

// A policy is invariant over its allowed actions
export interface Policy<
  in out F extends Runtime,
  in out Capabilities = any,
  Tags = unknown,
> {
  readonly runtime: F;
  readonly tags: Tags[];
  readonly capabilities: Capabilities[];
  /** Add more Capabilities to a Policy */
  and<B extends AnyBinding[]>(
    ...bindings: B
  ): Policy<F, B[number]["capability"] | Capabilities, Tags>;
}

export type $ = typeof $;
export const $ = Policy;

export function Policy<F extends Runtime>(): Policy<F, never, never>;
export function Policy<B extends AnyBinding[]>(
  ...capabilities: B
): Policy<B[number]["runtime"], B[number]["capability"], B[number]["tag"]>;
export function Policy(...bindings: AnyBinding[]) {
  return {
    runtime: bindings[0]["runtime"],
    capabilities: bindings.map((b) => b.capability),
    tags: bindings.map((b) => b.tag),
    and: (...b2: AnyBinding[]) => Policy(...bindings, ...b2),
  };
}

export namespace Policy {
  /** declare a Policy requiring Capabilities in some context */
  export const declare = <S extends Capability>() =>
    Effect.gen(function* () {}) as Effect.Effect<void, never, S>;
}
