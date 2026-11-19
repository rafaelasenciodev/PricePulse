import type { UserId } from "../../shared/domain";
import type { Email } from "./email";

/**
 * The registration of a User: an email that identifies it and the hash of its password.
 *
 * It holds only the hash (BR-04). Nothing in this feature changes an Account once it exists,
 * so it has no operations.
 */
export class Account {
  constructor(
    readonly id: UserId,
    readonly email: Email,
    readonly passwordHash: string,
  ) {}
}
