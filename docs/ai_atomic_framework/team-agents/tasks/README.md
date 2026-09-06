---
doc_id: doc_index_team_agents_tasks
owner: atm-core
status: active
related_plan: docs/ai_atomic_framework/team-agents/團隊自動化代理分工計畫.md
planning_repo: 3KLife
target_repo: AI-Atomic-Framework
public_tracking: false
created_at: 2026-05-28
last_updated: 2026-07-10
---

# Team Agents Task Index

Related plan: [../團隊自動化代理分工計畫.md](../團隊自動化代理分工計畫.md)
Templates: [../templates/README.md](../templates/README.md)
Immediate-use SOP: [../TEAM_AGENTS_CAPTAIN_LED_SOP.md](../TEAM_AGENTS_CAPTAIN_LED_SOP.md)

## Task Card Contract

Every `TASK-TEAM-*` card follows the ATM task-card authoring contract:

- `scopePaths`: target repo paths an implementation agent may change.
- `deliverables`: concrete target outputs, not only `.atm/history/**`.
- `validators`: command-backed checks required for closure.
- `evidence.required: command-backed`: completion requires command evidence.
- `rollback`: revertable rollback guidance.
- `atomizationImpact`: owner atom/map and required map updates.

Planning-only cards normally set `target_repo: 3KLife` and `closure_authority: planning_repo`. Framework implementation cards set `target_repo: AI-Atomic-Framework` and `closure_authority: target_repo`. Cross-repo reconciliation bridge cards may keep `planning_repo: 3KLife` while pointing `target_repo` at `AI-Atomic-Framework` when Phase 0 only opens the lane and Phase 1 is owned by the target repo; in that shape, `closure_authority` may still stay `planning_repo` if the card closes after delivering only the Phase 0 opener.

## Task Roster

