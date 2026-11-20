/** `npm run reset-demo`: returns the data of the demo to its first state. Needs `DEMO_MODE=true` and `DATABASE_URL`. */

import { ResetRefused, resetDemo } from "./reset-demo";

try {
  await resetDemo(process.env, { info: (message) => console.log(message) });
} catch (error) {
  if (error instanceof ResetRefused) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    // What is not a refusal may carry the address of the server: only its code is shown.
    const code = error instanceof Error && "code" in error ? String(error.code) : "unknown";
    console.error(`The reset failed (${code}). Run it again: it empties and creates the data from the start.`);
    process.exitCode = 1;
  }
}
