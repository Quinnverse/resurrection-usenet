# RESURRECTION V5 — Technical Architecture
Status: PROPOSED CONTRACT, not evidence of working implementation.

## Problem statement
Revive a late-1990s game-development workflow whose artifacts survive as distributed USENET-style posts, MIME attachments and independent build copies. USENET is a message transport/discussion system, NOT executable version control. Modern parser and runtime reconstruct deterministic playable scene data.

## Data pipeline
1. Offline fixture messages: RFC-style Message-ID, From, Date, Subject, References/In-Reply-To, MIME part metadata and attachment checksum; label dataset FICTIONAL unless sourced and verified.
2. Parser validates boundaries, sizes, content type, encodings and checksums. Normalize duplicate Message-IDs and record divergent copies as conflicts, never silently overwrite.
3. Reply graph and build manifest resolver maps archive records -> authored assets and build versions (1998/2004).
4. Provenance layer records origin, checksum, build ID, status (RESTORED / RECONSTRUCTED / CREATED), confidence and transform steps.
5. Deterministic scene adapter produces objects, collision shapes, material refs, NPC scripts, sound refs, era tags.
6. Browser runtime instantiates scene; restoration applies manifest-driven diffs and saves immutable provenance references with player progress.
7. Present-day additions are in a separate namespace/edition; never modify original archive bytes.

## Suggested schemas
ArchiveRecord {messageId, from, date, subject, references[], attachmentRefs[], sha256, fixtureStatus}
Attachment {id, mediaType, byteSize, sha256, sourceRecordId, safePath}
BuildManifest {buildId, era, parentBuildId?, objects[], npcScripts[], musicRefs[], credits[], provenanceRefs[]}
WorldObject {id, assetRef, transform, collision, eraAvailability[], provenanceRef, restoreState}
Provenance {recordId, status: RESTORED|RECONSTRUCTED|CREATED, evidenceRefs[], transforms[], uncertainty?}
Save {schemaVersion, chapter, beat, era, restoredObjectIds[], photoChoices[], dialogueFlags[], createdEditionFlags[], provenanceVersion}

## Hard correctness rules
- Historical versions are immutable. Changing Tab selects snapshots; does not edit past.
- Never claim a 1998 winter asset exists if it does not. Seasons are CREATED in the modern edition.
- 2004 removal of June's attribution is authored fictional narrative canon; distinguish file-level evidence from inferred motives.
- No hidden AI model/API dependency; no unauthorized external asset downloads or paid services.
- Provenance UI is optional for judges; ordinary players never need to read Message-IDs.
- Any historical re-enactment is dramatized and labeled as such in documentation.

## Implementation boundary and repo evidence
Existing README on p5-narrative-gameplay describes /, /p3/, /p4/, combined-server and Three.js P4. Existing GAME_DESIGN_BIBLE.md describes M01–M05 investigation and Tab evidence. Those are LEGACY, not proof V5 exists. Audit code, test suite, browser behavior, saves and deployment before editing gameplay. Isolate new /p5/ or equivalent feature path, preserve old routes and user data.

## Test strategy
Fixture -> parser -> manifest -> runtime object/collision assert; mutate fixture and verify resulting scene difference; corrupted attachment rejected safely; divergent copies traced; 1998/2004 time-shift collision safe; credits preserved and restored; new winter labeled CREATED; save/reload; ZH/EN; Chromium desktop. Report untested areas honestly.

## Demo proof
In <=3 min show a fixture archive record, parse result, an absent bridge, its restoration with actual collision/path, and source provenance. A fabricated on-screen terminal without data-driven reconstruction fails the technical theme.
