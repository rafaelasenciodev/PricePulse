import { Navigate, Route, Routes } from "react-router-dom";
import { AlertsScreen } from "./AlertsScreen";
import { CatalogueScreen } from "./CatalogueScreen";
import { ListingScreen } from "./ListingScreen";
import { NotificationsScreen } from "./NotificationsScreen";
import { RegisterScreen } from "./RegisterScreen";
import { RequireGuest, RequireSession } from "./RequireSession";
import { SignInScreen } from "./SignInScreen";
import { ThemeProvider } from "./theme";

/**
 * The routes, without the router: the page gives a `BrowserRouter` with the base `/app`, and a test gives a
 * `MemoryRouter`. An address that is none of these leads to the same place as `/`, which is the Catalogue for a
 * person who is signed in and the sign-in screen for anybody else.
 */
export function App() {
  return (
    <ThemeProvider>
      <Routes>
        <Route element={<RequireGuest />}>
          <Route path="sign-in" element={<SignInScreen />} />
          <Route path="register" element={<RegisterScreen />} />
        </Route>
        <Route element={<RequireSession />}>
          <Route path="catalogue" element={<CatalogueScreen />} />
          <Route path="listings/:id" element={<ListingScreen />} />
          <Route path="alerts" element={<AlertsScreen />} />
          <Route path="notifications" element={<NotificationsScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/catalogue" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
