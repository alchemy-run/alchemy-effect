import * as Effect from "effect/Effect";
import { VpcId } from "@/aws/ec2/vpc";
import { $ } from "@/index";
import * as Output from "@/output";
import * as EC2 from "@/aws/ec2";
import { expect, it } from "@effect/vitest";
import * as R2 from "@/cloudflare/r2";
import * as Console from "effect/Console";

class TestVpc extends EC2.Vpc("TestVpc", {
  cidrBlock: "10.0.0.0/16",
}) {}

class Bucket extends R2.Bucket("Bucket", {
  name: "test-bucket",
}) {}

const vpcId = "vpc-1234567890";
const vpcAttrs = {
  vpcId,
  vpcArn: `arn:aws:ec2:us-east-1:1234567890:vpc/${vpcId}`,
  cidrBlock: "10.0.0.0/16",
  dhcpOptionsId: "dopt-1234567890",
  isDefault: false,
  ownerId: "1234567890",
  cidrBlockAssociationSet: [
    {
      associationId: "vpc-assoc-1234567890",
      cidrBlock: "10.0.0.0/16",
      cidrBlockState: {
        state: "associated",
      },
    },
  ],
  ipv6CidrBlockAssociationSet: [],
  state: "available",
} as const satisfies TestVpc["attr"];

const bucketAttrs = {
  name: "test-bucket",
  storageClass: "Standard",
  jurisdiction: "default",
  location: undefined,
  accountId: "1234567890",
} as const satisfies Bucket["attr"];

const resources = {
  TestVpc: Effect.succeed(vpcAttrs),
  Bucket: Effect.succeed(bucketAttrs),
} as const;

const output = $(TestVpc);

it.live("$(TestVpc).vpcId", () =>
  Effect.gen(function* () {
    const output = $(TestVpc).vpcId;
    const upstream = Output.upstream(output);
    const result = yield* Output.interpret(output, resources);
    expect(result).toEqual(vpcId);
    expect(upstream).toEqual({
      TestVpc,
    });
  }),
);

it.live("$(TestVpc).cidrBlockAssociationSet[0].associationId", () =>
  Effect.gen(function* () {
    // Output projection for deeply nested property
    const output = $(TestVpc).cidrBlockAssociationSet[0].associationId;
    const upstream = Output.upstream(output);
    const result = yield* Output.interpret(output, resources);

    expect(result).toEqual(vpcAttrs.cidrBlockAssociationSet[0].associationId);
    expect(upstream).toEqual({
      TestVpc,
    });
  }),
);

it.live("$(TestVpc).cidrBlockAssociationSet.map(c => c)[0].associationId", () =>
  Effect.gen(function* () {
    const output = $(TestVpc).cidrBlockAssociationSet.map((c) => c)[0]
      .associationId;
    const upstream = Output.upstream(output);
    const result = yield* Output.interpret(output, resources);

    expect(result).toEqual(vpcAttrs.cidrBlockAssociationSet[0].associationId);
    expect(upstream).toEqual({
      TestVpc,
    });
  }),
);

it.live("$(TestVpc).cidrBlockAssociationSet[1].associationId", () =>
  Effect.gen(function* () {
    // Output projection for deeply nested property
    const output = $(TestVpc).cidrBlockAssociationSet[1].associationId;
    const upstream = Output.upstream(output);
    const result = yield* Output.interpret(output, resources);

    expect(result).toEqual(undefined);
    expect(upstream).toEqual({
      TestVpc,
    });
  }),
);

it.live("$(TestVpc).cidrBlockAssociationSet.map(c => c)[1].associationId", () =>
  Effect.gen(function* () {
    const output = $(TestVpc).cidrBlockAssociationSet.map((c) => c)[1]
      .associationId;
    const upstream = Output.upstream(output);
    const result = yield* Output.interpret(output, resources);

    expect(result).toEqual(undefined);
    expect(upstream).toEqual({
      TestVpc,
    });
  }),
);

