type IResource<Type extends string, ID extends string, Props, Attrs> = {
  id: ID;
  type: Type;
  props: Props;
  attr: Attrs;
};
export interface Resource<
  Type extends string = string,
  ID extends string = string,
  Props = unknown,
  Attrs = unknown,
> extends IResource<Type, ID, Props, Attrs> {
  // oxlint-disable-next-line no-misused-new
  new (): Resource<Type, ID, Props, Attrs>;
}

export const Resource = <Ctor extends (id: string, props: any) => Resource>(
  type: ReturnType<Ctor>["type"],
) =>
  class {
    static readonly type = type;
    constructor(id: string, props: any) {
      if (!new.target) {
        return class {
          static readonly id = id;
          static readonly type = type;
          static readonly props = props;

          readonly id = id;
          readonly type = type;
          readonly props = props;
        };
      }
    }
  } as unknown as Ctor & {
    type: ReturnType<Ctor>["type"];
    new (): ReturnType<Ctor>;
  };
