import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { PasswordHasher } from "../application";

/** The cost of `scrypt`: N is the CPU and memory cost (a power of 2), r the block size, p the parallelism. */
export interface ScryptParameters {
  readonly N: number;
  readonly r: number;
  readonly p: number;
}

/**
 * The cost used in production: about 64 MiB and, on the machine where it was measured, about
 * 180 ms for each hash. It is one of the configurations that OWASP lists for `scrypt`.
 */
export const DEFAULT_SCRYPT_PARAMETERS: ScryptParameters = { N: 2 ** 16, r: 8, p: 2 };

/** A cost so low that it takes no time. Only for tests: it protects nothing. */
export const FAST_SCRYPT_PARAMETERS: ScryptParameters = { N: 2 ** 4, r: 8, p: 1 };

const FORMAT = "scrypt"; // the name and the version of the format of the stored text
const VERSION = "v1";
const SALT_BYTES = 16;
const KEY_BYTES = 32;

/**
 * Implements PasswordHasher with `scrypt` from the standard library of Node (ADR-0004).
 *
 * The stored text is `scrypt$v1$N$r$p$salt$key`, with the salt and the key in base64. It
 * carries its own parameters, so a hash made with other parameters is still checked with the
 * ones it was made with, and the parameters of new hashes can change without breaking any Account.
 */
export class ScryptPasswordHasher implements PasswordHasher {
  constructor(private readonly parameters: ScryptParameters = DEFAULT_SCRYPT_PARAMETERS) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await derive(password, salt, this.parameters, KEY_BYTES);
    const { N, r, p } = this.parameters;
    return [FORMAT, VERSION, N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
  }

  async verify(password: string, hash: string): Promise<boolean> {
    const parsed = parse(hash);
    if (parsed === null) return false;
    const key = await derive(password, parsed.salt, parsed.parameters, parsed.key.length);
    return timingSafeEqual(key, parsed.key);
  }
}

interface Parsed {
  readonly parameters: ScryptParameters;
  readonly salt: Buffer;
  readonly key: Buffer;
}

function parse(hash: string): Parsed | null {
  const parts = hash.split("$");
  if (parts.length !== 7 || parts[0] !== FORMAT || parts[1] !== VERSION) return null;
  const [N, r, p] = [parts[2], parts[3], parts[4]].map((part) => Number(part)) as [number, number, number];
  const salt = Buffer.from(parts[5] as string, "base64");
  const key = Buffer.from(parts[6] as string, "base64");
  const powerOfTwo = Number.isInteger(N) && N >= 2 && (N & (N - 1)) === 0;
  if (!powerOfTwo || !Number.isInteger(r) || r < 1 || !Number.isInteger(p) || p < 1) return null;
  if (salt.length === 0 || key.length === 0) return null;
  return { parameters: { N, r, p }, salt, key };
}

function derive(password: string, salt: Buffer, { N, r, p }: ScryptParameters, length: number): Promise<Buffer> {
  // Node refuses by default to use more than 32 MiB, so the memory that the cost needs is allowed.
  const maxmem = 128 * N * r + 128 * r * p + 1024 * 1024;
  return new Promise((resolve, reject) => {
    scrypt(password, salt, length, { N, r, p, maxmem }, (error, key) => (error ? reject(error) : resolve(key)));
  });
}
