---
doc_id: doc_task_team_0086
task_id: TASK-TEAM-0086
title: Opt-in paid provider quota preflight probe
status: done
owner: atm-team
priority: P1
milestone: M10X
depends_on:
  - TASK-TEAM-0050
  - TASK-TEAM-0051
planning_repo: 3KLife
related_plan: docs/ai_atomic_framework/team-agents/團隊自動化代理分工計畫.md
target_repo: AI-Atomic-Framework
closure_authority: target_repo
scopePaths:
  - packages/cli/src/commands/team/provider-preflight.ts
  - packages/cli/src/commands/team/legacy/provider-execution.ts
  - packages/cli/src/commands/team/legacy/command-runner.ts
  - tests/cli/team-provider-preflight.test.ts
  - tests/cli/team-provider-preflight-probe.test.ts
deliverables:
  - packages/cli/src/commands/team/provider-preflight.ts
  - packages/cli/src/commands/team/legacy/provider-execution.ts
  - packages/cli/src/commands/team/legacy/command-runner.ts
  - tests/cli/team-provider-preflight.test.ts
  - tests/cli/team-provider-preflight-probe.test.ts
validators:
  - node --strip-types tests/cli/team-provider-preflight.test.ts
  - node --strip-types tests/cli/team-provider-preflight-probe.test.ts
  - npm run typecheck
  - git diff --check
causalGraph:
  causalDependencies:
    - TASK-TEAM-0050
    - TASK-TEAM-0051
  startConditions:
    - Existing static provider preflight remains green.
    - Operator explicitly enables the paid probe route.
    - Provider secrets use the existing secret boundary and never appear in evidence.
  softRelations:
    - ATM-BUG-2026-07-11-100
  changedPublicSeams:
    - team-provider-preflight
    - team-execution-admission
  causalImpactEdges:
    - paid-provider-request-count
    - quota-billing-stop-before-roster
  parallelFrontierInputs:
    - provider-preflight
  validatorReferences:
    - team-provider-preflight.test.ts
    - team-provider-preflight-probe.test.ts
  phaseOwner: atm-team
tddMode: required
tddNotApplicableReason: null
testContributions:
  - caseId: test_task_team_0086_paid_provider_probe_6b2a4c91
    targetGroupId: null
    semanticKey: paid_provider_probe
    coversAcceptance: [ACC-1, ACC-2, ACC-3, ACC-4]
    coversImpactEdges: [paid-provider-request-count, quota-billing-stop-before-roster]
    expectedRedPredicate: An enabled probe is absent and the full roster can start without a provider probe receipt.
    contributionResourceKey: null
    responsibility: task-required
    dependencyEdge: null
    contractEdge: team-provider-preflight
    resourceKey: team-provider-preflight
requiredTestCaseIds:
  - test_task_team_0086_paid_provider_probe_6b2a4c91
phaseTestCaseIds: []
advisoryTestCaseIds: []
methodProfiles:
  - expand-contract
evidence:
  required: command-backed
rollback:
  strategy: revert-commit
  notes: Remove the opt-in probe route and focused tests; static preflight remains unchanged.
atomizationImpact:
  ownerAtomOrMap: atm.team-agents-runtime
  mapUpdates: []
  extractionCandidates:
    - atom: atm.team-provider-preflight-probe
      pattern: Policy Object
      source: packages/cli/src/commands/team/provider-preflight.ts
      disposition: extract
      inlineReason: null
team:
  required: true
  teamLevel: L3
  roleProviders:
    implementer: provider-neutral:implementation
    validator: provider-neutral:validation
  runtimeTier:
    reader: raw-api
    implementer: agent-sdk
    lieutenant: editor
  review:
    requiredFormalSignatures: 1
    reviewerIndependencePolicy: different-provider
  knowledge:
    permissions: []
  observability:
    requiredEventTypes:
      - provider.probe.started
      - provider.probe.completed
      - provider.probe.blocked
errorCodes: []
completed_at: "2026-09-06T20:36:30.256Z"
completed_by_agent: "codex-captain"
closedAt: "2026-09-06T20:36:30.256Z"
closedByActor: "codex-captain"
closedByCommand: atm tasks close
lastTransitionId: "2026-09-06T20-36-30-256Z-close-776487d7d7cf"
lastTransitionAt: "2026-09-06T20:36:30.256Z"
ledgerContractVersion: task-ledger/v1
delivery_commit: "a787c2347ecdb537666b703cd6d811e873da26e1"
---

# TASK-TEAM-0086 Opt-in paid provider quota preflight probe

## Goal

Prevent a paid multi-provider Team run from launching the full role roster before
the operator has observed one bounded readiness probe per provider.

## Acceptance Criteria

- ACC-1: The probe is opt-in and never sends a paid request without explicit operator authorization.
- ACC-2: At most one minimal probe request is sent per provider in one preflight, and evidence records the exact count without secrets.
- ACC-3: The result distinguishes authentication, model access, request schema, quota, and billing failure classes; quota/billing failure stops the full roster.
- ACC-4: Continuation after quota/billing failure requires a separate explicit operator action and is auditable; existing static preflight remains compatible.

## Non-goals

- No provider secret storage or redaction-policy replacement.
- No price/catalog redesign, release workflow change, or external benchmark execution.

## Red/green requirement

The focused probe case must first fail against the current source because an enabled
probe is not enforced before roster execution, then pass after the smallest general
implementation. Red and green receipts must bind the same case id, public seam, and
acceptance IDs.
