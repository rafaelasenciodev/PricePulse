/**
 * Says whether a token belongs to a signed-in User.
 *
 * The Price History is read by Users, and the credentials of Users and of Providers are not
 * interchangeable. This module cannot use the authenticator of Price Alerts, because a feature does
 * not import another, so it asks for what it needs: whether the token is a User's. It does not
 * say which User, because the history belongs to nobody. The Composition Root adapts the
 * authenticator of Users to it. Real authentication is a later feature.
 */
export interface UserAuthenticator {
  isUser(token: string): Promise<boolean>;
}