| Task ID | Milestone | Title | Status | Depends | Target surface |
|---|---|---|---|---|---|
| [TASK-TEAM-0001](./TASK-TEAM-0001-team-agents-planning-roster-reset.task.md) | M0 | Team agents planning roster reset | done | none | planning docs |
| [TASK-TEAM-0002](./TASK-TEAM-0002-minimal-task-crew-briefing-contract.task.md) | M1 | Minimal task crew briefing contract | done | `TASK-TEAM-0001` (parallel with 0003) | team docs / CLI contract |
| [TASK-TEAM-0003](./TASK-TEAM-0003-atomization-planner-required-role.task.md) | M1 | Atomization planner required role | done | `TASK-TEAM-0001` (parallel with 0002) | team docs / CLI contract |
| [TASK-TEAM-0004](./TASK-TEAM-0004-team-brief-report-templates.task.md) | M2 | Team brief/report templates | done | `TASK-TEAM-0002`, `TASK-TEAM-0003` | target closure: `AI-Atomic-Framework` `5fe00bdc`; templates / validator |
| [TASK-TEAM-0005](./TASK-TEAM-0005-team-memory-captain-decision-templates.task.md) | M2 | Team memory and captain decision templates | done | `TASK-TEAM-0004` (parallel with 0006) | target closure: `AI-Atomic-Framework` `98d5cbee`; templates / validator |
| [TASK-TEAM-0006](./TASK-TEAM-0006-patrol-report-template.task.md) | M2 | Patrol report template | done | `TASK-TEAM-0004` (parallel with 0005) | target closure: `AI-Atomic-Framework` `7ee56378`; runner sync: `06bfc744`; templates / validator |
| [TASK-TEAM-0007](./TASK-TEAM-0007-captain-decision-team-sizing-dry-run.task.md) | M3 | Captain decision and team sizing dry-run | done | `TASK-TEAM-0003` | `team` CLI |
| [TASK-TEAM-0008](./TASK-TEAM-0008-task-lieutenant-escalation-rules.task.md) | M3 | Task lieutenant escalation rules | done | `TASK-TEAM-0007` | `team` CLI |
| [TASK-TEAM-0009](./TASK-TEAM-0009-team-plan-dry-run-resolver.task.md) | M4 | Team plan dry-run resolver | done | `TASK-TEAM-0007`, `TASK-TEAM-0008` | `team` CLI |
| [TASK-TEAM-0010](./TASK-TEAM-0010-role-implementer-selector.task.md) | M4 | Role and implementer selector | done | `TASK-TEAM-0009` | `team` CLI |
| [TASK-TEAM-0011](./TASK-TEAM-0011-team-start-status-runtime.task.md) | M5 | Team start/status runtime | done | `TASK-TEAM-0009` | `team` runtime |
| [TASK-TEAM-0012](./TASK-TEAM-0012-permission-lease-validator.task.md) | M5 | Permission lease validator | done | `TASK-TEAM-0011` | lease validator |
| [TASK-TEAM-0013](./TASK-TEAM-0013-file-write-scope-validator.task.md) | M5 | file.write scope validator | done | `TASK-TEAM-0012` | scope validator |
| [TASK-TEAM-0014](./TASK-TEAM-0014-atomic-police-patrol-reports.task.md) | M6 | Atomic police patrol reports | done | `TASK-TEAM-0013` | patrol CLI/report |
| [TASK-TEAM-0015](./TASK-TEAM-0015-next-playbook-team-recommendation.task.md) | M6 | Next/playbook team recommendation | done | `TASK-TEAM-0011`, `TASK-TEAM-0012` | `next` / playbook |
| [TASK-TEAM-0016](./TASK-TEAM-0016-closure-packet-team-summary-integration.task.md) | M6 | Closure packet team summary integration | done | `TASK-TEAM-0013`, `TASK-TEAM-0014`, `TASK-TEAM-0015` | closure / evidence |
| [TASK-TEAM-0017](./TASK-TEAM-0017-team-template-schema-validator-contract.task.md) | M2 | Team template schema and validator contract | done | `TASK-TEAM-0004`, `TASK-TEAM-0005`, `TASK-TEAM-0006` | target closure: `AI-Atomic-Framework` `1b95f9e9`; runner sync: `19e03e1c`; schemas / validator |
| [TASK-TEAM-0018](./TASK-TEAM-0018-team-lease-fencing-deadlock-contract.task.md) | M5H | Team lease fencing and deadlock contract | done | `TASK-TEAM-0011`, `TASK-TEAM-0012`, `TASK-TEAM-0013` | lease / concurrency hardening |
| [TASK-TEAM-0019](./TASK-TEAM-0019-team-sandbox-attestation-closure-contract.task.md) | M6H | Team sandbox attestation and closure contract | done | `TASK-TEAM-0016`, `TASK-TEAM-0018` | sandbox / closure hardening |
| [TASK-TEAM-0020](./TASK-TEAM-0020-team-knowledge-storage-boundary-index-contract.task.md) | M2K | Team knowledge storage boundary and index contract | done | `TASK-TEAM-0005`, `TASK-TEAM-0017` | knowledge contract / storage boundary |
| [TASK-TEAM-0025](./TASK-TEAM-0025-task-import-dispatch-metadata-preservation.task.md) | M4K | Task import dispatch metadata preservation | done | `TASK-TEAM-0017`, `TASK-TEAM-0020` | task import / canonical ledger / sidecar dispatch |
| [TASK-TEAM-0026](./TASK-TEAM-0026-team-safe-mirror-import-ledger-reconciliation-lane.task.md) | M4R | TEAM safe mirror/import ledger reconciliation lane | done | `TASK-TEAM-0001` (Phase 0 opener) | 3KLife planning opener frozen -> later AI-Atomic-Framework Phase 1 handoff |
| [TASK-TEAM-0027](./TASK-TEAM-0027-team-command-atom-boundary-preflight.task.md) | M1P | Team command atom boundary preflight | done | `TASK-TEAM-0001`, `TASK-AAO-0106` | team CLI/spec atom boundaries |
| [TASK-TEAM-0028](./TASK-TEAM-0028-team-same-atom-cid-negative-control.task.md) | M1N | Team same-atom CID negative control | abandoned | `TASK-TEAM-0027`, `0002/0003` positive PASS | ledger id collision / planning residue; do not use as closure evidence |
| [TASK-TEAM-0030](./TASK-TEAM-0030-team-agents-planning-repo-path-lease-normalization.task.md) | M5P | Team Agents planning-repo path lease normalization | done | `TASK-TEAM-0029` | planning path lease normalization |
| [TASK-TEAM-0031](./TASK-TEAM-0031-team-runtime-mode-and-adapter-contract.task.md) | M5R | Team runtime mode and adapter contract | done | `TASK-TEAM-0011`, `TASK-TEAM-0012`, `TASK-TEAM-0030` | team runtime mode / adapter selection |
| [TASK-TEAM-0032](./TASK-TEAM-0032-editor-subagent-bridge-contract.task.md) | M5R | Editor subagent bridge contract | done | `TASK-TEAM-0031` | editor subagent execution surface |
| [TASK-TEAM-0033](./TASK-TEAM-0033-team-reviewer-validator-rework-route-state-machine.task.md) | M6R | Team reviewer-validator rework route state machine | done | `TASK-TEAM-0014`, `TASK-TEAM-0016`, `TASK-TEAM-0031` | rework routing / runtime state |
| [TASK-TEAM-0034](./TASK-TEAM-0034-role-artifact-handoff-and-bounded-retry-contract.task.md) | M6R | Role artifact handoff and bounded retry contract | done | `TASK-TEAM-0033` | artifact contract / retry policy |
| [TASK-TEAM-0035](./TASK-TEAM-0035-nodejs-reference-worker-adapter-and-broker-only-fallback.task.md) | M6R | Node.js reference worker adapter and broker-only fallback | done | `TASK-TEAM-0031`, `TASK-TEAM-0032`, `TASK-TEAM-0034` | Node.js worker / broker-only runtime |
| [TASK-TEAM-0036](./TASK-TEAM-0036-python-and-csharp-reference-worker-adapter-examples.task.md) | M7R | Python and C# reference worker adapter examples | done | `TASK-TEAM-0035`, `TASK-TEAM-0019` | polyglot worker examples |
| [TASK-TEAM-0037](./TASK-TEAM-0037-vendor-neutral-team-agent-provider-contract-and-orchestration-kernel.task.md) | M8I | Vendor-neutral Team agent provider contract and orchestration kernel | done | `TASK-TEAM-0031`..`0036` | runtime core / provider contract |
| [TASK-TEAM-0038](./TASK-TEAM-0038-permission-broker-and-configurable-policy-layer.task.md) | M8I | Permission broker and configurable policy layer | done | `TASK-TEAM-0037` | policy / lease / permission broker |
| [TASK-TEAM-0039](./TASK-TEAM-0039-governed-repo-vendor-integration-config-surface.task.md) | M8I | Governed-repo vendor integration config surface | done | `TASK-TEAM-0037`, `TASK-TEAM-0038` | adopter repo vendor config |
| [TASK-TEAM-0040](./TASK-TEAM-0040-cross-vendor-observability-and-query-log.task.md) | M8I | Cross-vendor observability and query log | done | `TASK-TEAM-0037` | runtime event log / query |
| [TASK-TEAM-0041](./TASK-TEAM-0041-provider-selection-defaults-and-role-overrides.task.md) | M8I | Provider selection defaults and role overrides | done | `TASK-TEAM-0037`, `TASK-TEAM-0038`, `TASK-TEAM-0039` | provider policy / role routing |
| [TASK-TEAM-0046](./TASK-TEAM-0046-broker-conflict-resolution-command.task.md) | M8E | Broker conflict resolution command | done | `TASK-TEAM-0038`, `TASK-TEAM-0041` | broker conflict artifact / resolve command |
| [TASK-TEAM-0047](./TASK-TEAM-0047-broker-override-gate-parity.task.md) | M8E | Broker override gate parity | done | `TASK-TEAM-0046` | four-entry broker conflict gate |
| [TASK-TEAM-0048](./TASK-TEAM-0048-conflict-ux-and-captain-playbook.task.md) | M8E | Conflict UX and Captain playbook | done | `TASK-TEAM-0046` | conflict UX / captain playbook |
| [TASK-TEAM-0042](./TASK-TEAM-0042-openai-and-azure-openai-runtime-bridges.task.md) | M9I | OpenAI and Azure OpenAI runtime bridges | done | `TASK-TEAM-0037`, `TASK-TEAM-0038`, `TASK-TEAM-0041` | direct provider bridges |
| [TASK-TEAM-0043](./TASK-TEAM-0043-claude-code-and-gemini-execution-bridges.task.md) | M9I | Claude Code and Gemini execution bridges | done | `TASK-TEAM-0037`, `TASK-TEAM-0038`, `TASK-TEAM-0039`, `TASK-TEAM-0041` | editor / hybrid bridges |
| [TASK-TEAM-0044](./TASK-TEAM-0044-microsoft-foundry-provider-family-bridge.task.md) | M9I | Microsoft Foundry provider family bridge | done | `TASK-TEAM-0037`, `TASK-TEAM-0038`, `TASK-TEAM-0039`, `TASK-TEAM-0041` | Foundry chat / agent-service bridge |
| [TASK-TEAM-0045](./TASK-TEAM-0045-integration-capability-manifest-and-verification-wiring.task.md) | M9I | Integration capability manifest and verification wiring | done | `TASK-TEAM-0039`, `TASK-TEAM-0040`, `TASK-TEAM-0041`, `TASK-TEAM-0042`, `TASK-TEAM-0043`, `TASK-TEAM-0044` | integration verify / doctor / runtime discovery |
| [TASK-TEAM-0050](./TASK-TEAM-0050-team-start-provider-execution-wiring.task.md) | M10X | Team start provider execution wiring | done | `TASK-TEAM-0045` | real multi-bot spawn lane |
| [TASK-TEAM-0051](./TASK-TEAM-0051-per-role-provider-config-and-sizing-roster.task.md) | M10X | Per-role provider selection config surface and sizing-driven roster | done | `TASK-TEAM-0050` | provider config / sizing roster |
| [TASK-TEAM-0052](./TASK-TEAM-0052-heterogeneous-multi-bot-e2e-proof.task.md) | M10X | Heterogeneous multi-bot team run end-to-end proof | done | `TASK-TEAM-0050`, `TASK-TEAM-0051` | multi-provider proof |
| [TASK-TEAM-0053](./TASK-TEAM-0053-gemini-direct-api-bridge.task.md) | M10X | Gemini direct API bridge for Team provider matrix | done | `TASK-TEAM-0050`, `TASK-TEAM-0051`, `TASK-TEAM-0052` | Gemini direct API bridge |
| [TASK-TEAM-0065](../CAPTAIN-HANDOFF-2026-07-11-TASK-TEAM-0053-GEMINI-DIRECT-CONTINUATION.md) | M10X | Team Agents 0053-0065 historical closeback | done | delivery `072cadf4` | ledger-only historical closeback (no planning card) |
| [TASK-TEAM-0066](./TASK-TEAM-0066-paid-multi-vendor-live-dogfood.task.md) | M10X | Paid OpenAI and Anthropic Team Agents live dogfood | done | `TASK-TEAM-0053` | paid live dogfood / redacted evidence |
| [TASK-TEAM-0067](./TASK-TEAM-0067-direct-provider-execute-admission-repair.task.md) | M10X | Repair direct-provider execute admission and fail-close | done | `TASK-TEAM-0066` | execute admission / fail-close repair |
| [TASK-TEAM-0068](./TASK-TEAM-0068-direct-provider-scoped-path-forwarding.task.md) | M10X | Forward governed task scope to direct provider bridges | done | `TASK-TEAM-0067` | scoped path forwarding |
| [TASK-TEAM-0069](./TASK-TEAM-0069-lock-cleanup-canonical-direction-lock.task.md) | M10X | Release canonical direction lock during stale lock cleanup | done | none | lock cleanup hygiene |
| [TASK-TEAM-0070](./TASK-TEAM-0070-openai-metadata-string-values.task.md) | M10X | Normalize OpenAI Responses metadata values to strings | done | `TASK-TEAM-0067` | provider metadata fix |
| [TASK-TEAM-0071](./TASK-TEAM-0071-three-vendor-artifact-handoff-and-context-benchmark.task.md) | M10X | Three-vendor direct execution, artifact handoff, and context benchmark | done | `TASK-TEAM-0068`, `TASK-TEAM-0070` | three-vendor E2E benchmark |
| [TASK-TEAM-0021](./TASK-TEAM-0021-team-knowledge-build-query-dry-run.task.md) | M4K | Team knowledge build and query dry-run | done | `TASK-TEAM-0020` | knowledge build / query |
| [TASK-TEAM-0023](./TASK-TEAM-0023-team-knowledge-retention-disk-budget-guard.task.md) | M5K | Team knowledge retention and disk budget guard | done | `TASK-TEAM-0021` | compact / stats / budget guard |
| [TASK-TEAM-0022](./TASK-TEAM-0022-captain-knowledge-preflight-brief-integration.task.md) | M6K | Captain knowledge preflight brief integration | done | `TASK-TEAM-0015`, `TASK-TEAM-0021` | `next` / `team plan` guidance |
| [TASK-TEAM-0024](./TASK-TEAM-0024-hybrid-knowledge-retrieval-opt-in.task.md) | M7K | Hybrid knowledge retrieval opt-in | done | `TASK-TEAM-0021`, `TASK-TEAM-0023` | optional vector rerank |

