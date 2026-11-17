# How Kiro was used to build Resurrection

## Specifications first
The product was specified in three documents in `docs/game-design/`: a game design document (scope, acts, quality gates), a narrative bible (world rules, canonical facts, character voices), and a puzzle, state and API specification (evidence graph, choices, propagation, acceptance matrix). These documents were the authority for every decision in the code. Features outside them were not added.

The project's steering files in `.kiro/steering/` hold the earlier technical architecture, product requirements, risks and task breakdown. They are kept in the repository unchanged.

## What the agent did
- **Read the specifications and mapped them to code.** Each acceptance-matrix line in the puzzle spec became a named test, for example `T05 propagation events explain every dependent change`.
- **Built the deterministic engine.** `combined-server/game/engine.js` is a pure state machine: a session and an action go in, the next session and a result come out. Replay rebuilds a session from its action log, and a test compares the result with the original.
- **Caught its own defects by running the tests.** Examples from the work session: reconstruction wrote back stale decay values, a change-set assertion could not pass because both branches changed the same record IDs, and a "no Math.random" check matched the word inside a comment. Each was fixed in the same session.
- **Kept existing behaviour.** The 35 tests from the earlier milestone still run and pass against the same server.

## Where human review mattered
- The owner's documents define the plot. The agent kept the authored lines exactly where the documents quote them and wrote short replacements only where the documents left a gap. Those replacements are in `content.js` and should be reviewed for tone.
- Accessibility and visual design were not verified by a person.
- Legal review of the MIT licence header (copyright holder name) is pending.

## Limits of this write-up
This document describes process, not guarantees. The test results and CI status are recorded in the repository's commit history and in the GitHub Actions run, not in this file.
