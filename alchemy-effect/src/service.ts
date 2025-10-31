import type { IResource, Resource } from "./resource.ts";
import type { Runtime, RuntimeHandler, RuntimeProps } from "./runtime.ts";

export interface IService<
  ID extends string = string,
  F extends Runtime = Runtime,
  Handler extends RuntimeHandler = RuntimeHandler,
  Props extends RuntimeProps<F, any> = RuntimeProps<F, any>,
  Attr = (F & { props: Props })["attr"],
> extends IResource<F["type"], ID, Props, Attr> {
  kind: "Service";
  type: F["type"];
  id: ID;
  runtime: F;
  handler: Handler;
  props: Props;
  attr: Attr;
  parent: unknown;
}

export interface Service<
  ID extends string = string,
  F extends Runtime = Runtime,
  Handler extends RuntimeHandler = RuntimeHandler,
  Props extends RuntimeProps<F, any> = RuntimeProps<F, any>,
  Attr = (F & { props: Props })["attr"],
> extends IService<ID, F, Handler, Props, Attr>,
    Resource<F["type"], ID, Props, Attr> {}

export const isService = (resource: any): resource is IService => {
  return resource && resource.kind === "Service";
};
