import {
  Binding,
  Capability,
  Provider,
  Runtime,
  Service,
} from "@alchemy.run/effect";

export const WorkerType = "AWS.Lambda.Worker";
export type WorkerType = typeof WorkerType;

export type WorkerProps = {
  name?: string;
  main: string;
  handler?: string;
  memory?: number;
  compatibilityDate?: string;
  compatibilityFlags?: string[];
  compatibility?: "node" | "browser";
  adopt?: boolean;
  observability?: {
    enabled?: boolean;
  };
  url?: boolean;
};

export type WorkerAttr<Props extends WorkerProps = WorkerProps> = {
  url: Props["url"] extends false ? undefined : string;
};

export interface Worker<svc = unknown, cap = unknown, props = WorkerProps>
  extends Runtime<WorkerType, svc, cap, props> {
  readonly Provider: WorkerProvider;
  readonly Binding: WorkerBinding<this["capability"]>;
  readonly Instance: Worker<this["service"], this["capability"], this["props"]>;
  readonly attr: WorkerAttr<Extract<this["props"], WorkerProps>>;
}
export const Worker = Runtime(WorkerType)<Worker>();

export type WorkerProvider = Provider<Worker<Service, Capability, WorkerProps>>;

export interface WorkerBinding<Cap extends Capability.Concrete>
  extends Binding<
    Worker,
    Cap,
    {
      bindings: Record<string, any>;
    }
  > {}
