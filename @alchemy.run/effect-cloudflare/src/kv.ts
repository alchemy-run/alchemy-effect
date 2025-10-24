import { Resource } from "@alchemy.run/effect";

export type KVProps = {
  title?: string;
};

export type KVAttr<Props extends KVProps> = {
  title: Props["title"] extends string ? Props["title"] : string;
  namespaceId: string;
};

export interface KV extends Resource<"Cloudflare.KV"> {
  props: KVProps;
  attr: KVAttr<this["props"]>;
}

export const KV = Resource<KV>("Cloudflare.KV");