## Sequencing Note

Open and import these cards by milestone order. Do not reuse the previous `TASK-TEAM-0001` to `TASK-TEAM-0004` draft semantics; those early drafts were superseded by the M0-M6 rollout.

## Ledger Truth Note

- `AI-Atomic-Framework/.atm/history/tasks/*.json` is the authoritative lifecycle source for Team cards that have been imported into the framework repo.
- As of 2026-06-19, the imported runtime and knowledge closure set includes `TASK-TEAM-0014..0028`, `TASK-TEAM-0030`, and `TASK-TEAM-0031..0036`.
- Early planning cards may still be valid in `3KLife` even when no imported framework ledger exists for them yet; treat `missing-in-ledger` as a routing fact, not an automatic corruption signal.
- The runtime extension lane `TASK-TEAM-0031..0036` is no longer planning-only in `3KLife`; use the framework ledger plus closure packets as lifecycle truth for that lane.
- The multi-vendor runtime and integration lane `TASK-TEAM-0037..0045` is planning-only in `3KLife` until implementation cards are imported and closed in the framework repo.
- The M8E broker enforcement lane `TASK-TEAM-0046..0048` is inserted between M8I and M9I. It must use the shared vocabulary `decisionClass`, `decisionReason`, `violationStatus`, and `broker-conflict-blocked`, and must not touch `docs/ai_atomic_framework/rft-hardening/**`, `scripts/captain-dispatch-mailbox/**`, `scripts/validators/task-ledger/**`, `packages/core/src/police/**`, or RFT split helper files while Cursor RFT residue or locks exist.
- When task-card frontmatter and this roster diverge, fix the roster to match the imported ledger for imported cards, or to match the planning card when the card has never been imported.

