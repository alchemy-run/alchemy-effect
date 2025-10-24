import { Capability } from "@alchemy.run/effect";

export interface Binding<Resource = unknown>
  extends Capability<"Cloudflare.Binding", Resource> {
  constructor: Binding;
  construct: Binding<this["instance"]>;
}
export const Binding = Capability<Binding>("Cloudflare.Binding");
