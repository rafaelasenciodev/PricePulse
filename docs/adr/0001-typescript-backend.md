# ADR-0001: The backend is written in TypeScript

- Document status: In Review
- Decision status: Implemented
- Date: 2026-11-19

## Context

The project was first implemented in Python with FastAPI. The domain, the use case, the in-memory adapters and their tests were written in that language through the first phases of feature 01.

Before anything was published, the author decided to change the language of the backend. The deciding factor was how the design is verified. The project is built on ports and adapters: the use case depends on interfaces that adapters implement, and the domain relies on distinct types for distinct identifiers. In Python these guarantees depend on a type checker that the project had chosen not to install yet, so a port was a convention. In TypeScript the compiler verifies them. The author's familiarity with statically typed languages and type-driven design also made the language easier to work in.

The change was cheap because the design is independent of the language. The discovery, glossary, business rules, scenarios, domain model and use case contract were not edited by it, and the Python implementation was ported without changing the approved design. Only details specific to the language had to be adapted, as the consequences below describe.

## Decision

The backend is written in TypeScript on Node, in strict mode.

| Aspect | Choice |
|---|---|
| Language | TypeScript with `strict` and `noUncheckedIndexedAccess` |
| Runtime | Node, minimum version 22 (the types are pinned to the same major) |
| HTTP | Fastify, with two plugins that generate and serve the API documentation. They are the only runtime dependencies so far |
| Tests | Vitest |
| Packages | npm |

This decision covers the backend only. The language of a frontend is not decided here.

## Alternatives considered

**Python with FastAPI**, the previous choice.
- In its favour: the standard `Decimal` type for money, a mature ecosystem for data and AI work, and a concise syntax.
- Against: types are not checked at compile time unless a checker is added and kept strict; ports and identifiers would remain conventions.
- Not chosen because compile-time verification of the architecture was the priority.

Other languages were not evaluated.

## Consequences

**Positive**
- The compiler verifies that adapters satisfy their ports. Identifiers of different kinds cannot be mixed up: a `UserId` is not accepted where a `ListingId` is expected.
- The domain imports no package and no platform module, and this is enforced by a test.

**Negative, and what was done about it**
- TypeScript has no exact decimal type. Money is held as an integer number of minor units, and amounts travel as text and are parsed strictly (`"79.999"` and `"NaN"` are rejected). No decimal library is used.
- Types are erased at runtime, so data from outside is validated at the boundary: a JSON schema in the HTTP layer and strict parsing in the domain.
- Database access is asynchronous in Node, so the ports return promises from the start. A persistence adapter will fit without changing the use case.
- The code is run in development with `tsx`. How it is compiled and started in production is not decided and will be decided when the application is deployed.

**Open**
- Optional AI integrations may be written in TypeScript or in a separate Python service. That is decided if and when they are built.

## Related documents

- [Use case contract](../features/01-create-price-alert/04-use-case-contract.md)
- [Domain model](../features/01-create-price-alert/03-domain-model.md)
- [Architecture review](../features/01-create-price-alert/09-architecture-review.md)
