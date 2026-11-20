import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSubmit } from "../../src/ui/useSubmit";

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useSubmit (BR-11, SC-11)", () => {
  it("is pending while the call is in progress, and gives what the action gave", async () => {
    const call = deferred<string>();
    const { result } = renderHook(() => useSubmit(() => call.promise));
    expect(result.current.pending).toBe(false);

    let outcome: Promise<string | undefined> = Promise.resolve(undefined);
    act(() => {
      outcome = result.current.submit();
    });
    expect(result.current.pending).toBe(true);

    await act(async () => call.resolve("done"));
    await expect(outcome).resolves.toBe("done");
    expect(result.current.pending).toBe(false);
  });

  it("sends one call when it is used twice in the same instant", async () => {
    const call = deferred<string>();
    const action = vi.fn(() => call.promise);
    const { result } = renderHook(() => useSubmit(action));

    let first: Promise<string | undefined> = Promise.resolve(undefined);
    let second: Promise<string | undefined> = Promise.resolve(undefined);
    // Both calls are made before React renders again, so only the mark that is set at once can stop the second.
    act(() => {
      first = result.current.submit();
      second = result.current.submit();
    });
    await expect(second).resolves.toBeUndefined();
    expect(action).toHaveBeenCalledTimes(1);

    await act(async () => call.resolve("done"));
    await expect(first).resolves.toBe("done");
  });

  it("passes its arguments to the action", async () => {
    const action = vi.fn(async (a: string, b: number) => `${a}${b}`);
    const { result } = renderHook(() => useSubmit(action));
    await act(async () => {
      await result.current.submit("x", 2);
    });
    expect(action).toHaveBeenCalledWith("x", 2);
  });

  it("can be used again when the first call has ended", async () => {
    const action = vi.fn(async () => "ok");
    const { result } = renderHook(() => useSubmit(action));
    await act(async () => {
      await result.current.submit();
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("is free again if the action throws, so the control is never left disabled", async () => {
    const call = deferred<string>();
    const { result } = renderHook(() => useSubmit(() => call.promise));
    let outcome: Promise<string | undefined> = Promise.resolve(undefined);
    act(() => {
      outcome = result.current.submit();
    });
    outcome.catch(() => {});
    await act(async () => call.reject(new Error("boom")));
    await expect(outcome).rejects.toThrow("boom");
    await waitFor(() => expect(result.current.pending).toBe(false));
  });

  it("does not set state after the screen has gone", async () => {
    const call = deferred<string>();
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useSubmit(() => call.promise));
    act(() => {
      void result.current.submit();
    });
    unmount();
    await act(async () => call.resolve("late"));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
