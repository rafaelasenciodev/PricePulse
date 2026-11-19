import { UserId } from "../../shared/domain";

// `crypto` is the Web Crypto standard, available in Node and in browsers: the domain
// imports nothing from any platform. A new Account takes the identifier of its User.
export const newUserId = (): UserId => UserId(crypto.randomUUID());
