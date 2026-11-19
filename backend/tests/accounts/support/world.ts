import {
  Authenticate,
  ReadMyAccount,
  RegisterAccount,
  SignIn,
  SignOut,
} from "../../../src/accounts/application";
import { FakeAccounts, FakeAttempts, FakeHasher, FakeSessions, MutableClock, SequenceTokens } from "./fakes";

export const START = Date.parse("2026-11-19T10:00:00Z");
export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** All the use cases of Accounts wired to doubles, with a clock the test moves. */
export function buildWorld() {
  const accounts = new FakeAccounts();
  const sessions = new FakeSessions();
  const attempts = new FakeAttempts();
  const hasher = new FakeHasher();
  const tokens = new SequenceTokens();
  const clock = new MutableClock(START);
  const world = {
    accounts, sessions, attempts, hasher, tokens, clock,
    register: new RegisterAccount(accounts, hasher),
    signIn: new SignIn(accounts, sessions, attempts, hasher, tokens, clock),
    signOut: new SignOut(sessions, tokens, clock),
    authenticate: new Authenticate(sessions, tokens, clock),
    readMyAccount: new ReadMyAccount(accounts),
  };
  return world;
}
export type World = ReturnType<typeof buildWorld>;

/** An Account that exists and can be signed in to. */
export async function registered(world: World, email = "ana@example.com", password = "first-password-1") {
  return world.register.execute({ email, password });
}

export async function failTimes(world: World, times: number, email = "ana@example.com") {
  for (let i = 0; i < times; i++) {
    await world.signIn.execute({ email, password: "wrong-password-0" }).catch(() => {});
  }
}
