import { Resource } from "../../resource.ts";

export type KVNamespaceProps = {
  title?: string;
};

export type KVNamespaceAttr<Props extends KVNamespaceProps> = {
  title: Props["title"] extends string ? Props["title"] : string;
  namespaceId: string;
  supportsUrlEncoding?: boolean;
  accountId: string;
};

export interface KVNamespace<ID extends string, Props extends KVNamespaceProps>
  extends Resource<
    "Cloudflare.KVNamespace",
    ID,
    Props,
    KVNamespaceAttr<Props>
  > {}

export const KVNamespace = Resource<{
  <const ID extends string, const Props extends KVNamespaceProps>(
    id: ID,
    props: Props,
  ): KVNamespace<ID, Props>;
}>("Cloudflare.KVNamespace");
