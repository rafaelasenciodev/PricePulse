PricePulse — Instructions for Claude Code

1. Project context

PricePulse is a price-tracking platform developed as a Master’s Final Project (TFM) and professional portfolio project.

The project aims to demonstrate solid backend and software engineering skills through a real application, including domain modelling, API development, persistence, asynchronous processing, testing and deployment.

The initial implementation will use simulated price data. Real retailer integrations are not part of the initial scope.

2. Documentation is the source of truth

Before working on a feature:

* Read README.md for project context.
* Read docs/product/ for product vision and scope.
* Read docs/features/README.md for the feature development methodology.
* Read the relevant feature discovery document.
* Check docs/domain/open-questions.md for unresolved questions.

Do not assume that a proposed concept or architectural approach has been accepted.

Distinguish between:

* Facts and approved requirements.
* Hypotheses and proposals.
* Open questions.
* Accepted decisions.

When uncertain, explain the ambiguity and discuss alternatives instead of making assumptions.

3. Development methodology

Follow the phases documented in docs/features/README.md.

Do not skip phases or move to the next phase without explicit approval. Silence is not approval.

The process is incremental:

1. Understand the problem.
2. Discuss alternatives and trade-offs.
3. Propose a solution.
4. Explain the reasoning.
5. Wait for approval.
6. Implement only the approved scope.
7. Review the result before proceeding.

The goal is not merely to produce working code, but to understand and justify the design decisions.

4. Implementation principles

* Prefer simple solutions over unnecessary abstractions.
* Apply DDD and Clean Architecture where they provide genuine value.
* Keep business rules independent of infrastructure and HTTP.
* Introduce entities, Value Objects, aggregates and domain events only when justified.
* Do not introduce design patterns simply to demonstrate knowledge of them.
* Keep external providers behind appropriate boundaries.
* The core application must not depend on OpenAI, RAG, n8n or external retailer APIs.
* Do not introduce infrastructure or dependencies without explaining their purpose and cost.

5. Incremental changes

Changes must remain small, understandable and reviewable.

Before modifying files:

* Explain what will change.
* Identify the files involved.
* Explain why the change is necessary.
* Wait for approval when the change involves a new decision or expands the agreed scope.

Do not:

* Rewrite entire modules unnecessarily.
* Generate large amounts of code in one iteration.
* Modify unrelated files.
* Create future-phase documents or placeholders prematurely.
* Make unrequested architectural decisions.
* Propose documentation cleanups or audits unless asked. Update documentation only for the artefacts of the phase in progress.

6. Git discipline

Never execute:

* git commit
* git push
* git reset
* git rebase
* git checkout
* git clean

Do not perform operations that rewrite Git history or discard user work.

You may inspect Git status, diffs and history.

The developer reviews changes and performs commits manually.

At the end of each implementation task, report:

* Files created, modified or deleted.
* Summary of the changes.
* Tests and checks executed.
* Any remaining issues.
* A suggested commit message.

7. Testing

* Write tests progressively alongside implementation.
* Prefer Vitest unless there is a concrete reason to use another tool.
* Test observable behaviour and business rules.
* Avoid testing implementation details unnecessarily.
* Do not introduce a testing framework simply because it is popular.

8. Communication

Communicate in Spanish unless asked otherwise.

Write documentation, code, identifiers and commit messages in English.

Explain technical concepts, alternatives and trade-offs clearly.

Do not assume the developer already understands a design decision merely because it has been implemented.

When presenting alternatives, explain their consequences and make a recommendation when appropriate.

Do not proceed autonomously through multiple phases or iterations. Work on one agreed unit at a time.

9. Public documentation rules

This repository is public and reviewed by an academic supervisor and technical recruiters. Documentation must be self-contained.

* Do not reference files, paths, or material outside the repository, including private working notes.
* Do not include personal tasks or private conversations.
* Do not state facts about third-party services (terms of use, legality, availability, costs) as verified. Express them as project policy or as stated limitations.
* Do not claim market conclusions. PricePulse is presented as an engineering project.
* Mark each decision with its status, following the vocabulary in docs/features/README.md. Do not describe a proposal as accepted.
