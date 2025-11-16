import { type Instance, Policy } from "./policy.ts";
import {
  isOutput,
  type Out,
  type Output,
  output,
  concatOutputs,
  filterOutputs,
  interpolate,
} from "./output.ts";

export type $ = typeof Policy & typeof interpolate & typeof output;
export const $ = ((...args: any[]) =>
  Array.isArray(args[0])
    ? interpolate(args[0] as unknown as TemplateStringsArray, ...args.slice(1))
    : Policy(...args)) as $;
