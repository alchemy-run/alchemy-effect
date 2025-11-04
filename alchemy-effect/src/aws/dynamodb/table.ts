import * as S from "effect/Schema";
import { Resource } from "../../resource.ts";

export const Table = Resource<{
  <
    const ID extends string,
    const Attributes extends S.Struct.Fields,
    const PartitionKey extends keyof Attributes,
    const SortKey extends keyof Attributes | undefined = undefined,
  >(
    id: ID,
    props: TableProps<Attributes, PartitionKey, SortKey>,
  ): Table<ID, TableProps<Attributes, PartitionKey, SortKey>>;
}>("AWS.DynamoDB.Table");

export interface Table<
  ID extends string = string,
  Props extends TableProps = TableProps,
> extends Resource<"AWS.DynamoDB.Table", ID, Props, TableAttrs<Props>> {}

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
  Attributes extends S.Struct.Fields = S.Struct.Fields,
  PartitionKey extends keyof Attributes = keyof Attributes,
  SortKey extends keyof Attributes | undefined = keyof Attributes | undefined,
> {
  tableName?: string;
  attributes: Attributes;
  partitionKey: PartitionKey;
  sortKey?: SortKey;
}

export type TableAttrs<Props extends TableProps> = {
  tableName: string;
  partitionKey: Props["partitionKey"];
  sortKey: Props["sortKey"];
};
