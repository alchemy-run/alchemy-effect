import type * as runtime from "@cloudflare/workers-types";
import * as Effect from "effect/Effect";
import { declare, type To } from "../../policy.ts";
import { getCloudflareEnvKey } from "../context.ts";
import { Bind } from "./bucket.binding.ts";
import type { Bucket } from "./bucket.ts";

export const head = Effect.fnUntraced(function* <R2Bucket extends Bucket>(
  bucket: R2Bucket,
  key: string,
) {
  const client = yield* getBucketFromEnv(bucket);
  return yield* Effect.promise(() => client.head(key));
});

export const get = Effect.fnUntraced(function* <R2Bucket extends Bucket>(
  bucket: R2Bucket,
  key: string,
  options?: runtime.R2GetOptions,
) {
  const client = yield* getBucketFromEnv(bucket);
  return yield* Effect.promise(() => client.get(key, options));
});

export const put = Effect.fnUntraced(function* <R2Bucket extends Bucket>(
  bucket: R2Bucket,
  key: string,
  value:
    | string
    | ArrayBuffer
    | ArrayBufferView
    | null
    | runtime.Blob
    | runtime.ReadableStream,
  options?: runtime.R2PutOptions,
) {
  const client = yield* getBucketFromEnv(bucket);
  return yield* Effect.promise(() => client.put(key, value, options));
});

export const del = Effect.fnUntraced(function* <R2Bucket extends Bucket>(
  bucket: R2Bucket,
  keys: string | string[],
) {
  const client = yield* getBucketFromEnv(bucket);
  return yield* Effect.promise(() => client.delete(keys));
});

export const list = Effect.fnUntraced(function* <R2Bucket extends Bucket>(
  bucket: R2Bucket,
  options?: runtime.R2ListOptions,
) {
  const client = yield* getBucketFromEnv(bucket);
  return yield* Effect.promise(() => client.list(options));
});

export const createMultipartUpload = Effect.fnUntraced(function* <
  R2Bucket extends Bucket,
>(bucket: R2Bucket, key: string, options?: runtime.R2MultipartOptions) {
  const client = yield* getBucketFromEnv(bucket);
  return yield* Effect.promise(async () =>
    multipartUploadEffect(await client.createMultipartUpload(key, options)),
  );
});

export const resumeMultipartUpload = Effect.fnUntraced(function* <
  R2Bucket extends Bucket,
>(bucket: R2Bucket, key: string, uploadId: string) {
  const client = yield* getBucketFromEnv(bucket);
  return yield* Effect.sync(() =>
    multipartUploadEffect(client.resumeMultipartUpload(key, uploadId)),
  );
});

const getBucketFromEnv = Effect.fnUntraced(function* <R2Bucket extends Bucket>(
  bucket: R2Bucket,
) {
  yield* declare<Bind<To<R2Bucket>>>();
  return yield* getCloudflareEnvKey<runtime.R2Bucket>(bucket.id);
});

const multipartUploadEffect = (multipartUpload: runtime.R2MultipartUpload) => ({
  key: multipartUpload.key,
  uploadId: multipartUpload.uploadId,
  uploadPart: Effect.fnUntraced(function* (
    partNumber: number,
    value:
      | runtime.ReadableStream
      | (ArrayBuffer | ArrayBufferView)
      | string
      | runtime.Blob,
    options?: runtime.R2UploadPartOptions,
  ) {
    return yield* Effect.promise(() =>
      multipartUpload.uploadPart(partNumber, value, options),
    );
  }),
  abort: Effect.fnUntraced(function* () {
    return yield* Effect.promise(() => multipartUpload.abort());
  }),
  complete: Effect.fnUntraced(function* (
    uploadedParts: runtime.R2UploadedPart[],
  ) {
    return yield* Effect.promise(() => multipartUpload.complete(uploadedParts));
  }),
});
