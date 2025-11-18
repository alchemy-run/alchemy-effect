import * as Effect from "effect/Effect";
import { pipe } from "effect";
import type { Resource, AnyResource } from "./resource.ts";
import type { From } from "./policy.ts";
import { Table } from "./aws/dynamodb/table.ts";
import * as Data from "effect/Data";
import type { Pipeable } from "effect/Pipeable";
import { isPrimitive } from "./data.ts";
import type { Input, Inputs } from "./input.ts";

// a special symbol only used at runtime to probe the Output proxy
const OutputSymbol = Symbol.for("alchemy/Output");

export const isOutput = (value: any): value is Output<any> =>
  value && OutputSymbol in value;

export const of = <R extends Resource>(
  resource: R,
): Output.Of<R["attr"], From<R>> =>
  new ResourceExpr(resource) as unknown as Output.Of<R["attr"], From<R>>;

export interface Output<A = any, Src extends Resource = any, Req = any> {
  readonly kind: "Output";
  readonly src: Src;
  readonly req: Req;
  apply<V2>(fn: (value: A) => V2): Output.Of<V2, Src, Req>;
  effect<V2, Req2>(
    // Outputs are not allowed to fail, so we use never for the error type
    fn: (value: A) => Effect.Effect<V2, never, Req2>,
  ): Output.Of<V2, Src, Req | Req2>;
}

export declare namespace Output {
  // TODO(sam): doesn't support disjunct unions very well
  export type Of<A, Src extends Resource = any, Req = never> = [
    Extract<A, object>,
  ] extends [never]
    ? [A] extends [string]
      ? String<A, Src, Req>
      : Output<A, Src, Req>
    : [A] extends [(...args: infer Args) => infer Return]
      ? (...args: Args) => Output.Of<Awaited<Return>, Src, Req>
      : [Extract<A, any[]>] extends [never]
        ? Object<A, Src, Req>
        : Array<Extract<A, any[]>, Src, Req>;
}

export type String<
  S extends string = string,
  Src extends Resource = AnyResource,
  Req = never,
> = Output<S, Src, Req> & {
  [method in keyof string]: string[method] extends (
    ...args: infer A extends any[]
  ) => infer Return
    ? <args extends Args<A>>(
        ...args: args
      ) => Output.Of<
        Return,
        Extract<args[number], Output>["src"] | Src,
        Extract<args[number], Output>["req"] | Req
      >
    : never;
};

type Args<T extends any[]> = T extends [infer H, ...infer Tail]
  ? [H | Input<H>, ...Args<Tail>]
  : [];

export type Object<A, Src extends Resource, Req = any> = Output<A, Src, Req> & {
  [Prop in keyof Exclude<A, undefined>]-?: Output.Of<
    Exclude<A, undefined>[Prop] | Extract<A, undefined>,
    Src,
    Req
  >;
};

export type Array<A extends any[], Src extends Resource, Req = any> = Output<
  Extract<A, any[]>[number] | Extract<A, undefined>,
  Src,
  Req
> & {
  [i in Extract<keyof A, number>]: Output.Of<A[i]>;
} & {
  map<B, Src2 extends AnyResource, Req2 = never>(
    fn: (value: Output.Of<A[number], Src, Req>) => Output<B, Src2, Req2>,
  ): Array<B[], Src | Src2, Req | Req2>;
  filter<Src2 extends AnyResource, Req2>(
    predicate: (
      value: Output.Of<A[number], Src, Req>,
    ) => Output<boolean, Src2, Req2>,
  ): Array<A, Src | Src2, Req | Req2>;
  flatMap<B, Src2 extends AnyResource, Req2>(
    fn: (value: Output.Of<A[number], Src, Req>) => Output<B[], Src2, Req2>,
  ): Array<B[], Src2, Req2>;
};

export const isExpr = (value: any): value is Expr<any> =>
  value && OutputSymbol in value;

export type Expr<A = any, Src extends AnyResource = AnyResource, Req = any> =
  | AllExpr<Expr<A, Src, Req>[]>
  | ApplyExpr<any, A, Src, Req>
  | CallExpr<A, any, Src, Req>
  | EffectExpr<A, any, Src, Req>
  | LiteralExpr<A>
  | PropExpr<A, keyof A, Src, Req>
  | ResourceExpr<A, Src, Req>;

export abstract class BaseExpr<A = any, Src extends Resource = any, Req = any>
  implements Output<A, Src, Req>
{
  declare readonly kind: any;
  declare readonly src: Src;
  declare readonly req: Req;
  // we use a kind tag instead of instanceof to protect ourselves from duplicate alchemy-effect module imports
  constructor() {
    return new Proxy(this, {
      has: (_, prop) => (prop === OutputSymbol ? true : prop in this),
      get: (_, prop) => {
        return prop === OutputSymbol
          ? true
          : this[prop as keyof typeof this]
            ? this[prop as keyof typeof this]
            : new PropExpr(this as Expr<A, Src, Req>, prop as keyof A);
      },
    });
  }
  public apply<B>(fn: (value: A) => B): Output.Of<B, Src> {
    return new ApplyExpr(this as Expr<A, Src, Req>, fn) as any;
  }
  public effect<B, Req2>(
    fn: (value: A) => Effect.Effect<B, never, Req2>,
  ): Output.Of<B, Src, Req | Req2> {
    return new EffectExpr(this as any, fn) as any;
  }
  public pipe(...fns: any[]): any {
    // @ts-expect-error
    return pipe(this, ...fns);
  }
}

