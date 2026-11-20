import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Result } from "../../src/api";
import { useRequest } from "../../src/ui/useRequest";

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const failed: Result<never> = { ok: false, failure: { kind: "network" } };

/** A promise that the test settles when it wants. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("useRequest (BR-07, BR-08, BR-12)", () => {
  it("is loading, then ready with what was read", async () => {
    const { result } = renderHook(() => useRequest(async () => ok("data")));
    expect(result.current.state).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current.state).toEqual({ status: "ready", data: "data" }));
  });

  it("is failed with the failure, which is a value", async () => {
    const { result } = renderHook(() => useRequest(async () => failed));
    await waitFor(() => expect(result.current.state).toEqual({ status: "failed", failure: { kind: "network" } }));
  });

  it("reads again on retry, going back to loading first", async () => {
    const load = vi.fn<() => Promise<Result<string>>>().mockResolvedValueOnce(failed).mockResolvedValueOnce(ok("second"));
    const { result } = renderHook(() => useRequest(load));
    await waitFor(() => expect(result.current.state.status).toBe("failed"));
    act(() => result.current.retry());
    expect(result.current.state).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current.state).toEqual({ status: "ready", data: "second" }));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("reads again when the deps change, as for another page", async () => {
    const load = vi.fn(async (page: number) => ok(`page ${page}`));
    const { result, rerender } = renderHook(({ page }) => useRequest(() => load(page), [page]), {
      initialProps: { page: 1 },
    });
    await waitFor(() => expect(result.current.state).toEqual({ status: "ready", data: "page 1" }));
    rerender({ page: 2 });
    await waitFor(() => expect(result.current.state).toEqual({ status: "ready", data: "page 2" }));
  });

  it("does not read again for a render with the same deps", async () => {
    const load = vi.fn(async () => ok("x"));
    const { result, rerender } = renderHook(() => useRequest(load));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    rerender();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("drops a slow answer that arrives after a newer read was started", async () => {
    const slow = deferred<Result<string>>();
    const load = vi.fn<(page: number) => Promise<Result<string>>>((page) => (page === 1 ? slow.promise : Promise.resolve(ok("page 2"))));
    const { result, rerender } = renderHook(({ page }) => useRequest(() => load(page), [page]), {
      initialProps: { page: 1 },
    });
    rerender({ page: 2 });
    await waitFor(() => expect(result.current.state).toEqual({ status: "ready", data: "page 2" }));
    await act(async () => slow.resolve(ok("page 1")));
    expect(result.current.state).toEqual({ status: "ready", data: "page 2" });
  });

  it("keeps nothing: a screen entered again reads again", async () => {
    const load = vi.fn(async () => ok("x"));
    const first = renderHook(() => useRequest(load));
    await waitFor(() => expect(first.result.current.state.status).toBe("ready"));
    first.unmount();
    const second = renderHook(() => useRequest(load));
    expect(second.result.current.state).toEqual({ status: "loading" });
    await waitFor(() => expect(second.result.current.state.status).toBe("ready"));
    expect(load).toHaveBeenCalledTimes(2);
  });
});
