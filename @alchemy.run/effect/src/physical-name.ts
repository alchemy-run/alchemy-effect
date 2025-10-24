import * as Effect from "effect/Effect";
import { App } from "./app.ts";

export const physicalName = Effect.fn(function* (id: string) {
  const app = yield* App;
  return `${app.name}-${id}-${app.stage}`;
});
