export interface Capability<
  Type extends string = string,
  Resource = unknown,
  Constraint = unknown,
> {
  type: Type;
  resource: Resource;
  constraint: Constraint;
  sid: string;
  action: string;
  label: string;
  new (): {};
}
