import type { Out, Output } from "./output.ts";

type Primitive =
  | never
  | undefined
  | null
  | boolean
  | number
  | string
  | bigint
  | symbol;

export type Input<T> =
  | T
  | Output<T>
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
  export type Resolve<T, As> = Extract<_Resolve<T>, As>;
  type _Resolve<T> =
    T extends Out<infer V, any>
      ? V
      : T extends Primitive
        ? T
        : T extends any[]
          ? _Resolve<T[number]>[]
          : T extends object
            ? { [K in keyof T]: _Resolve<T[K]> }
            : never;

  export type Dependencies<T> =
    T extends Out<any, infer S>
      ? S
      : T extends Primitive
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
