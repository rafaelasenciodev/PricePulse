import { useContext } from "react";
import { SessionContext, type SessionValue } from "./SessionProvider";

/** The session and the client of the screens. It fails loudly outside a `SessionProvider`, which is a mistake of the code. */
export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) throw new Error("useSession needs a SessionProvider above it");
  return value;
}
