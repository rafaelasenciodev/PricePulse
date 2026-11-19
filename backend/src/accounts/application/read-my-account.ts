/** UC-04 Read my account (see the design). */

import type { UserId } from "../../shared/domain";
import { toView, type AccountView } from "./account-view";
import type { AccountRepository } from "./ports";

export interface ReadMyAccountQuery {
  /** Comes from the authentication of the request, never from the client. */
  readonly owner: UserId;
}

export class ReadMyAccount {
  constructor(private readonly accounts: AccountRepository) {}

  async execute(query: ReadMyAccountQuery): Promise<AccountView> {
    const account = await this.accounts.find(query.owner);
    // A valid Session always belongs to an Account, so this is a defect and not an answer.
    if (account === null) throw new Error(`The Account ${JSON.stringify(query.owner)} of a valid Session does not exist`);
    return toView(account);
  }
}
