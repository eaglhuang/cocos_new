---
task_id: ATM-GOV-0419
title: Publish onefile neutrality policy repair through the runner-sync steward
status: done
owner: atm-release
priority: P1
depends_on: []
causalGraph:
  causalDependencies: []
  startConditions: []
  softRelations: []
  changedPublicSeams:
    - frozen onefile runner publication
  causalImpactEdges:
    - onefile-self-host-alpha-clean-install
  parallelFrontierInputs: []
  validatorReferences:
    - validate-onefile-release
    - validate-self-hosting-alpha
  phaseOwner: atm-release
related_plan: docs/ai_atomic_framework/governance-optimization/README.md
planning_repo: C:/Users/User/3KLife
target_repo: AI-Atomic-Framework
closure_authority: target_repo
scopePaths:
  - scripts/build-onefile-release.ts
  - scripts/validate-onefile-release.ts
  - release/atm-onefile/atm.mjs
  - release/atm-onefile/release-manifest.json
  - release/atm-root-drop/**
deliverables:
  - release/atm-onefile/atm.mjs
  - release/atm-onefile/release-manifest.json
  - release/atm-root-drop/**
validators:
  - npm run validate:onefile-release
  - npm run validate:self-hosting-alpha
  - npm run validate:runner-reproducibility
testContributions:
  - caseId: test_onefile_neutrality_policy_self_host_alpha_0419
    targetGroupId: null
    semanticKey: onefile_neutrality_policy_self_host_alpha
    coversAcceptance: [ACC-1, ACC-2]
    coversImpactEdges: [onefile-self-host-alpha-clean-install]
    expectedRedPredicate: clean extracted self-host-alpha verification fails with missing neutrality policy
    contributionResourceKey: null
    responsibility: task-required
    dependencyEdge: null
    contractEdge: onefile-neutrality-policy-closure
    resourceKey: null
requiredTestCaseIds:
  - test_onefile_neutrality_policy_self_host_alpha_0419
phaseTestCaseIds: []
advisoryTestCaseIds: []
tddMode: recommended
tddNotApplicableReason: null
tddExemptions: []
methodProfiles:
  - expand-contract
evidence:
  required: command-backed
rollback:
  strategy: revert-commit
atomizationImpact:
  ownerAtomOrMap: atm.release-build-map
  mapUpdates: []
  extractionCandidates: []
completed_at: "2026-09-06T23:38:50.015Z"
completed_by_agent: "codex-captain"
closedAt: "2026-09-06T23:38:50.015Z"
closedByActor: "codex-captain"
closedByCommand: atm tasks close
lastTransitionId: "2026-09-06T23-38-50-015Z-close-62cb0c683f68"
lastTransitionAt: "2026-09-06T23:38:50.015Z"
ledgerContractVersion: task-ledger/v1
delivery_commit: "41e88ba06a1c6e0611303d454d7496ef5508657f"
---

## Acceptance

- **ACC-1:** The runner-sync steward publishes the repaired source at a current sealed source SHA and records the exact release-surface receipt.
- **ACC-2:** The published onefile passes clean extracted `self-host-alpha --verify`, including the neutrality scan, with no missing `docs/governance/docs-neutrality-policy.json` error.

## Boundary

This card publishes already-committed source repair `f4a0abd7b8bd5a9dd7bc09fb3ed5738dc20c6bb6`. It does not alter the source fix, npm package contents, unrelated release residue, or foreign work.

## Recovery

If a validator fails, retain the governed runner-sync receipt and report the exact failed step. Revert only the publication commit if rollback is required.
