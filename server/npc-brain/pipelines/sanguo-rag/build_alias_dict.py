from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel, Field


DEFAULT_GENERALS_PATH = Path("assets/resources/data/generals.json")
DEFAULT_OVERRIDES_PATH = Path("server/npc-brain/pipelines/sanguo-rag/config/general-alias-overrides.json")
DEFAULT_MANUAL_ROSTER_PATH = Path("server/npc-brain/pipelines/sanguo-rag/config/manual-roster-seeds.json")
DEFAULT_OUTPUT_ROOT = Path("artifacts/data-pipeline/sanguo-rag/extracted/alias-dictionary")
DEFAULT_OBSERVED_MENTIONS_PATH = Path("artifacts/data-pipeline/sanguo-rag/extracted/observed-mentions/observed-mentions.json")
DECORATIVE_WRAPPER_CHARS = "【】[]()（）「」『』《》〈〉"
SOURCE_PRIORITY = {"name": 0, "override": 1, "alias": 2, "title": 3}
SOURCE_LABELS = {
    "name": "roster-name",
    "alias": "roster-alias",
    "title": "title-derived",
    "override": "manual-override",
}


class AliasOverrideEntry(BaseModel):
    generalId: str = Field(description="Canonical general id")
    add: list[str] = Field(default_factory=list, description="Aliases to add")
    remove: list[str] = Field(default_factory=list, description="Aliases to remove after merge")


class AliasOverrideConfig(BaseModel):
    version: str = Field(description="Override config version")
    globalExcludedAliases: list[str] = Field(default_factory=list, description="Aliases to exclude globally")
    entries: list[AliasOverrideEntry] = Field(default_factory=list, description="Per-general override entries")


class ManualRosterEntry(BaseModel):
    generalId: str = Field(description="Canonical general id")
    name: str | None = Field(default=None, description="Canonical roster display name")
    faction: str | None = Field(default=None, description="Faction key when adding a new manual roster entry")
    title: str | None = Field(default=None, description="Optional display title for alias seeding")
    alias: list[str] = Field(default_factory=list, description="Extra aliases to merge into the roster seed")


class ManualRosterConfig(BaseModel):
    version: str = Field(description="Manual roster seed schema version")
    entries: list[ManualRosterEntry] = Field(default_factory=list, description="Manual roster additions and alias supplements")


class AliasCandidate(BaseModel):
    label: str = Field(description="Human-readable alias label")
    normalized: str = Field(description="Normalized alias used for matching")
    aliasSource: str = Field(default="", description="Primary provenance category for this alias")
    aliasType: str = Field(default="", description="Alias type used by downstream review and matching")
    reviewStatus: str = Field(default="accepted", description="accepted or collision")
    sources: list[str] = Field(description="Where this alias came from")


class GeneralAliasRecord(BaseModel):
    generalId: str = Field(description="Canonical general id")
    name: str = Field(description="Primary display name")
    faction: str | None = Field(default=None, description="Faction key")
    title: str | None = Field(default=None, description="Original title field from generals.json")
    aliasCount: int = Field(description="Number of final aliases")
    reviewStatus: str = Field(description="ready or needs-more-coverage")
    needsManualReview: bool = Field(description="Whether this general still needs more alias curation")
    aliases: list[AliasCandidate] = Field(description="Merged final alias candidates")


class AliasMapEntry(BaseModel):
    alias: str = Field(description="Display alias label")
    normalized: str = Field(description="Normalized alias key")
    generalIds: list[str] = Field(description="Candidate general ids for this alias")
    status: str = Field(description="high-confidence or collision")
    sourcesByGeneral: dict[str, list[str]] = Field(description="Alias source list for each general")
    aliasSourceByGeneral: dict[str, str] = Field(description="Primary aliasSource for each general")
    aliasTypeByGeneral: dict[str, str] = Field(description="Alias type for each general")
    reviewStatusByGeneral: dict[str, str] = Field(description="accepted or collision for each general")


class ExcludedAliasRecord(BaseModel):
    generalId: str = Field(description="General id the alias came from")
    alias: str = Field(description="Raw alias label")
    normalized: str = Field(description="Normalized alias value")
    reason: str = Field(description="Why it was excluded")
    source: str = Field(description="Origin source")


