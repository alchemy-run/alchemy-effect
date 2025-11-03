# alchemy-effect

> ⚠️ alchemy-effect is still experimental and not ready for production use (expect breaking changes).

Alchemy Effect is an **Infrastructure-as-Effects (iae)** framework that unifies business logic and Infrastructure-as-Code into a unified, type-safe model consisting of **Resources**, **Functions** and **Bindings**.

## Type-Checked, Least-Privilege IAM Policies

> [!IMPORTANT]
> <img src="./images/alchemy-effect.gif" alt="alchemy-effect demo" width="600"/>

## Resources

```ts
class Messages extends SQS.Queue("Messages", {
  fifo: true,
  schema: S.String,
}) {} 
```

## Bindings

A Binding is a connectiong between a **Resource** and a **Function**.


```ts
// Policy<Lambda.Function, SQS.SendMessage<Messages>, unknown>
class Api extends Lambda.serve("Api", {
  fetch: Effect.fn(function* (event) {
    yield* SQS.sendMessage(Messages, event.body!).pipe(
      Effect.catchAll(() => Effect.void),
    );
  }),
})({
  main: import.meta.filename,
  // 
  bindings: $(SQS.SendMessage(Messages)),
}) {}
```