## Practical Rollout Order

Use this order when the goal is "ship Team Agents in a way humans can actually adopt", not "open every future card as early as possible":

1. `TASK-TEAM-0001` to freeze the lane and clean the roster truth.
2. `TASK-AAO-0106` (done) and `TASK-TEAM-0027` (done) landed the path-map owner shards and Team command/spec atom boundaries in AAF.
3. Canonical CID proof pair is closed: `0002 vs 0003` positive-control PASS and `TASK-TEAM-0028` same-atom negative-control PASS (`blocked-cid-conflict`, `kind: cid`, atom-level evidence).
4. `TASK-TEAM-0004`, `TASK-TEAM-0005`, `TASK-TEAM-0006`, then `TASK-TEAM-0017` so the first-card template stack and its schema/validator become stable.
5. `TASK-TEAM-0007`, `TASK-TEAM-0008`, `TASK-TEAM-0009`, `TASK-TEAM-0010` to turn docs-only roles into a real team planning/runtime surface.
6. `TASK-TEAM-0011`, `TASK-TEAM-0012`, `TASK-TEAM-0013` to make runtime state, permission lease, and file-write boundaries trustworthy.
7. `TASK-TEAM-0014` and `TASK-TEAM-0015` in parallel where possible, then `TASK-TEAM-0016` to close the first full plan -> run -> report -> close loop.
8. `TASK-TEAM-0018`, `TASK-TEAM-0019` only after the core runtime loop is stable, because they harden concurrency and attestation rather than bootstrap the lane.
9. `TASK-TEAM-0026` Phase 0 opener can run early in parallel with the above as a planning bridge, but its Phase 1 AAF reconciliation must wait for the knowledge-track prerequisites below.
10. `TASK-TEAM-0020` -> `TASK-TEAM-0025` -> `TASK-TEAM-0021` -> `TASK-TEAM-0023` -> `TASK-TEAM-0022` -> `TASK-TEAM-0024` as the advisory knowledge track.
11. `TASK-TEAM-0026` Phase 1 handoff only after `TASK-TEAM-0020` and `TASK-TEAM-0025` are closed and the safe subset still holds.
12. `TASK-TEAM-0031` -> `TASK-TEAM-0032` -> `TASK-TEAM-0033` -> `TASK-TEAM-0034` -> `TASK-TEAM-0035` -> `TASK-TEAM-0036` is the runtime adaptor and rework-loop extension lane; treat the imported 0011/0012/0013/0015/0016/0017/0027/0028/0029/0030 set as historical baseline, not as cards to reopen for this lane.
13. `TASK-TEAM-0037` -> `TASK-TEAM-0038` -> `TASK-TEAM-0039` -> `TASK-TEAM-0041` forms the M8I provider/policy base. Run M8E next as `TASK-TEAM-0046` -> `TASK-TEAM-0047` with `TASK-TEAM-0048` aligned to SKL-0009, then let `TASK-TEAM-0040` absorb broker conflict events before M9I vendor bridges. Only after that run `TASK-TEAM-0042` / `TASK-TEAM-0044` / `TASK-TEAM-0043` -> `TASK-TEAM-0045`.