export const isResourceExpr = <
  Value = any,
  Src extends AnyResource = AnyResource,
  Req = any,
>(
  node: Expr<Value, Src, Req> | any,
): node is ResourceExpr<Value, Src, Req> => node.kind === "ResourceExpr";

export class ResourceExpr<
  Value,
  Src extends AnyResource,
  Req = never,
> extends BaseExpr<Value, Src, Req> {
  readonly kind = "ResourceExpr";
  constructor(public readonly src: Src) {
    super();
  }
}

export const isPropExpr = <
  A = any,
  Prop extends keyof A = keyof A,
  Src extends AnyResource = AnyResource,
  Req = never,
>(
  node: any,
): node is PropExpr<A, Prop, Src, Req> => node.kind === "PropExpr";

export class PropExpr<
  A,
  Prop extends keyof A,
  Src extends AnyResource,
  Req = never,
> extends BaseExpr<A[Prop], Src, Req> {
  readonly kind = "PropExpr";
  constructor(
    public readonly upstream: Expr<A, Src, Req>,
    public readonly prop: Prop,
  ) {
    super();
  }
}

export const literal = <A>(value: A) => new LiteralExpr(value);

export const isLiteralExpr = <A = any>(node: any): node is LiteralExpr<A> =>
  node.kind === "LiteralExpr";

export class LiteralExpr<A> extends BaseExpr<A, never> {
  readonly kind = "LiteralExpr";
  constructor(public readonly value: A) {
    super();
  }
}

export const isMapExpr = <In, Out, Src extends AnyResource>(
  node: any,
): node is ApplyExpr<In, Out, Src> => node.kind === "MapExpr";

export class ApplyExpr<
  A,
  B,
  Src extends AnyResource,
  Req = never,
> extends BaseExpr<B, Src, Req> {
  readonly kind = "MapExpr";
  constructor(
    public readonly upstream: Expr<A, Src, Req>,
    public readonly f: (value: A) => B,
  ) {
    super();
  }
}

export const isEffectExpr = <In, Out, Src extends AnyResource>(
  node: any,
): node is EffectExpr<In, Out, Src> => node.kind === "EffectExpr";

export class EffectExpr<
  A,
  B,
  Src extends AnyResource,
  Req = never,
  Req2 = never,
> extends BaseExpr<B, Src, Req> {
  readonly kind = "EffectExpr";
  constructor(
    public readonly upstream: Expr<A, Src, Req>,
    public readonly f: (value: A) => Effect.Effect<B, never, Req2>,
  ) {
    super();
  }
}

export const isCallExpr = <In, Out, Src extends AnyResource>(
  node: any,
): node is CallExpr<In, Out, Src> => node.kind === "CallExpr";

export class CallExpr<
  A,
  B,
  Src extends AnyResource,
  Req = never,
> extends BaseExpr<B, Src, Req> {
  readonly kind = "CallExpr";
  constructor(
    public readonly upstream: Expr<A, Src, Req>,
    public readonly f: (value: A) => B,
  ) {
    super();
  }
}

export const isAllExpr = <Outs extends Expr[] = Expr[]>(
  node: any,
): node is AllExpr<Outs> => node.kind === "AllExpr";

export class AllExpr<Outs extends Expr[]> extends BaseExpr<Outs> {
  readonly kind = "AllExpr";
  constructor(public readonly outs: Outs) {
    super();
  }
}

export class MissingSourceError extends Data.TaggedError("MissingSourceError")<{
  message: string;
  srcId: string;
}> {}

export const interpret: <A, Upstream extends Resource, Req>(
  expr: Expr<A, Upstream, Req> | Output<A, Upstream, Req>,
  upstream: {
    [Id in Upstream["id"]]: Effect.Effect<
      Extract<Upstream, { id: Id }>["attr"]
    >;
  },
) => Effect.Effect<A, MissingSourceError> = (expr, upstream) =>
  Effect.gen(function* () {
    if (isResourceExpr(expr)) {
      const srcId = expr.src.id;
      const src = yield* upstream[srcId as keyof typeof upstream];
      if (!src) {
        // type-safety should prevenet this but let the caller decide how to handle it
        return yield* Effect.fail(
          new MissingSourceError({
            message: `Source ${srcId} not found`,
            srcId,
          }),
        );
      }
      return src;
    } else if (isLiteralExpr(expr)) {
      return expr.value;
    } else if (isMapExpr(expr)) {
      return expr.f(yield* interpret(expr.upstream, upstream));
    } else if (isCallExpr(expr)) {
      return expr.f(yield* interpret(expr.upstream, upstream));
    } else if (isEffectExpr(expr)) {
      // TODO(sam): the same effect shoudl be memoized so that it's not run multiple times
      return yield* expr.f(yield* interpret(expr.upstream, upstream));
    } else if (isAllExpr(expr)) {
      return yield* Effect.all(
        expr.outs.map((out) => interpret(out, upstream)),
      );
    } else if (isPropExpr(expr)) {
      return (yield* interpret(expr.upstream, upstream))?.[expr.prop];
    } else {
      return yield* Effect.die(`Invalid output node: ${JSON.stringify(expr)}`);
    }
  }) as Effect.Effect<any, MissingSourceError>;

