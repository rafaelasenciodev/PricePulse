import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../session";
import { screens } from "../texts";
import { Layout } from "./Layout";

function Checking() {
  return (
    <main>
      <p role="status">{screens.checkingSession}</p>
    </main>
  );
}

/** The routes that need a person signed in (BR-02): anybody else is taken to the sign-in screen. */
export function RequireSession() {
  const { state } = useSession();
  if (state.status === "checking") return <Checking />;
  if (state.status === "signedOut") return <Navigate to="/sign-in" replace />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

/** The routes to sign in and to register: somebody who is already signed in is taken to the Catalogue (SC-02). */
export function RequireGuest() {
  const { state } = useSession();
  if (state.status === "checking") return <Checking />;
  if (state.status === "signedIn") return <Navigate to="/catalogue" replace />;
  return <Outlet />;
}
