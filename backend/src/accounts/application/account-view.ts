import type { Account } from "../domain";

/** An Account as the callers of the use cases see it. It never has the password or its hash (BR-04, BR-10). */
export interface AccountView {
  readonly id: string;
  readonly email: string;
}

export function toView(account: Account): AccountView {
  return { id: account.id, email: account.email.value };
}