it.live("Output.of(TestVpc).vpcId", () =>
  Effect.gen(function* () {
    const output = Output.of(TestVpc).vpcId;
    const upstream = Output.upstream(output);
    const result = yield* Output.interpret(output, resources);
    expect(result).toEqual(vpcId);
    expect(upstream).toEqual({
      TestVpc,
    });
  }),
);

it.live("$(TestVpc).vpcArn.map(replace)", () =>
  Effect.gen(function* () {
    const output = $(TestVpc).vpcArn.map((vpcArn) =>
      vpcArn.replace("arn:aws:ec2:", "arn:aws:ec2:us-east-1:"),
    );
    const upstream = Output.upstream(output);
    const result = yield* Output.interpret(output, resources);
    expect(result).toEqual(
      vpcAttrs.vpcArn.replace("arn:aws:ec2:", "arn:aws:ec2:us-east-1:"),
    );
    expect(upstream).toEqual({
      TestVpc,
    });
  }),
);

it.live("Output.concat($(TestVpc).vpcArn, $(TestVpc).vpcId)", () =>
  Effect.gen(function* () {
    const output = Output.concat($(TestVpc).vpcArn, $(TestVpc).vpcId);
    const upstream = Output.upstream(output);
    const result = yield* Output.interpret(output, resources);
    expect(result).toEqual([vpcAttrs.vpcArn, vpcId]);
    expect(upstream).toEqual({
      TestVpc,
    });
  }),
);

it.live("Output.concat($(TestVpc).vpcArn, $(Bucket).name)", () =>
  Effect.gen(function* () {
    const output = Output.concat($(TestVpc).vpcArn, $(Bucket).name);
    const upstream = Output.upstream(output);
    const result = yield* Output.interpret(output, resources);
    expect(result).toEqual([vpcAttrs.vpcArn, "test-bucket"]);
    expect(upstream).toEqual({
      TestVpc,
      Bucket,
    });
  }),
);

it.live("$(TestVpc).vpcId.map(toUpperCase).map(addPrefix)", () =>
  Effect.gen(function* () {
    const output = $(TestVpc)
      .vpcId.map((id) => id.toUpperCase())
      .map((id) => `prefix-${id}`);
    const upstream = Output.upstream(output);
    const result = yield* Output.interpret(output, resources);
    expect(result).toEqual(`prefix-${vpcId.toUpperCase()}`);
    expect(upstream).toEqual({
      TestVpc,
    });
  }),
);

it.live("$(TestVpc).vpcId.effect(Console.log)", () =>
  Effect.gen(function* () {
    const output = $(TestVpc).vpcId.effect((id) =>
      Effect.sync(() => {
        // This would be Console.log in the Output.effect
        // For test visibility, perhaps stub or check side effect, but we'll just call the effect
        // @ts-ignore: In test context, Console is global
        Console.log("TestVpc.vpcId:", id);
        return `"${id}"`;
      }),
    );
    const upstream = Output.upstream(output);
    const result = yield* Output.interpret(output, resources);
    expect(result).toEqual(`"${vpcId}"`);
    expect(upstream).toEqual({
      TestVpc,
    });
  }),
);

it.live(
  "Output.interpolate`VPC: ${$(TestVpc).vpcArn} -- Bucket: ${$(Bucket).name}`",
  () =>
    Effect.gen(function* () {
      const output = Output.interpolate`VPC: ${$(TestVpc).vpcArn} -- Bucket: ${$(Bucket).name}`;
      const upstream = Output.upstream(output);
      const result = yield* Output.interpret(output, resources);
      expect(result).toEqual(
        `VPC: ${vpcAttrs.vpcArn} -- Bucket: ${bucketAttrs.name}`,
      );
      expect(upstream).toEqual({
        TestVpc,
        Bucket,
      });
    }),
);
