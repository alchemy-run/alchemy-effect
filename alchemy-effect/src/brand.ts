export type Brand<S extends string, Brand> = S & {
  __brand: Brand;
};
