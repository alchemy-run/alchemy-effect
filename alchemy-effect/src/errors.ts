import * as Data from "effect/Data";

export class CycleDetectedError extends Data.TaggedError("CycleDetected")<{
  message: string;
  resourceId: string;
  // TODO(sam): add a trace of the Output expressions that caused the cycle
}> {}
