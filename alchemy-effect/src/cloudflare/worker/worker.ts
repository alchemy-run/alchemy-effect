import type { Workers } from "cloudflare/resources/workers/beta.mjs";
import { Runtime } from "../../runtime.ts";

export const WorkerType = "Cloudflare.Worker" as const;
export type WorkerType = typeof WorkerType;

export type WorkerProps = {
  name?: string;
  logpush?: boolean;
  observability?: Worker.Observability;
  subdomain?: Worker.Subdomain;
  tags?: string[];
  main: string;
  compatibility?: {
    date?: string;
    flags?: string[];
  };
  assets?: {
    directory: string;
    config?: Worker.AssetsConfig;
  };
  limits?: Worker.Limits;
  placement?: Worker.Placement;
};

export type WorkerAttr<Props extends WorkerProps> = {
  id: string;
  name: Props["name"] extends string ? Props["name"] : string;
  logpush: Props["logpush"] extends boolean ? Props["logpush"] : boolean;
  observability: Props["observability"] extends Worker.Observability
    ? Props["observability"]
    : Worker.Observability;
  subdomain: Props["subdomain"] extends Worker.Subdomain
    ? Props["subdomain"]
    : Worker.Subdomain;
  tags: Props["tags"] extends string[] ? Props["tags"] : string[];
  accountId: string;
};

export interface Worker extends Runtime<WorkerType> {
  props: WorkerProps;
  attr: WorkerAttr<Extract<this["props"], WorkerProps>>;
  binding: {
    bindings: Worker.Binding[];
  };
}

export const Worker = Runtime(WorkerType)<Worker>();

export declare namespace Worker {
  export type Observability = Workers.Worker.Observability;
  export type Subdomain = Workers.Worker.Subdomain;
  export type Binding = NonNullable<
    Workers.VersionCreateParams["bindings"]
  >[number];
  export type Limits = Workers.Version.Limits;
  export type Placement = Workers.Version.Placement;
  export type AssetsConfig = Workers.Version.Assets.Config;
}
