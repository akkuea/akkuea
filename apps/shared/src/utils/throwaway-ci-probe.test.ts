import { expect, test } from "bun:test";

test("throwaway commit: proves a failing shared test turns build-and-test red", () => {
  expect(0).toBe(1);
});
