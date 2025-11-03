> ⚠️ alchemy-effect is still experimental and not ready for production use (expect breaking changes).

# alchemy-effect

`alchemy-effect` is an **Infrastructure-as-Effects (iae)** framework that unifies business logic and infrastructure config into a single, type-safe program.

A program built with `alchemy-effect` is guaranteed to be configured correctly by the type system - e.g. bindings are type-checked to ensure least-privilege IAM Policies 🔐.

This example demonstrates how you receive a type error when attempting to grant excessive or missing permissions to a Lambda Function:

<img src="./images/alchemy-effect.gif" alt="alchemy-effect demo" width="600"/>

# Resources

Resources are declared along-side your business logic as classes, e.g. a FIFO SQS Queue:

```ts
class Messages extends SQS.Queue("Messages", {
  fifo: true,
  schema: S.String,
}) {} 
```

# Functions

Functions are a special kind of Resource that includes a runtime implementation function.

The function always returns an `Effect<A, Err, Req>` which is then used to infer Capabilities and type-check your Bindings.

```ts
Lambda.serve("Api", {
  fetch: Effect.fn(function* (event) {
    yield* SQS.sendMessage(Messages, event.body!).pipe(
      Effect.catchAll(() => Effect.void),
    );
  }),
})
```

# Bindings

A Binding is a connection between a **Resource** and a **Function** that satisfies a **Capability** dependency (e.g. `SQS.SendMessage`).

> [!TIP]
> Bindings are inferred from your business logic and then type-checked to ensure least-privilege IAM policies.

```ts

class Api extends Lambda.serve("Api", {
  fetch: Effect.fn(function* (event) {
    yield* SQS.sendMessage(Messages, event.body!).pipe(
      Effect.catchAll(() => Effect.void),
    );
  }),
})({
  main: import.meta.filename,
  // Policy<Lambda.Function, SQS.SendMessage<Messages>, unknown>
  bindings: $(SQS.SendMessage(Messages)),
}) {}
```

> [!NOTE]
> You may be wondering why curring `Lambda.serve(..)({ .. })` is required - this is because there's a limitation in TypeScript that prohibits `NoInfer` and `Extract` from being used together in the same function call. We hope to simplify this in the future.

