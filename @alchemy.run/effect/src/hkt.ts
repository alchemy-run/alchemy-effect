import type * as HKT from "effect/HKT";

export type Kind<Class extends HKT.TypeLambda, A> = HKT.Kind<
  Class,
  unknown, // (most general input type)
  never, // (most general output)
  never,
  A // invariant target
>;
