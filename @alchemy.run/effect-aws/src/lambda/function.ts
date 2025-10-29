import {
  Provider,
  Runtime,
  type RuntimeHandler,
  type RuntimeProps,
} from "@alchemy.run/effect";
import type { Context as LambdaContext } from "aws-lambda";

export interface FunctionProps<Req = any> extends RuntimeProps<Function, Req> {
  main: string;
  handler?: string;
  memory?: number;
  runtime?: "nodejs20x" | "nodejs22x";
  architecture?: "x86_64" | "arm64";
  url?: boolean;
}

export type FunctionAttr<Props extends FunctionProps = FunctionProps> = {
  functionArn: string;
  functionName: string;
  functionUrl: Props["url"] extends true ? string : undefined;
  roleName: string;
  roleArn: string;
  code: {
    hash: string;
  };
};

export interface Function<
  Handler extends
    | RuntimeHandler<[event: any, context: LambdaContext]>
    | unknown = unknown,
  Props extends FunctionProps<RuntimeHandler.Caps<Handler>> | unknown = unknown,
> extends Runtime<"AWS.Lambda.Function", Handler, Props> {
  readonly Constructor: Function;
  readonly Provider: FunctionProvider;
  readonly Instance: Function<this["handler"], this["props"]>;

  readonly attr: FunctionAttr<Extract<this["props"], FunctionProps>>;
}
export const Function = Runtime("AWS.Lambda.Function")<Function>();

export type FunctionProvider = Provider<Function>;
