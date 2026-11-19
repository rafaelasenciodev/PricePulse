# ADR-0002: A simplified Git Flow organises the branches

- Document status: In Review
- Decision status: Accepted
- Date: 2026-11-19

## Context

Work began on a single branch, `main`, while the domain was being defined. The project is developed feature by feature, and each feature goes through the same phases and has its own folder under `docs/features/`. A reader of the repository, such as an academic supervisor, benefits from seeing each feature as a unit in the history.

The repository has one author and no deployed system.

## Decision

Three kinds of branch:

| Branch | Purpose |
|---|---|
| `main` | Stable versions. Each version is tagged `vX.Y.Z` |
| `develop` | Integration of finished features |
| `feature/NN-name` | One per feature, named after its folder in `docs/features/` (for example `feature/01-create-price-alert`) |

Rules:

- A feature branch is created from `develop` and holds **all the phases of the feature**, documentation included.
- A feature is merged into `develop` when it is complete, with `--no-ff`, so the history shows the feature as one block. `develop` is merged into `main`, also with `--no-ff`, and the result is tagged.
- The feature branch is where its history is tidied, before it is merged.
- Commit messages follow the form `type: summary`, such as `feat:`, `docs:`, `test:` and `refactor:`.
- Release and hotfix branches are not used until there is something to release or to fix in production.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Full Git Flow, with `release/` and `hotfix/` branches | More ceremony than a single author with no production system needs |
| GitHub Flow: `main` and short-lived branches, no `develop` | Lighter, but there is no integration branch, and the structure is less visible in the history |
| A single branch, which is how the project began | Features are not isolated, and the history does not show where each one starts and ends |

Git Flow is regarded as heavy for continuous delivery. It suits this project because its features are discrete and are delivered one at a time.

## Consequences

- The history shows each feature as a block with a visible start and end.
- `main` contains only finished, tagged work.
- A merge is an extra step compared with committing directly.

**How feature 01 was brought into the model.** The feature began on `main`, before this decision. `main` and `develop` start at the commit that completed the project documentation and the documents of phases 0 to 3 of the feature (discovery, language and rules, scenarios, domain model). Phases 4 to 10 are on `feature/01-create-price-alert`. The Python implementation described in [ADR-0001](0001-typescript-backend.md) is not part of that branch.

**Open**
- Protection rules for `main` and `develop`, and whether merges go through pull requests, are decided when the repository is hosted.
