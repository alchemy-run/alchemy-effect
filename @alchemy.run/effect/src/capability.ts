export type SerializedCapability<B extends Capability = Capability> = Omit<
  B,
  "resource"
> & {
  resource: {
    type: string;
    id: string;
  };
};

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
}