## Parallelization Plan for M1-M2

The line-graph dependency above (`0002 -> 0003 -> 0004 -> 0005 -> 0006`) was tightened during the 2026-06-03 dispatch review. The actual file footprints permit the following collapse:

```
M0: 0001 (done)
        |
M1P:    +--> AAO-0106 (done, path map owner shards)
        +--> 0027 (done, Team atom boundary preflight)
        +--> 0028 (done, same-atom CID negative control)
        |
M1:     +--> 0002 (crew contract)   ----+
        +--> 0003 (done, atomization role) ---+   (positive-control PASS closed)
                                        |
M2:                                     +--> 0004 (brief/report/summary)
                                                       |
                                                       +--> 0005 (decision/memory)  ----+
                                                       +--> 0006 (patrol)               +   (run in parallel)
```

- `0002` and `0003` write to disjoint doc paths (`minimal-task-crew.md` vs `atomization-planner.md`) and may merge in either order for docs-only work.
- `TASK-AAO-0106` and `TASK-TEAM-0027` are closed in AAF; `0002` and `0003` may now target disjoint Team atoms (`team.plan-crew-briefing-contract` vs `team.plan-atomization-planner`) for the first live same-file proof.
- `path-to-atom-map.json` sharding remains owned by `TASK-AAO-0106` owner shards; do not open a duplicate sharding card.
- `0005` and `0006` write to disjoint template files but share the same validator script. They may build in parallel; merge sequentially so the second-merged card extends the first card's validator section additions.
- `0004` is the single synchronization point between M1 and M2: it lands the first version of the shared validator script (`scripts/validate-team-agents-templates.ts`) that `0005` and `0006` extend.

