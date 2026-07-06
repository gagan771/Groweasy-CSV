import { describe, it, expect } from "vitest";
import { runWithConcurrency } from "../domain/concurrency";

describe("runWithConcurrency", () => {
  it("runs all tasks and returns results in order", async () => {
    const tasks = [
      () => Promise.resolve(1),
      () => Promise.resolve(2),
      () => Promise.resolve(3),
    ];
    const results = await runWithConcurrency(tasks, 2);
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ status: "fulfilled", value: 1 });
    expect(results[1]).toMatchObject({ status: "fulfilled", value: 2 });
    expect(results[2]).toMatchObject({ status: "fulfilled", value: 3 });
  });

  it("marks rejected tasks as rejected and continues", async () => {
    const tasks = [
      () => Promise.resolve("ok"),
      () => Promise.reject(new Error("oops")),
      () => Promise.resolve("also ok"),
    ];
    const results = await runWithConcurrency(tasks, 3);
    expect(results[0]).toMatchObject({ status: "fulfilled", value: "ok" });
    expect(results[1]).toMatchObject({ status: "rejected" });
    expect(results[2]).toMatchObject({ status: "fulfilled", value: "also ok" });
  });

  it("handles an empty task list", async () => {
    const results = await runWithConcurrency([], 5);
    expect(results).toHaveLength(0);
  });

  it("respects the concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 6 }, (_, i) => async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
      return i;
    });

    await runWithConcurrency(tasks, 2);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("handles limit larger than task count gracefully", async () => {
    const tasks = [() => Promise.resolve("a"), () => Promise.resolve("b")];
    const results = await runWithConcurrency(tasks, 100);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ status: "fulfilled", value: "a" });
  });
});
