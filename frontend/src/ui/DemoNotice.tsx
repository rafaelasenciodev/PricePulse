import { useEffect, useState } from "react";
import type { ApiClient } from "../api";
import { screens } from "../texts";

/**
 * A visible line when the server says that it is a demo with simulated data (feature 12, BR-03). It asks once, when
 * the page loads. While it waits, and when the request fails or the server says that it is not a demo, it shows nothing.
 */
export function DemoNotice({ client }: { readonly client: ApiClient }) {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    let current = true;
    void client.demo().then((result) => {
      if (current && result.ok) setDemo(result.data.demo);
    });
    return () => {
      current = false;
    };
  }, [client]);

  return demo ? (
    <p role="note" className="bg-accent px-4 py-1.5 text-center text-sm text-accent-ink">
      {screens.demo.notice}
    </p>
  ) : null;
}