## Dispatch Contract for M1-M2

Every card from `TASK-TEAM-0002` through `TASK-TEAM-0006` carries a `dispatch_pattern` block in its frontmatter declaring:

- `phase_0` (read-only planner) + `phase_1` (external builder) split — the dual-agent pattern that physically prevents Phase 1 from touching `C:/Users/User/3KLife/**`.
- `commit_budget`: 0 for Phase 0 (planning only), 2 for Phase 1 (AAF strict 2-commit rule).
- `forbidden_files`: at minimum `C:/Users/User/3KLife/**`, `.atm/runtime/**`, `.atm/history/**`.
- `condition_review`: per-card checklist for close.

This pattern translates the captain dispatch lessons from memory (mirror-commit incidents 0064 / 0075 / 0077 / 0088) into per-card enforceable allowed-files whitelists.

## Knowledge Track Sequencing

The knowledge loop is a separate advisory track layered on top of the core Team Agents rollout:

```
0005 / 0017
      |
      +--> 0020 (storage boundary + index contract)
                |
                +--> 0025 (dispatch metadata preservation)
                |
                +--> 0021 (build/query dry-run) ----+
                |                                    |
                +--> 0023 (retention/budget)         +--> 0022 (captain preflight brief)
                                                     |
                                                     +--> 0024 (hybrid retrieval opt-in)
```

