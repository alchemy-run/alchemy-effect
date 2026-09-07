import { expect, test } from "bun:test";
import {
  formatPullRequest,
  parsePullRequest,
  shouldRenewOnTtl,
} from "../src/PullRequest.ts";

test("parsePullRequest accepts owner/repo#number and GitHub URLs", () => {
  expect(parsePullRequest(undefined)).toBeUndefined();
  expect(parsePullRequest("")).toBeUndefined();
  expect(parsePullRequest("   ")).toBeUndefined();
  expect(parsePullRequest("not-a-pr")).toBe("invalid");
  expect(parsePullRequest("alchemy-run/alchemy#550")).toEqual({
    owner: "alchemy-run",
    repo: "alchemy",
    number: 550,
  });
  expect(
    parsePullRequest("https://github.com/alchemy-run/alchemy/pull/550"),
  ).toEqual({
    owner: "alchemy-run",
    repo: "alchemy",
    number: 550,
  });
  expect(parsePullRequest("alchemy-run/alchemy/550")).toEqual({
    owner: "alchemy-run",
    repo: "alchemy",
    number: 550,
  });
  expect(parsePullRequest("acme/widgets#0")).toBe("invalid");
  expect(
    formatPullRequest({ owner: "alchemy-run", repo: "alchemy", number: 550 }),
  ).toBe("alchemy-run/alchemy#550");
});

test("shouldRenewOnTtl keeps PR-tied tarballs unless GitHub says closed", () => {
  expect(shouldRenewOnTtl(false, "closed")).toBe(false);
  expect(shouldRenewOnTtl(false, "open")).toBe(false);
  expect(shouldRenewOnTtl(false, "unknown")).toBe(false);
  expect(shouldRenewOnTtl(true, "closed")).toBe(false);
  expect(shouldRenewOnTtl(true, "open")).toBe(true);
  expect(shouldRenewOnTtl(true, "unknown")).toBe(true);
});
