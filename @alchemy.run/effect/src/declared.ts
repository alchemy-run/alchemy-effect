/**
 * Represents a Resource declaration
 *
 * Example:
 * ```ts
 * class Messages extends SQS.Queue("messages", {
 *   fifo: true,
 *   schema: Message,
 * }) {}
 * ```
 * This type allows us to use inference to unpack (typeof Messages) -> Messages
 * Declared<Messages> -> Messages
 *
 * Examples:
 * ```ts
 * <Q extends Queue>(queue: Decl<Q>) => Policy.declare<SendMessage<Q>>();
 * <Q extends Queue>(queue: Decl<Q>) => FunctionBinding<SendMessage<Q>>;
 * ```
 */
export type Declared<T> = T & {
  new (): T;
};