- `0020` must land before any query runtime exists, because it defines `.atm/knowledge/**` vs `.atm/runtime/knowledge/**`.
- `0025` is the ledger-only bridge: it preserves `dispatch_pattern` / `condition_review` into canonical task JSON so sidecars can stop dual-reading Markdown plus ledger.
- `0021` proves lexical-first query works before the project even considers vector rerank.
- `0023` is intentionally earlier than `0024`; disk pressure and compaction policy are not optional follow-up nice-to-haves.
- `0022` only surfaces compact hits into guidance. It must not turn advisory knowledge into a required gate.

## 90-Minute First-Card Promise

`TASK-TEAM-0004`, `TASK-TEAM-0005`, and `TASK-TEAM-0006` each carry a `ninety_minute_promise` block. Together they ship the artifact chain that lets a new adopter run their first governed task card in under 90 minutes:

| Minute | Adopter sees |
|---|---|
| 0-15 | `npx create-atm` succeeds, `atm doctor` green |
| 15-30 | Copy `examples/team-agents-minimal/team-brief.md` (from 0004), edit 4 fields |
| 30-60 | `atm next` -> agent claim -> small edit -> `npm run typecheck` |
| 60-80 | `validate-team-agents-templates.ts` (from 0004+0005+0006) green; agent-report.md ready |
| 80-90 | `atm tasks close` -> closure packet + first patrol-report.md (from 0006) |

The promise is verifiable after all three M2 cards close: an `examples/team-agents-minimal/` directory exists in the framework repo, and a wall-clock dry run of the steps above completes in under 90 minutes for at least one observer.

The knowledge track starts after that first-card promise is already stable. New adopters should be able to finish the first governed card without a knowledge index; the index is an acceleration layer, not a bootstrap dependency.

## CID Hardening Synchronization

The 2026-06-03 CID Hardening v2 review added two Team Agents follow-up cards:

- `TASK-TEAM-0018` maps CID Hardening E2 into Team Agents. It treats `leaseEpoch`, fencing tokens, wait-for graph deadlock detection, and stronger released-tombstone coverage as new hardening work, not current behavior.
- `TASK-TEAM-0019` maps CID Hardening E3 into Team Agents. It treats sandbox attestation fields (`runnerKind`, `runtimeVersion`, `sandboxPolicyHash`, `attestationSigner`) as new closure-supporting metadata, not existing command-backed evidence.

Captain ruling for concurrency: Team Agents adopts the concurrency contract; CID E2 defines the concurrency primitive. `TASK-TEAM-0018` must consume `Active Resource Index` / `Scope Lease Registry` as a read-only diagnostic and validation source only. It must not introduce task dispatch, queue management, claim/close decisions, or a second scheduler.

These cards preserve the existing Team Agents rule: Team Agents accelerate scoped work, but they do not relax ATM gates, task evidence, closure packets, or coordinator-only lifecycle ownership.

