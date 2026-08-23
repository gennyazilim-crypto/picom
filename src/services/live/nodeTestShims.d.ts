// Minimal ambient declarations for the two Node built-ins used by
// liveScreenShareScoring.test.ts. This repo has no `@types/node` wired into
// tsconfig's `types`, and adding `/// <reference types="node" />` pulls in
// the full Node global augmentation (e.g. `setTimeout` returning
// `NodeJS.Timeout`), which conflicts with the DOM `setTimeout` typing used
// elsewhere in the codebase. Declaring only the two specifiers we need here
// avoids that global leak while still typing the test file correctly.

declare module "node:assert/strict" {
  interface StrictAssert {
    equal(actual: unknown, expected: unknown, message?: string | Error): void;
    deepEqual(actual: unknown, expected: unknown, message?: string | Error): void;
  }

  const strictAssert: StrictAssert;
  export default strictAssert;
}

declare module "node:test" {
  export function test(name: string, fn: () => void | Promise<void>): void;
}