export type Upstream<O extends Output<any, any, any> | Expr<any, any, any>> =
  O extends
    | Output<infer V, infer Up, infer Req>
    | Expr<infer V, infer Up, infer Req>
    ? {
        [Id in keyof Up]: Extract<Up, { id: Id }>;
      }
    : never;

export const upstream = <
  E extends Output<any, AnyResource, any> | Expr<any, AnyResource, any>,
>(
  expr: E,
): {
  [Id in keyof Upstream<E>]: Upstream<E>[Id];
} =>
  (isResourceExpr(expr)
    ? {
        [expr.src.id]: expr.src,
      }
    : isPropExpr(expr)
      ? // TODO(sam): build an AST of the upstream so we can do granular planning on properties
        // this will also require an update the ProviderService lifecycle hooks to communicate which properties may change given input changes?
        upstream(expr.upstream)
      : isAllExpr(expr)
        ? Object.assign({}, ...expr.outs.map((out) => upstream(out)))
        : isEffectExpr(expr) || isMapExpr(expr)
          ? upstream(expr.upstream)
          : {}) as Upstream<E>;

export type ResolveUpstream<A> = A extends
  | undefined
  | null
  | boolean
  | number
  | string
  | symbol
  | bigint
  ? {}
  : IsAny<A> extends true
    ? {}
    : A extends Output<any, infer Upstream, any>
      ? {
          [Id in Upstream["id"]]: Extract<Upstream, { id: Id }>;
        }
      : A extends readonly any[] | any[]
        ? ResolveUpstream<A[number]>
        : A extends Record<string, any>
          ? {
              [Id in keyof UnionToIntersection<
                ResolveUpstream<A[keyof A]>
              >]: UnionToIntersection<ResolveUpstream<A[keyof A]>>[Id];
            }
          : {};

type IsAny<T> = 0 extends 1 & T ? true : false;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void
  ? I
  : never;

export const resolveUpstream = <const A>(value: A): ResolveUpstream<A> => {
  if (isPrimitive(value)) {
    return {} as any;
  } else if (isOutput(value)) {
    return upstream(value) as any;
  } else if (Array.isArray(value)) {
    return Object.fromEntries(
      value.map((v) => resolveUpstream(v)).flatMap(Object.entries),
    ) as any;
  } else if (typeof value === "object") {
    return Object.fromEntries(
      Object.values(value as any)
        .map(resolveUpstream)
        .flatMap(Object.entries),
    ) as any;
  }
  return {} as any;
};

export const interpolate = <Args extends any[]>(
  template: TemplateStringsArray,
  ...args: Args
): All<Args> extends Output<any, infer Src, infer Req>
  ? Output<string, Src, Req>
  : never =>
  all(...args.map((arg) => (isOutput(arg) ? arg : literal(arg)))).apply(
    (args) =>
      template
        .map((str, i) => str + (args[i] == null ? "" : String(args[i])))
        .join(""),
  ) as any;

export const all = <Outs extends (Output | Expr)[]>(...outs: Outs) =>
  new AllExpr(outs as any) as unknown as All<Outs>;

export type All<Outs extends (Output | Expr)[]> = number extends Outs["length"]
  ? [Outs[number]] extends [
      | Output<infer V, infer Src, infer Req>
      | Expr<infer V, infer Src, infer Req>,
    ]
    ? Output<V, Src, Req>
    : never
  : Tuple<Outs>;

export type Tuple<
  Outs extends (Output | Expr)[],
  Values extends any[] = [],
  Src extends Resource = never,
  Req = never,
> = Outs extends [infer H, ...infer Tail extends (Output | Expr)[]]
  ? H extends Output<infer V, infer Src2, infer Req2>
    ? Tuple<Tail, [...Values, V], Src | Src2, Req | Req2>
    : never
  : Output<Values, Src, Req>;

export const filter = <Outs extends any[]>(...outs: Outs) =>
  outs.filter(isOutput) as unknown as Filter<Outs>;

export type Filter<Outs extends any[]> = number extends Outs["length"]
  ? Output<
      Extract<Outs[number], Output>["value"],
      Extract<Outs[number], Output>["src"],
      Extract<Outs[number], Output>["req"]
    >
  : FilterTuple<Outs>;

export type FilterTuple<
  Outs extends (Output | Expr)[],
  Values extends any[] = [],
  Src extends Resource = never,
> = Outs extends [infer H, ...infer Tail extends (Output | Expr)[]]
  ? H extends Output<infer V, infer Src2>
    ? FilterTuple<Tail, [...Values, V], Src | Src2>
    : FilterTuple<Tail, Values, Src>
  : Output<Values, Src>;