The 2026-06-05 brokered write review adds one CID-side integration card:

- `TASK-CID-0012` maps brokered write governance into Team Agents. CID still owns `tasks parallel`, write intent, patch proposal, merge plan, and break-glass contracts. Team Agents consumes those contracts through existing roles and permissions: Coordinator, Scope Guardian, Atomization Planner, Implementer, Neutral Write Steward, Validator, Review Agent, and Evidence Collector.

Captain ruling for brokered writes: Team Agents is the execution surface, not a replacement scheduler. `team plan` / `team start` may show or consume the broker lane recommendation, but Coordinator remains the only lifecycle / commit owner, and Neutral Write Steward must not hold `git.write` or `task.lifecycle`.

Important architecture note: Write Broker is global per repo/workspace. Each task can have its own Team Agents, but all active teamRuns must register write intents against the same broker registry; otherwise Team Agents would only see intra-task collisions and miss cross-task conflicts.

## Knowledge Layer Guardrail

All `TASK-TEAM-0020+` cards must keep the knowledge layer advisory-only:

- no second registry
- no second task store
- no auto-promotion into `behavior.evolve`
- no committed embedding cache
- no requirement that every agent query the corpus before it can work

## Safe Mirror / Import Reconciliation Lane

`TASK-TEAM-0026` is the 3KLife planning bridge for the safe TEAM mirror/import subset. It is now intentionally shaped as an executable Phase 0 opener in 3KLife, while the actual AAF reconciliation remains a later Phase 1 handoff.

- Phase 0 writes only the 3KLife planning docs, the task card, and the TEAM ledger/shard, and may close in `planning_repo`.
- Phase 0 may start before `TASK-TEAM-0020` and `TASK-TEAM-0025`, because its job is to freeze the route rather than execute the route.
- Phase 1 target repo is `AI-Atomic-Framework`, and the safe subset remains `TASK-TEAM-0001..0019 / 0025`.
- Phase 1 must still wait for `TASK-TEAM-0020` and `TASK-TEAM-0025`, because those cards stabilize the knowledge boundary and canonical dispatch metadata.
- The forbidden residue is `TASK-TEAM-0020..0024`, `TASK-AAO-*`, and AAF source/runtime noise.
- The ledger stays compact so route checks stay fast and disk pressure stays low.

## Sidecar Kickoff

The current kickoff order for a sidecar-assisted knowledge track is:

1. `TASK-TEAM-0026` Phase 0 opener
2. `TASK-TEAM-0020`
3. `TASK-TEAM-0025`
4. `TASK-TEAM-0021`
5. `TASK-TEAM-0023`
6. `TASK-TEAM-0022`
7. `TASK-TEAM-0024` only if lexical-first evidence proves it is needed
8. `TASK-TEAM-0026` Phase 1 handoff only after `TASK-TEAM-0020` and `TASK-TEAM-0025`

Execution source split:

- The Markdown task card remains the dispatch source for `dispatch_pattern`, `phase_0`, `phase_1`, and `condition_review`.
- The imported ATM ledger JSON under `.atm/history/tasks/*.json` is the lifecycle source for task identity, dependencies, status, and validators.
- Until `TASK-TEAM-0025` lands, a sidecar should read both surfaces instead of relying on ledger JSON alone.

Practical captain rule:

- Phase 0 sidecar reads the Markdown task card, prepares the brief, and does not mutate source.
- Phase 1 builder follows the same card's `allowed_files_strict` / `forbidden_files` fence and uses ATM ledger status only for claim / close lifecycle.

| [TASK-TEAM-0086](./TASK-TEAM-0086-paid-provider-preflight-probe.task.md) | M10X | Opt-in paid provider quota preflight probe | done | `TASK-TEAM-0050`, `TASK-TEAM-0051` | Team provider preflight / execution gate |
| [TASK-TEAM-0087](./TASK-TEAM-0087-sync-0086-planning-projections.task.md) | Team Broker Maintainability | Sync completed TASK-TEAM-0086 planning projections | planned | `TASK-TEAM-0086` | Planning projection maintenance |
