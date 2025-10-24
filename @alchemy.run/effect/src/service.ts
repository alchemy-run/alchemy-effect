import * as Effect from "effect/Effect";
import type { Capability } from "./capability.ts";
import type { ResourceID } from "./resource.ts";

export type ServiceHandler = (
  ...inputs: any[]
) => Effect.Effect<any, never, unknown>;

export type Service<
  ID extends ResourceID = ResourceID,
  Handler extends ServiceHandler = ServiceHandler,
  Cap extends Capability = Capability,
> = {
  kind: "Service";
  id: ID;
  impl: Handler;
  capability: Cap;
  policy: { capabilities: Capability[] };
  new (_: never): Service<ID, Handler, Cap>;
};

export const Service = <
  const ID extends ResourceID,
  Handler extends ServiceHandler,
  Cap extends Capability = never,
>(
  id: ID,
  impl: Handler,
  policy: {
    capabilities: Capability[];
  },
  capability?: Cap,
) => {
  type HandlerEffect = ReturnType<Handler>;
  type A = Effect.Effect.Success<HandlerEffect>;
  type Err = Effect.Effect.Error<HandlerEffect>;
  type Req = Effect.Effect.Context<HandlerEffect>;

  const eff = Effect.gen(function* () {
    return impl as any;
  }) as Effect.Effect<
    (...inputs: Parameters<Handler>) => Effect.Effect<
      A,
      Err,
      // erase the requirements (move them to the outer Effect)
      never
    >,
    never,
    // erase the Capabilities from the Requirements as they are infra-only
    Req
  >;
  const svc = class {
    static readonly kind = "Service";
    static readonly id = id;
    static readonly impl = impl;
    static readonly capability = capability;
    static readonly policy = policy;

    readonly kind = "Service";
    readonly id = id;
    readonly impl = impl;
    readonly capability = capability;
    readonly policy = policy;
    constructor(_: never) {}
  } as Service<ID, Handler, Cap>;

  // const obj = Object.assign(svc, eff);
  const obj = svc;
  return Object.assign(obj, eff, {
    pipe: eff.pipe.bind(obj),
  });
};
