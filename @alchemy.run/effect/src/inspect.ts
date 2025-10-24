import type * as S from "effect/Schema";
import util from "node:util";

export const inspect = (value: any): string =>
  util.inspect(sanitize(value), {
    depth: null, // fully expand nested objects
    colors: true, // syntax coloring
    compact: true, // <-- key option: print in one line
    breakLength: Infinity, // don't wrap lines
  });

const sanitize = (value: any): any =>
  isNamedStruct(value)
    ? {
        [util.inspect.custom]: () => value.name,
      }
    : isAnonymousStruct(value)
      ? {
          [util.inspect.custom]: () =>
            `Struct(${Object.entries(value.fields)
              .map(([key, value]) => `${key}: ${value}`)
              .join(", ")})`,
        }
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value).map(([key, value]) => [key, sanitize(value)]),
          )
        : value;

const isAnonymousStruct = (value: any): value is S.Struct<S.Struct.Fields> =>
  value && typeof value === "function" && value.name === "TypeLiteralClass";

const isNamedStruct = (value: any): value is S.Struct<S.Struct.Fields> =>
  value &&
  typeof value === "function" &&
  Object.getPrototypeOf(value).name === "TypeLiteralClass";
