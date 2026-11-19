import { InvalidEmail } from "./errors";

const MAXIMUM_LENGTH = 254;
// Text before and after a single "@", with no spaces inside. Whether the address exists is not checked.
const SHAPE = /^[^@\s]+@[^@\s]+$/;

/**
 * The email that identifies an Account (BR-01).
 *
 * It is written without surrounding spaces and in lower case, so two that differ only in
 * that are equal. Use `Email.of` to create one.
 */
export class Email {
  private constructor(readonly value: string) {}

  /** The normal form of any text, valid or not. A sign-in counts its failed attempts by it. */
  static normalize(text: string): string {
    return text.trim().toLowerCase();
  }

  static of(text: string): Email {
    const value = Email.normalize(text);
    if (value.length > MAXIMUM_LENGTH || !SHAPE.test(value)) throw new InvalidEmail();
    return new Email(value);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
