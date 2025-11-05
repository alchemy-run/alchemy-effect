import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import type { AttributeValue } from "itty-aws/dynamodb";

// this seems important for handling S.Struct.Fields https://effect.website/docs/schema/classes/#recursive-types-with-different-encoded-and-type
// interface CategoryEncoded extends Schema.Struct.Encoded<typeof fields> { .. }

export class InvalidAttributeValue extends Data.TaggedError(
  "InvalidAttributeValue",
)<{
  message: string;
  value: any;
}> {}

export const toAttributeValue: (
  value: any,
) => Effect.Effect<AttributeValue, InvalidAttributeValue, never> = Effect.fn(
  function* (value: any) {
    if (value === undefined) {
      return {
        NULL: false,
      };
    } else if (value === null) {
      return {
        NULL: true,
      };
    } else if (typeof value === "boolean") {
      return {
        BOOL: value,
      };
    } else if (typeof value === "string") {
      return {
        S: value,
      };
    } else if (typeof value === "number") {
      return {
        N: value.toString(10),
      };
    } else if (Array.isArray(value)) {
      return {
        L: yield* Effect.all(value.map(toAttributeValue)),
      };
    } else if (value instanceof Set) {
      const setType = getType(value);
      if (setType === "EMPTY_SET") {
        return {
          SS: [],
        };
      } else if (Array.isArray(setType)) {
        return {
          L: yield* Effect.all(setType.map(toAttributeValue)),
        };
      } else if (setType === "SS") {
        return {
          SS: Array.from(value.values()),
        };
      } else if (setType === "NS") {
        return {
          NS: Array.from(value.values()),
        };
      } else if (setType === "BS") {
        return {
          BS: Array.from(value.values()),
        };
      } else {
        throw new Error(`Unknown set type: ${setType}`);
      }
    } else if (typeof value === "object") {
      return {
        M: Object.fromEntries(
          yield* Effect.all(
            Object.entries(value).map(([key, value]) =>
              toAttributeValue(value).pipe(Effect.map((value) => [key, value])),
            ),
          ),
        ),
      };
    } else if (value instanceof Uint8Array) {
      return {
        B: value,
      };
    } else if (value instanceof Buffer) {
      return {
        B: value.buffer,
      };
    } else if (value instanceof File) {
      return {
        B: new Uint8Array(yield* Effect.promise(() => value.arrayBuffer())),
      };
    }

    return yield* Effect.fail(
      new InvalidAttributeValue({
        message: `Unknown value type: ${typeof value}`,
        value,
      }),
    );
  },
);

export const fromAttributeValue = (value: AttributeValue): any => {
  if (value.NULL) {
    return null;
  } else if (value.BOOL) {
    return value.BOOL;
  } else if (value.L) {
    return value.L.map(fromAttributeValue);
  } else if (value.M) {
    return Object.fromEntries(
      Object.entries(value.M).map(([key, value]) => [
        key,
        fromAttributeValue(value),
      ]),
    );
  } else if (value.N) {
    return parseFloat(value.N);
  } else if (value.S) {
    // how do we know if this is a date?
    return value.S;
  } else if (value.SS) {
    return new Set(value.SS);
  } else if (value.NS) {
    return new Set(value.NS);
  } else if (value.BS) {
    return new Set(value.BS);
  } else {
    throw new Error(`Unknown attribute value: ${JSON.stringify(value)}`);
  }
};

type ValueType =
  | "L"
  | "BOOL"
  | "EMPTY_SET"
  | "M"
  | "NULL"
  | "N"
  | "M"
  | "S"
  | "SS"
  | "BS"
  | "NS"
  | "undefined";

const getType = (value: any): ValueType | ValueType[] => {
  if (value === undefined) {
    return "undefined";
  } else if (value === null) {
    return "NULL";
  } else if (typeof value === "boolean") {
    return "BOOL";
  } else if (typeof value === "string") {
    return "S";
  } else if (typeof value === "number") {
    return "N";
  } else if (Array.isArray(value)) {
    return "L";
  } else if (value instanceof Set) {
    return value.size === 0
      ? "EMPTY_SET"
      : (() => {
          const types = Array.from(value.values())
            .flatMap(getType)
            .filter((type, i, arr) => arr.indexOf(type) === i);

          return types.length === 1
            ? types[0] === "S"
              ? "SS"
              : types[0] === "N"
                ? "NS"
                : types[0] === "BOOL"
                  ? "BS"
                  : types[0]
            : "L";
        })();
  } else if (value instanceof Map) {
    return "M";
  } else if (typeof value === "object") {
    return "M";
  } else {
    throw new Error(`Unknown value type: ${typeof value}`);
  }
};
