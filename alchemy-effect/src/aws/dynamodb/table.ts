import * as S from "effect/Schema";
import { Resource } from "../../resource.ts";
import type { type } from "../../type.ts";

export type AttributesSchema<Items> = {
  [k in keyof Items]?: S.Schema<ToAttribute<Items[k]>>;
};

export type ToAttribute<S> = S extends string
  ? string
  : S extends number
    ? number
    : S extends Uint8Array | Buffer | File | Blob
      ? Uint8Array
      : S;

export const Table = Resource<{
  <
    const ID extends string,
    const Items,
    const Attributes extends AttributesSchema<Items>,
    const PartitionKey extends keyof Attributes,
    const SortKey extends keyof Attributes | undefined = undefined,
  >(
    id: ID,
    props: TableProps<Items, Attributes, PartitionKey, SortKey>,
  ): Table<ID, TableProps<Items, Attributes, PartitionKey, SortKey>>;
}>("AWS.DynamoDB.Table");

export interface Table<
  ID extends string = string,
  Props extends TableProps = any,
> extends Resource<"AWS.DynamoDB.Table", ID, Props, TableAttrs<Props>> {
  Item: Props["items"];
}

export declare namespace Table {
  export type PartitionKey<T extends Table> = T["props"]["partitionKey"];
  export type SortKey<T extends Table> = T["props"]["sortKey"];
  export type Key<T extends Table> = {
    [K in PartitionKey<T>]: T["props"]["attributes"][K];
  } & SortKey<T> extends infer S extends string
    ? {
        [K in S]: T["props"]["attributes"][K];
      }
    : {};
}

export interface TableProps<
  Items = any,
  Attributes extends AttributesSchema<Items> = AttributesSchema<Items>,
  PartitionKey extends keyof Attributes = keyof Attributes,
  SortKey extends keyof Attributes | undefined = keyof Attributes | undefined,
> {
  tableName?: string;
  items: type<Items>;
  attributes: Attributes;
  partitionKey: PartitionKey;
  sortKey?: SortKey;
}

export type TableAttrs<Props extends TableProps> = {
  tableName: string;
  partitionKey: Props["partitionKey"];
  sortKey: Props["sortKey"];
};
