import type * as S from "effect/Schema";
import type { Output, OutputProxy } from "./output.ts";

import type { AttributesSchema, TableProps } from "./aws/dynamodb/table.ts";

type Primitive =
  | never
  | undefined
  | null
  | boolean
  | number
  | string
  | bigint
  | symbol;
type Function = (...args: any[]) => any;
type Constructor = new (...args: any[]) => any;
type PolicyLike = { kind: "alchemy/Policy" };

export type Input<T> =
  | T
  | OutputProxy<T>
  | (T extends Primitive
      ? never
      : T extends any[]
        ? number extends T["length"]
          ? Input<T[number]>[]
          : Inputs<T>
        : T extends object
          ? { [K in keyof T]: Input<T[K]> }
          : never);

export declare namespace Input {
  export type Resolve<T> =
    T extends Output<infer U>
      ? U
      : T extends
            | Primitive
            | Constructor
            | Function
            | S.Schema<any>
            | PolicyLike
        ? T
        : T extends any[]
          ? ResolveArray<T>
          : T extends Record<string, any>
            ? {
                [k in keyof T]: Input.Resolve<T[k]>;
              }
            : never;

  export type ResolveArray<T extends any[]> = number extends T["length"]
    ? Resolve<T[number]>[]
    : ResolveTuple<T>;

  export type ResolveTuple<
    T extends any[],
    // TODO(sam): I added the accumulator because it resolved infinite type instantiation
    Accum extends any[] = [],
  > = T extends [infer H, ...infer Tail]
    ? ResolveTuple<Tail, [...Accum, Input.Resolve<H>]>
    : Accum;

  export type ResolveProps<Props extends Record<string, any>> = {
    [k in keyof Props]: Input.Resolve<Props[k]>;
  };

  export type ResolveOpaque<T> =
    // use true extends IsOut to avoid distribution in the case where we have an Out<T>
    // because T is a clean type, e.g. Input<SubnetProps> should just be SubnetProps (don't bother resolving the recursive input type variants)
    true extends IsOut<T> ? ResolveOut<T> : Resolve<T>;
  type IsOut<T> = T extends Output<infer U> ? true : never;

  export type ResolveOut<T> = T extends Output<infer U> ? U : never;

  export type Dependencies<T> =
    T extends Output<any, infer S>
      ? S
      : T extends
            | Primitive
            | Constructor
            | Function
            | S.Schema<any>
            | PolicyLike
        ? never
        : T extends any[]
          ? Dependencies<T[number]>
          : T extends object
            ? { [K in keyof T]: Dependencies<T[K]> }[keyof T]
            : never;
}

export type Inputs<T extends any[], Out extends any[] = []> = T extends [
  infer H,
  ...infer T,
]
  ? Inputs<T, [...Out, Input<H>]>
  : Out;
