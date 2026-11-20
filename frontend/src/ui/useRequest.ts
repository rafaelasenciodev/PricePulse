import { useCallback, useEffect, useRef, useState } from "react";
import type { Failure, Result } from "../api";

export type RequestState<T> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "failed"; readonly failure: Failure };

/**
 * Reads when the screen is entered, and again when `deps` change or when `retry` is called. It keeps nothing: a
 * screen that is entered again reads again (Q9 of the discovery). An answer that arrives after a newer read was
 * started, or after the screen has gone, is dropped, so a slow answer never replaces a newer one.
 *
 * `load` is the latest one given, and `deps` say when it must be called again, as in an effect.
 */
export function useRequest<T>(
  load: () => Promise<Result<T>>,
  deps: readonly unknown[] = [],
): { readonly state: RequestState<T>; retry(): void } {
  const [state, setState] = useState<RequestState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const latest = useRef(load);
  latest.current = load;

  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    void latest.current().then((result) => {
      if (!current) return;
      setState(result.ok ? { status: "ready", data: result.data } : { status: "failed", failure: result.failure });
    });
    return () => {
      current = false;
    };
    // `attempt` and `deps` are the reasons to read again.
  }, [attempt, ...deps]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
