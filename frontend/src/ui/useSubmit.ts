import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sends something that changes something, once at a time (BR-11).
 *
 * The call in progress is marked in a ref, at once, and not only in the state: the state is seen by the next
 * render, and two clicks in the same instant would both go through. `pending` is for the screen to disable its
 * button. A call that is refused gives `undefined`, and the one that is made gives what the action gave.
 */
export function useSubmit<A extends unknown[], R>(
  action: (...args: A) => Promise<R>,
): { readonly submit: (...args: A) => Promise<R | undefined>; readonly pending: boolean } {
  const [pending, setPending] = useState(false);
  const inProgress = useRef(false);
  const mounted = useRef(true);
  const latest = useRef(action);
  latest.current = action;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = useCallback(async (...args: A): Promise<R | undefined> => {
    if (inProgress.current) return undefined;
    inProgress.current = true;
    setPending(true);
    try {
      return await latest.current(...args);
    } finally {
      inProgress.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  return { submit, pending };
}
