export interface ICapability<
  Type extends string = string,
  Resource = unknown,
  Constraint = unknown,
> {
  type: Type;
  resource: Resource;
  constraint: Constraint;
  sid: string;
  label: string;
}

export interface Capability<
  Type extends string = string,
  Resource = unknown,
  Constraint = unknown,
> extends ICapability<Type, Resource, Constraint> {
  new (): {};
}