class CollisionRecord(BaseModel):
    alias: str = Field(description="Representative alias label")
    normalized: str = Field(description="Normalized alias key")
    generalIds: list[str] = Field(description="Conflicting general ids")


class TopUnresolvedLabelRecord(BaseModel):
    label: str = Field(description="Observed unresolved label")
    normalized: str = Field(description="Normalized observed label")
    mentionType: str = Field(description="address-title, unknown-candidate, or collision")
    count: int = Field(description="Observed mention count")
    sourceRefs: list[str] = Field(description="Sample source refs")
    sampleSnippets: list[str] = Field(description="Sample snippets")


class AliasRecordsBundle(BaseModel):
    version: str = Field(description="Output schema version")
    generatedAt: str = Field(description="UTC timestamp")
    generalsPath: str = Field(description="Input generals.json path")
    overridesPath: str = Field(description="Input override config path")
    data: list[GeneralAliasRecord] = Field(description="Per-general alias records")


class AliasMapBundle(BaseModel):
    version: str = Field(description="Output schema version")
    generatedAt: str = Field(description="UTC timestamp")
    entries: list[AliasMapEntry] = Field(description="Alias-to-general mapping entries")


class AliasReviewReport(BaseModel):
    version: str = Field(description="Output schema version")
    generatedAt: str = Field(description="UTC timestamp")
    totalGenerals: int = Field(description="Number of roster generals processed")
    totalAliasEntries: int = Field(description="Total merged alias entries across generals")
    highConfidenceAliasCount: int = Field(description="Count of non-colliding aliases")
    collisionCount: int = Field(description="Count of colliding normalized aliases")
    excludedCount: int = Field(description="Count of excluded aliases")
    aliasSourceCounts: dict[str, int] = Field(description="Alias count by primary provenance source")
    aliasTypeCounts: dict[str, int] = Field(description="Alias count by aliasType")
    aliasReviewStatusCounts: dict[str, int] = Field(description="Alias count by reviewStatus")
    generalReviewStatusCounts: dict[str, int] = Field(description="General count by reviewStatus")
    observedMentionsPath: str | None = Field(default=None, description="Observed mentions input path when available")
    unresolvedLabelTypeCounts: dict[str, int] = Field(default_factory=dict, description="Unresolved observed label count by mentionType")
    topUnresolvedLabels: list[TopUnresolvedLabelRecord] = Field(default_factory=list, description="Most frequent unresolved observed labels")
    generalsNeedingManualReview: list[str] = Field(description="Generals with weak alias coverage")
    unknownOverrideGeneralIds: list[str] = Field(description="Override entries whose generalId was not found")
    collisions: list[CollisionRecord] = Field(description="Alias collisions that require review")
    excludedAliases: list[ExcludedAliasRecord] = Field(description="Aliases filtered out before final map")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a deterministic general alias dictionary from generals.json and tracked manual overrides."
    )
    parser.add_argument("--generals", default=str(DEFAULT_GENERALS_PATH), help="Path to assets/resources/data/generals.json")
    parser.add_argument(
        "--overrides",
        default=str(DEFAULT_OVERRIDES_PATH),
        help="Path to tracked alias override config",
    )
    parser.add_argument(
        "--manual-roster",
        default=str(DEFAULT_MANUAL_ROSTER_PATH),
        help="Optional manual roster seed used to supplement generals.json coverage",
    )
    parser.add_argument(
        "--output-root",
        default=str(DEFAULT_OUTPUT_ROOT),
        help="Output directory for alias records, map, and review report",
    )
    parser.add_argument(
        "--observed-mentions",
        default=str(DEFAULT_OBSERVED_MENTIONS_PATH),
        help="Optional observed-mentions.json path used to add top unresolved label stats",
    )
    parser.add_argument("--top-unresolved", type=int, default=50, help="Number of unresolved labels to keep in review report")
    parser.add_argument("--overwrite", action="store_true", help="Allow overwriting existing output files")
    return parser.parse_args()


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, model: BaseModel) -> None:
    path.write_text(json.dumps(model.model_dump(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_alias(value: str) -> str:
    cleaned = value.strip().strip(DECORATIVE_WRAPPER_CHARS)
    cleaned = re.sub(r"[\s　]+", "", cleaned)
    cleaned = re.sub(r"[·•‧・]", "", cleaned)
    cleaned = cleaned.strip().lower()
    return cleaned


def derive_title_aliases(title: str | None) -> list[str]:
    if not title:
        return []
    stripped = title.strip().strip(DECORATIVE_WRAPPER_CHARS).strip()
    return [stripped] if stripped else []


def choose_alias_source(sources: list[str]) -> str:
    if not sources:
        return "unknown"
    primary = min(sources, key=lambda source: SOURCE_PRIORITY.get(source, 999))
    return SOURCE_LABELS.get(primary, primary)


def derive_alias_type(label: str, canonical_name: str, alias_source: str) -> str:
    if normalize_alias(label) == normalize_alias(canonical_name):
        return "canonical-name"
    if alias_source == "manual-override":
        return "curated-alias"
    if alias_source == "title-derived":
        return "title-alias"
    return "accepted-alias"


def summarize_metadata_counts(records: list[GeneralAliasRecord]) -> tuple[dict[str, int], dict[str, int], dict[str, int], dict[str, int]]:
    alias_source_counts: dict[str, int] = defaultdict(int)
    alias_type_counts: dict[str, int] = defaultdict(int)
    alias_review_status_counts: dict[str, int] = defaultdict(int)
    general_review_status_counts: dict[str, int] = defaultdict(int)

    for record in records:
        general_review_status_counts[record.reviewStatus] += 1
        for alias in record.aliases:
            alias_source_counts[alias.aliasSource] += 1
            alias_type_counts[alias.aliasType] += 1
            alias_review_status_counts[alias.reviewStatus] += 1

    return (
        dict(sorted(alias_source_counts.items())),
        dict(sorted(alias_type_counts.items())),
        dict(sorted(alias_review_status_counts.items())),
        dict(sorted(general_review_status_counts.items())),
    )


def ensure_output_root(path: Path, overwrite: bool) -> None:
    path.mkdir(parents=True, exist_ok=True)
    if not overwrite:
        collisions = [
            existing
            for existing in (
                path / "roster-identity-records.json",
                path / "formal-mention-map.json",
                path / "general-alias-records.json",
                path / "alias-to-general-map.json",
                path / "alias-review-report.json",
            )
            if existing.exists()
        ]
        if collisions:
            raise FileExistsError(f"Output already exists. Re-run with --overwrite: {collisions}")


def load_override_config(path: Path) -> tuple[AliasOverrideConfig, dict[str, AliasOverrideEntry]]:
    config = AliasOverrideConfig.model_validate(read_json(path))
    return config, {entry.generalId: entry for entry in config.entries}


def load_manual_roster_config(path: Path) -> ManualRosterConfig:
    if not path.exists():
        return ManualRosterConfig(version="1.0.0", entries=[])
    return ManualRosterConfig.model_validate(read_json(path))


def merge_manual_roster_entries(generals: list[dict], config: ManualRosterConfig) -> list[dict]:
    merged_generals = [dict(general) for general in generals]
    indexes_by_id = {
        str(general.get("id")): index
        for index, general in enumerate(merged_generals)
        if str(general.get("id") or "").strip()
    }

    for entry in config.entries:
        general_id = entry.generalId.strip()
        if not general_id:
            continue
        if general_id in indexes_by_id:
            record = dict(merged_generals[indexes_by_id[general_id]])
            aliases = [str(alias).strip() for alias in (record.get("alias") or []) if str(alias).strip()]
            seen_aliases = {normalize_alias(alias) for alias in aliases if normalize_alias(alias)}
            for alias in entry.alias:
                cleaned_alias = alias.strip()
                normalized_alias = normalize_alias(cleaned_alias)
                if not normalized_alias or normalized_alias in seen_aliases:
                    continue
                aliases.append(cleaned_alias)
                seen_aliases.add(normalized_alias)
            record["alias"] = aliases
            merged_generals[indexes_by_id[general_id]] = record
            continue

        if not entry.name:
            raise ValueError(f"manual roster entry requires name when generalId is new: {general_id}")
        merged_generals.append(
            {
                "id": general_id,
                "name": entry.name.strip(),
                "alias": [alias.strip() for alias in entry.alias if alias.strip()],
                "faction": entry.faction,
                "title": entry.title.strip() if entry.title else f"【{entry.name.strip()}】",
                "source": "manual-roster-seed",
            }
        )

    return merged_generals


def load_top_unresolved_labels(path: Path, limit: int) -> tuple[str | None, dict[str, int], list[TopUnresolvedLabelRecord]]:
    if not path.exists():
        return None, {}, []
    payload = read_json(path)
    type_counts: dict[str, int] = defaultdict(int)
    grouped: dict[str, dict[str, object]] = defaultdict(
        lambda: {
            "label": "",
            "mentionTypes": defaultdict(int),
            "count": 0,
            "sourceRefs": [],
            "sampleSnippets": [],
        }
    )
    for raw_mention in payload.get("data") or []:
        if raw_mention.get("matchStatus") != "unresolved":
            continue
        mention_type = raw_mention.get("mentionType") or "unknown"
        type_counts[mention_type] += 1
        normalized = str(raw_mention.get("normalized") or "")
        if not normalized:
            continue
        bucket = grouped[normalized]
        bucket["label"] = raw_mention.get("label") or normalized
        bucket["mentionTypes"][mention_type] += 1
        bucket["count"] += 1
        source_ref = raw_mention.get("sourceRef")
        snippet = raw_mention.get("textSnippet")
        if source_ref and len(bucket["sourceRefs"]) < 5 and source_ref not in bucket["sourceRefs"]:
            bucket["sourceRefs"].append(source_ref)
        if snippet and len(bucket["sampleSnippets"]) < 3 and snippet not in bucket["sampleSnippets"]:
            bucket["sampleSnippets"].append(snippet)

    records: list[TopUnresolvedLabelRecord] = []
    for normalized, bucket in grouped.items():
        mention_types = bucket["mentionTypes"]
        dominant_type = sorted(mention_types.items(), key=lambda item: (-item[1], item[0]))[0][0]
        records.append(
            TopUnresolvedLabelRecord(
                label=str(bucket["label"]),
                normalized=normalized,
                mentionType=dominant_type,
                count=int(bucket["count"]),
                sourceRefs=list(bucket["sourceRefs"]),
                sampleSnippets=list(bucket["sampleSnippets"]),
            )
        )
    records.sort(key=lambda item: (-item.count, item.label))
    return str(path), dict(sorted(type_counts.items())), records[:limit]


def build_records(
    generals: list[dict],
    override_config: AliasOverrideConfig,
    overrides_by_id: dict[str, AliasOverrideEntry],
) -> tuple[list[GeneralAliasRecord], list[ExcludedAliasRecord], list[str]]:
    excluded_normalized = {normalize_alias(alias) for alias in override_config.globalExcludedAliases if normalize_alias(alias)}
    excluded_aliases: list[ExcludedAliasRecord] = []
    records: list[GeneralAliasRecord] = []
    general_ids = {general.get("id") for general in generals}
    unknown_override_general_ids = sorted(set(overrides_by_id) - general_ids)

    for general in generals:
        general_id = str(general.get("id"))
        name = str(general.get("name", "")).strip()
        faction = general.get("faction")
        title = general.get("title")
        base_aliases = general.get("alias") or []
        override_entry = overrides_by_id.get(general_id)
        removed_normalized = {
            normalize_alias(alias)
            for alias in (override_entry.remove if override_entry else [])
            if normalize_alias(alias)
        }

        candidates: dict[str, AliasCandidate] = {}

        def add_candidate(label: str, source: str) -> None:
            normalized = normalize_alias(label)
            cleaned_label = label.strip().strip(DECORATIVE_WRAPPER_CHARS).strip()
            if not normalized or not cleaned_label:
                return
            if normalized in removed_normalized:
                excluded_aliases.append(
                    ExcludedAliasRecord(
                        generalId=general_id,
                        alias=cleaned_label,
                        normalized=normalized,
                        reason="removed-by-override",
                        source=source,
                    )
                )
                return
            if normalized in excluded_normalized:
                excluded_aliases.append(
                    ExcludedAliasRecord(
                        generalId=general_id,
                        alias=cleaned_label,
                        normalized=normalized,
                        reason="global-excluded",
                        source=source,
                    )
                )
                return
            candidate = candidates.get(normalized)
            if candidate is None:
                candidates[normalized] = AliasCandidate(label=cleaned_label, normalized=normalized, sources=[source])
                return
            if cleaned_label and len(cleaned_label) > len(candidate.label):
                candidate.label = cleaned_label
            if source not in candidate.sources:
                candidate.sources.append(source)

        add_candidate(name, "name")
        for alias in base_aliases:
            add_candidate(str(alias), "alias")
        for alias in derive_title_aliases(title):
            add_candidate(alias, "title")
        if override_entry:
            for alias in override_entry.add:
                add_candidate(alias, "override")

        alias_candidates = sorted(candidates.values(), key=lambda item: (item.label != name, item.label))
        for alias_candidate in alias_candidates:
            alias_candidate.aliasSource = choose_alias_source(alias_candidate.sources)
            alias_candidate.aliasType = derive_alias_type(alias_candidate.label, name, alias_candidate.aliasSource)
        needs_manual_review = len(alias_candidates) < 2
        review_status = "needs-more-coverage" if needs_manual_review else "ready"

        records.append(
            GeneralAliasRecord(
                generalId=general_id,
                name=name,
                faction=faction,
                title=title,
                aliasCount=len(alias_candidates),
                reviewStatus=review_status,
                needsManualReview=needs_manual_review,
                aliases=alias_candidates,
            )
        )

    records.sort(key=lambda item: item.generalId)
    return records, excluded_aliases, unknown_override_general_ids


def build_alias_map(records: list[GeneralAliasRecord]) -> tuple[list[AliasMapEntry], list[CollisionRecord]]:
    raw_map: dict[str, dict[str, object]] = defaultdict(
        lambda: {
            "alias": "",
            "generalIds": [],
            "sourcesByGeneral": {},
            "aliasSourceByGeneral": {},
            "aliasTypeByGeneral": {},
            "reviewStatusByGeneral": {},
        }
    )

    for record in records:
        for alias in record.aliases:
            bucket = raw_map[alias.normalized]
            bucket["alias"] = alias.label
            general_ids = bucket["generalIds"]
            if record.generalId not in general_ids:
                general_ids.append(record.generalId)
            sources_by_general = bucket["sourcesByGeneral"]
            sources_by_general[record.generalId] = alias.sources
            alias_source_by_general = bucket["aliasSourceByGeneral"]
            alias_source_by_general[record.generalId] = alias.aliasSource
            alias_type_by_general = bucket["aliasTypeByGeneral"]
            alias_type_by_general[record.generalId] = alias.aliasType

    collision_normalized = {
        normalized for normalized, raw_entry in raw_map.items() if len(raw_entry["generalIds"]) > 1
    }
    for record in records:
        for alias in record.aliases:
            alias.reviewStatus = "collision" if alias.normalized in collision_normalized else "accepted"
            review_status_by_general = raw_map[alias.normalized]["reviewStatusByGeneral"]
            review_status_by_general[record.generalId] = alias.reviewStatus

    entries: list[AliasMapEntry] = []
    collisions: list[CollisionRecord] = []
    for normalized, raw_entry in raw_map.items():
        general_ids = sorted(raw_entry["generalIds"])
        status = "high-confidence" if len(general_ids) == 1 else "collision"
        entry = AliasMapEntry(
            alias=str(raw_entry["alias"]),
            normalized=normalized,
            generalIds=general_ids,
            status=status,
            sourcesByGeneral=dict(raw_entry["sourcesByGeneral"]),
            aliasSourceByGeneral=dict(raw_entry["aliasSourceByGeneral"]),
            aliasTypeByGeneral=dict(raw_entry["aliasTypeByGeneral"]),
            reviewStatusByGeneral=dict(raw_entry["reviewStatusByGeneral"]),
        )
        entries.append(entry)
        if status == "collision":
            collisions.append(
                CollisionRecord(alias=entry.alias, normalized=entry.normalized, generalIds=entry.generalIds)
            )

    entries.sort(key=lambda item: (item.status != "high-confidence", item.alias))
    collisions.sort(key=lambda item: item.alias)
    return entries, collisions


def main() -> None:
    args = parse_args()
    generals_path = Path(args.generals)
    overrides_path = Path(args.overrides)
    manual_roster_path = Path(args.manual_roster)
    output_root = Path(args.output_root)

    if not generals_path.exists():
        raise FileNotFoundError(f"generals.json not found: {generals_path}")
    if not overrides_path.exists():
        raise FileNotFoundError(f"override config not found: {overrides_path}")

    ensure_output_root(output_root, overwrite=args.overwrite)

    generals = read_json(generals_path)
    if not isinstance(generals, list):
        raise TypeError("generals.json must be a JSON array")
    generals = merge_manual_roster_entries(generals, load_manual_roster_config(manual_roster_path))

    override_config, overrides_by_id = load_override_config(overrides_path)
    records, excluded_aliases, unknown_override_general_ids = build_records(generals, override_config, overrides_by_id)
    alias_map_entries, collisions = build_alias_map(records)
    alias_source_counts, alias_type_counts, alias_review_status_counts, general_review_status_counts = summarize_metadata_counts(records)
    observed_mentions_path, unresolved_label_type_counts, top_unresolved_labels = load_top_unresolved_labels(
        Path(args.observed_mentions), args.top_unresolved
    )

    timestamp = utc_now()
    records_bundle = AliasRecordsBundle(
        version="1.2.0",
        generatedAt=timestamp,
        generalsPath=str(generals_path),
        overridesPath=str(overrides_path),
        data=records,
    )
    alias_map_bundle = AliasMapBundle(version="1.2.0", generatedAt=timestamp, entries=alias_map_entries)
    review_report = AliasReviewReport(
        version="1.2.0",
        generatedAt=timestamp,
        totalGenerals=len(records),
        totalAliasEntries=sum(record.aliasCount for record in records),
        highConfidenceAliasCount=sum(1 for entry in alias_map_entries if entry.status == "high-confidence"),
        collisionCount=len(collisions),
        excludedCount=len(excluded_aliases),
        aliasSourceCounts=alias_source_counts,
        aliasTypeCounts=alias_type_counts,
        aliasReviewStatusCounts=alias_review_status_counts,
        generalReviewStatusCounts=general_review_status_counts,
        observedMentionsPath=observed_mentions_path,
        unresolvedLabelTypeCounts=unresolved_label_type_counts,
        topUnresolvedLabels=top_unresolved_labels,
        generalsNeedingManualReview=[record.generalId for record in records if record.needsManualReview],
        unknownOverrideGeneralIds=unknown_override_general_ids,
        collisions=collisions,
        excludedAliases=sorted(excluded_aliases, key=lambda item: (item.generalId, item.alias)),
    )

    write_json(output_root / "roster-identity-records.json", records_bundle)
    write_json(output_root / "formal-mention-map.json", alias_map_bundle)
    write_json(output_root / "general-alias-records.json", records_bundle)
    write_json(output_root / "alias-to-general-map.json", alias_map_bundle)
    write_json(output_root / "alias-review-report.json", review_report)

    print(f"[build_alias_dict] wrote {output_root / 'roster-identity-records.json'}")
    print(f"[build_alias_dict] wrote {output_root / 'formal-mention-map.json'}")
    print(f"[build_alias_dict] wrote {output_root / 'alias-review-report.json'}")
    print(
        "[build_alias_dict] "
        f"generals={len(records)} highConfidenceAliases={review_report.highConfidenceAliasCount} collisions={review_report.collisionCount}"
    )


if __name__ == "__main__":
    main()