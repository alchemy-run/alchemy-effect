import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { type AnyBinding, type Bind } from "./binding.ts";
import type { Capability } from "./capability.ts";
import type { Runtime } from "./runtime.ts";

/**
 * A Policy binds a set of Capbilities (e.g SQS.SendMessage, SQS.Consume, etc.) to a
 * specific Runtime (e.g. AWS Lambda Function, Cloudflare Worker, etc.).
 *
 * It brings with it a set of upstream Tags containing the required Provider services
 * to deploy the infrastructure, e.g. (BindingTag<AWS.Lambda.Function, SendMessage<Queue>>)
 *
 * A Policy is invariant over the set of Capabilities to ensure least-privilege.
 */
export interface Policy<
  F extends Runtime,
  in out Capabilities,
  Tags = unknown,
> {
  readonly runtime: F;
  readonly tags: Tags[];
  readonly capabilities: Capabilities[];
  // phantom property (exists at runtime but not in types)
  // readonly bindings: AnyBinding[];
  /** Add more Capabilities to a Policy */
  and<B extends AnyBinding[]>(
    ...bindings: B
  ): Policy<F, B[number]["capability"] | Capabilities, Tags>;
}

export type $ = typeof $;
export const $ = Policy;

type BindingTags<B extends AnyBinding> = B extends any
  ? Bind<B["runtime"], B["capability"], Extract<B["tag"], string>>
  : never;

export function Policy<F extends Runtime>(): Policy<F, never, never>;
export function Policy<B extends AnyBinding[]>(
  ...capabilities: B
): Policy<
  B[number]["runtime"],
  B[number]["capability"],
  BindingTags<B[number]>
>;
export function Policy(...bindings: AnyBinding[]): any {
  return {
    runtime: bindings[0]["runtime"],
    capabilities: bindings.map((b) => b.capability),
    tags: bindings.map((b) => Context.Tag(b.tag as any)()),
    bindings,
    and: (...b2: AnyBinding[]) => Policy(...bindings, ...b2),
  } as Policy<any, any, any> & {
    // add the phantom property
    bindings: AnyBinding[];
  };
}

/** declare a Policy requiring Capabilities in some context */
export const declare = <S extends Capability>() =>
  Effect.gen(function* () {}) as Effect.Effect<void, never, S>;

export type Instance<T> = T extends { id: string }
  ? string extends T["id"]
    ? T
    : T extends new (...args: any) => infer I
      ? I
      : never
  : never;
// syntactic sugar for mapping `typeof Messages` -> Messages, e.g. so it's SQS.SendMessage<Messages> instead of SQS.SendMessage<typeof Messages>
// e.g. <Q extends SQS.Queue>(queue: Q) => SQS.SendMessage<To<Q>>
export type From<T> = Instance<T>;
export type To<T> = Instance<T>;
export type In<T> = Instance<T>;
export type Into<T> = Instance<T>;
export type On<T> = Instance<T>;
