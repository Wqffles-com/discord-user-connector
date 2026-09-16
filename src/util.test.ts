import { describe, expect, test } from "bun:test";
import {
  channelTypeName,
  coerceSnowflake,
  isoFromSnowflake,
  snowflakeFromIso,
  trunc,
} from "./util.js";

test("snowflake 0 is the Discord epoch", () => {
  expect(isoFromSnowflake("0")).toBe("2015-01-01T00:00:00.000Z");
});

test("iso/snowflake round trip", () => {
  const iso = "2024-06-01T12:34:56.789Z";
  expect(isoFromSnowflake(snowflakeFromIso(iso))).toBe(iso);
});

test("coerceSnowflake passes numeric ids through", () => {
  expect(coerceSnowflake("123456789012345678")).toBe("123456789012345678");
});

test("coerceSnowflake converts ISO dates", () => {
  const iso = "2024-06-01T12:34:56.789Z";
  expect(coerceSnowflake(iso)).toBe(snowflakeFromIso(iso));
});

test("coerceSnowflake converts date-only strings", () => {
  const sf = coerceSnowflake("2024-06-01");
  expect(isoFromSnowflake(sf)).toBe("2024-06-01T00:00:00.000Z");
});

test("channel type names", () => {
  expect(channelTypeName(0)).toBe("text");
  expect(channelTypeName(2)).toBe("voice");
  expect(channelTypeName(15)).toBe("forum");
  expect(channelTypeName(99)).toBe("unknown_99");
});

test("trunc", () => {
  expect(trunc(undefined, 10)).toBe("");
  expect(trunc("short", 10)).toBe("short");
  expect(trunc("0123456789abc", 10)).toBe("012345678…");
});
