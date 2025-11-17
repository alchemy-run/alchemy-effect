import * as Effect from "effect/Effect";
import { pipe } from "effect";
import type { Resource, AnyResource } from "./resource.ts";
import type { From } from "./policy.ts";
import { Table } from "./aws/dynamodb/table.ts";
import * as Data from "effect/Data";
import type { Pipeable } from "effect/Pipeable";

// a special symbol only used at runtime to probe the Output proxy
const OutputSymbol = Symbol.for("alchemy/Output");

export const isOutput = (value: any): value is OutputProxy<any> =>
  value && OutputSymbol in value;

export const of = <R extends Resource>(
  resource: R,
): OutputProxy<R["attr"], From<R>> =>
  new ResourceExpr(resource) as unknown as OutputProxy<R["attr"], From<R>>;

// TODO(sam): doesn't support disjunct unions very well
export type OutputProxy<V, Src extends Resource = any, Req = never> = [
  Extract<Exclude<V, { __brand: unknown }>, object>,
] extends [never]
  ? [Extract<V, string | { __brand: any }>] extends [
      { __brand: unknown } | string,
    ]
    ? Output<V, Src, Req>
    : Output<V, Src, Req>
  : Output<V, Src, Req> &
      ([Extract<V, any[]>] extends [never]
        ? {
            [k in keyof Exclude<V, undefined>]-?: OutputProxy<
              Exclude<V, undefined>[k] | Extract<V, undefined>,
              Src,
              Req
            >;
          }
        : OutputProxy<
            Extract<V, any[]>[number] | Extract<V, undefined>,
            Src,
            Req
          >[]);

export interface Output<A = any, Src extends Resource = any, Req = never>
  extends Pipeable {
  map<V2>(fn: (value: A) => V2): OutputProxy<V2, Src, Req>;
  effect<V2, Req2>(
    // Outputs are not allowed to fail, so we use never for the error type
    fn: (value: A) => Effect.Effect<V2, never, Req2>,
  ): OutputProxy<V2, Src, Req | Req2>;
  narrow<T>(): OutputProxy<A & T, Src, Req>;
  as<T>(): OutputProxy<T, Src, Req>;
}

export type Expr<A = any, Src extends AnyResource = AnyResource, Req = never> =
  | ResourceExpr<A, Src, Req>
  | MapExpr<any, A, Src, Req>
  | EffectExpr<A, any, Src, Req>
  | PropExpr<A, keyof A, Src, Req>
  | ConcatExpr<Expr<A, Src, Req>[]>
  | LiteralExpr<A>;

export abstract class BaseExpr<A = any, Src extends Resource = any, Req = never>
  implements Output<A, Src, Req>
{
  declare readonly kind: string;
  declare readonly src: Src;
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
  public map<B>(fn: (value: A) => B): OutputProxy<B, Src> {
    return new MapExpr(this as Expr<A, Src, Req>, fn) as any;
  }
  public narrow<T>(): OutputProxy<A & T, Src> {
    return this as any as OutputProxy<A & T, Src>;
  }
  public as<T>(): OutputProxy<T, Src> {
    return this as any as OutputProxy<T, Src>;
  }
  public effect<B, Req2>(
    fn: (value: A) => Effect.Effect<B, never, Req2>,
  ): OutputProxy<B, Src, Req | Req2> {
    return new EffectExpr(this as any, fn) as any;
  }
  public pipe(...fns: any[]): any {
    // @ts-expect-error
    return pipe(this, ...fns);
  }
}

export const isResourceExpr = <Value, Src extends AnyResource, Req = never>(
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

export const isLiteralExpr = <A>(node: any): node is LiteralExpr<A> =>
  node.kind === "LiteralExpr";

export class LiteralExpr<A> extends BaseExpr<A, never> {
  readonly kind = "LiteralExpr";
  constructor(public readonly value: A) {
    super();
  }
}

export const isMapExpr = <In, Out, Src extends AnyResource>(
  node: any,
): node is MapExpr<In, Out, Src> => node.kind === "MapExpr";

export class MapExpr<
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

export const isConcatExpr = <Outs extends Expr[] = Expr[]>(
  node: any,
): node is ConcatExpr<Outs> => node.kind === "ConcatExpr";

export class ConcatExpr<Outs extends Expr[]> extends BaseExpr<Outs> {
  readonly kind = "ConcatExpr";
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
    } else if (isEffectExpr(expr)) {
      // TODO(sam): the same effect shoudl be memoized so that it's not run multiple times
      return yield* expr.f(yield* interpret(expr.upstream, upstream));
    } else if (isConcatExpr(expr)) {
      return yield* Effect.all(
        expr.outs.map((out) => interpret(out, upstream)),
      );
    } else if (isPropExpr(expr)) {
      return (yield* interpret(expr.upstream, upstream))?.[expr.prop];
    } else {
      return yield* Effect.die(`Invalid output node: ${JSON.stringify(expr)}`);
    }
  }) as Effect.Effect<any, MissingSourceError>;

export type Upstream<O extends Output<any, any, any>> =
  O extends Output<infer V, infer Up, infer Req>
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
    ? { [expr.src.id]: expr.src }
    : isPropExpr(expr)
      ? // TODO: we want to know specif
        upstream(expr.upstream)
      : isConcatExpr(expr)
        ? Object.assign({}, ...expr.outs.map((out) => upstream(out)))
        : isEffectExpr(expr) || isMapExpr(expr)
          ? upstream(expr.upstream)
          : {}) as Upstream<E>;

export const interpolate = <Args extends any[]>(
  template: TemplateStringsArray,
  ...args: Args
): ConcatOutputs<Args> extends Output<any, infer Src, infer Req>
  ? Output<string, Src, Req>
  : never =>
  concat(...args.map((arg) => (isOutput(arg) ? arg : literal(arg)))).map(
    (args) =>
      template
        .map((str, i) => str + (args[i] == null ? "" : String(args[i])))
        .join(""),
  ) as any;

export const concat = <Outs extends Output[]>(...outs: Outs) =>
  new ConcatExpr(outs as any) as unknown as ConcatOutputs<Outs>;

export type ConcatOutputs<Outs extends Output[]> = number extends Outs["length"]
  ? [Outs[number]] extends [Output<infer V, infer Src, infer Req>]
    ? Output<V, Src, Req>
    : never
  : ConcatOutputTuple<Outs>;

export type ConcatOutputTuple<
  Outs extends Output[],
  Values extends any[] = [],
  Src extends Resource = never,
  Req = never,
> = Outs extends [infer H, ...infer Tail extends Output[]]
  ? H extends Output<infer V, infer Src2, infer Req2>
    ? ConcatOutputTuple<Tail, [...Values, V], Src | Src2, Req | Req2>
    : never
  : Output<Values, Src, Req>;

export const filterOutputs = <Outs extends any[]>(...outs: Outs) =>
  outs.filter(isOutput) as unknown as FilterOutputs<Outs>;

export type FilterOutputs<Outs extends any[]> = number extends Outs["length"]
  ? Output<
      Extract<Outs[number], Output>["value"],
      Extract<Outs[number], Output>["src"],
      Extract<Outs[number], Output>["req"]
    >
  : FilterOutputTuple<Outs>;

export type FilterOutputTuple<
  Outs extends Output[],
  Values extends any[] = [],
  Src extends Resource = never,
> = Outs extends [infer H, ...infer Tail extends Output[]]
  ? H extends Output<infer V, infer Src2>
    ? FilterOutputTuple<Tail, [...Values, V], Src | Src2>
    : FilterOutputTuple<Tail, Values, Src>
  : Output<Values, Src>;
