import type { Resource } from "./resource.ts";
import type { Brand } from "./brand.ts";

const OutputSymbol = Symbol.for("alchemy/Output");

export const isOutput = (value: any): value is Output<any> =>
  value && OutputSymbol in value;

// TODO(sam): doesn't support disjunct unions very well
export type Output<V, Src extends Resource = any> = [
  Extract<Exclude<V, { __brand: unknown }>, object>,
] extends [never]
  ? [Extract<V, string | { __brand: any }>] extends [
      { __brand: unknown } | string,
    ]
    ? Out<V, Src>
    : Out<V, Src>
  : Out<V, Src> &
      ([Extract<V, any[]>] extends [never]
        ? {
            [k in keyof Exclude<V, undefined>]-?: Output<
              Exclude<V, undefined>[k] | Extract<V, undefined>,
              Src
            >;
          }
        : Output<Extract<V, any[]>[number] | Extract<V, undefined>, Src>[]);

export interface IOut<V = any, Src extends Resource = any> {
  kind: "out";
  value: V;
}

export interface Out<V = any, Src extends Resource = any> {
  /** @internal phantom */
  kind: "out";
  /** @internal phantom */
  src: Src;
  /** @internal phantom */
  value: V;
  map<V2>(fn: (value: V) => V2): Out<V2, Src>;
  narrow<T>(): Output<V & T, Src>;
  as<T>(): Output<T, Src>;
}

export const interpolate = <Args extends any[]>(
  template: TemplateStringsArray,
  ...args: Args
): Out<string, concatOutputs<Args>["src"]> => {
  const outs = filterOutputs(args) as unknown as Out[];
  const outputs = concatOutputs(...outs);
  return template.reduce((acc, curr, index) => {
    return acc + curr + (args[index] ?? "");
  }, "") as any;
};

export const concatOutputs = <Outs extends Out[]>(...outs: Outs) =>
  new Concat(outs) as unknown as concatOutputs<Outs>;

export const filterOutputs = <Outs extends any[]>(...outs: Outs) =>
  outs.filter(isOutput) as unknown as filterOutputs<Outs>;

type concatOutputs<Outs extends Out[]> = number extends Outs["length"]
  ? Out<Outs[number]["value"], Outs[number]["src"]>
  : concatTuple<Outs>;

type concatTuple<
  Outs extends Out[],
  Values extends any[] = [],
  Src extends Resource = never,
> = Outs extends [infer H, ...infer Tail extends Out[]]
  ? H extends Out<infer V, infer Src2>
    ? concatTuple<Tail, [...Values, V], Src | Src2>
    : never
  : Out<Values, Src>;

type filterOutputs<Outs extends any[]> = number extends Outs["length"]
  ? Out<Extract<Outs[number], Out>["value"], Extract<Outs[number], Out>["src"]>
  : filterTuple<Outs>;

type filterTuple<
  Outs extends Out[],
  Values extends any[] = [],
  Src extends Resource = never,
> = Outs extends [infer H, ...infer Tail extends Out[]]
  ? H extends Out<infer V, infer Src2>
    ? filterTuple<Tail, [...Values, V], Src | Src2>
    : filterTuple<Tail, Values, Src>
  : Out<Values, Src>;

const proxy = (self: any) =>
  new Proxy(self, {
    has: (_, prop) => (prop === OutputSymbol ? true : prop in self),
    get: (_, prop) =>
      prop === OutputSymbol
        ? true
        : prop === "map"
          ? self[prop]
          : self.map((value: any) => value[prop as keyof typeof value]),
  });

export const output = <R extends Resource>(
  resource: R,
): Output<R["attr"], R> => {
  throw new Error("Not implemented");
};

class Base<Value, Src extends Resource> {
  constructor() {
    return proxy(this);
  }
  public map<T>(fn: (value: Value) => T): Output<T, Src> {
    return new Chain(this as any, fn) as unknown as Output<T, Src>;
  }
}

export type OutputAst = Source<any, any> | Chain<any, any> | Concat<any[]>;

class Source<Value, R extends Resource> extends Base<Value, R> {
  // @ts-expect-error - phantom type
  public readonly value: Value;
  constructor(public readonly resource: R) {
    super();
  }
}

class Chain<Value, Src extends Resource> extends Base<Value, Src> {
  constructor(
    public readonly prev: Chain<Value, any>,
    public readonly fn: (value: any) => Value,
  ) {
    super();
  }
}

class Concat<Outs extends Out[]> extends Base<
  Outs[number]["value"],
  Outs[number]["src"]
> {
  constructor(public readonly outs: Outs) {
    super();
  }
}
