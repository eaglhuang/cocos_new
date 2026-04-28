from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from pydantic import BaseModel, Field


DEFAULT_CHAPTERS_ROOT = Path("artifacts/data-pipeline/sanguo-rag/markdown/chapters")
DEFAULT_FORMAL_MAP_PATH = Path("artifacts/data-pipeline/sanguo-rag/extracted/alias-dictionary/formal-mention-map.json")
DEFAULT_OUTPUT_ROOT = Path("artifacts/data-pipeline/sanguo-rag/extracted/observed-mentions")
DECORATIVE_WRAPPER_CHARS = "【】[]()（）「」『』《》〈〉"
ADDRESS_TITLES = ["將軍", "軍師", "先生", "大人", "主公", "縣令", "太守", "都督", "丞相"]
CJK_CANDIDATE_RE = re.compile(r"[\u4e00-\u9fff]{2,4}")
COMPOUND_SURNAMES = ("諸葛", "司馬", "夏侯", "皇甫", "公孫", "歐陽")
COMMON_SINGLE_SURNAMES = set("趙錢孫李周吳鄭王馮陳褚衛蔣沈韓楊朱秦尤許何呂施張孔曹嚴華金魏陶姜戚謝鄒喻柏水竇章雲蘇潘葛奚范彭郎魯韋昌馬苗鳳花方俞任袁柳鮑史唐費廉岑薛雷賀倪湯滕殷羅畢郝鄔安常樂于時傅皮卞齊康伍余元卜顧孟平黃和穆蕭尹夏侯")
COMMON_SINGLE_SURNAMES -= set("安方時常史郎水花畢金")
NOISE_LABELS = {
    "後人有詩",
    "後人贊曰",
    "贊曰",
    "正是",
    "次日",
    "卻說",
    "且說",
    "分解",
    "下文",
    "且看下文",
    "如之奈何",
    "言未畢",
    "喊聲大震",
    "共議大事",
    "又名",
    "大名",
    "姓名",
    "姓劉",
    "姓曹",
    "名備",
    "名操",
    "名羽",
    "名飛",
    "吳王",
    "水陸",
    "畢竟",
    "花開",
    "諸葛扁舟",
    "金鼓",
    "馬似",
    "馬匹",
    "馬尾",
    "黃巾",
}
NOISE_SUBSTRINGS = ["後人", "下文", "分解", "喊聲", "不知", "正是", "詩曰", "贊曰"]
NOISE_CHARS = set("之其此何如不無有與於而以為爲乃即便皆各等甚已亦卻說曰云雲")
NON_NAME_SECOND_CHARS = set("兵軍主臣民欲纔分將下前出年得肯能地昏侍義路寨營陣聲日夜時刻處處公母父子兒人城州郡縣山江河橋谷口王賊冊末可天排敢資來引縱過鉅習皇升似匹尾巾二")
NON_NAME_THIRD_CHARS = set("生來引縱過習孫皇鉅座喪寧計")
LOCATION_SUFFIXES = ("城", "郡", "州", "縣", "寨", "關", "橋", "山", "江", "河", "谷", "口", "營", "陣")
PERSON_PREFIXES = ("姓", "名", "字", "一名", "小字", "呼為", "號為", "乃是", "吳將", "蜀將", "魏將", "賊將", "太守", "縣令", "校尉", "中郎將", "其黨", "叔父")


class FormalMentionEntry(BaseModel):
    alias: str = Field(description="Formal mention label")
    normalized: str = Field(description="Normalized label key")
    generalIds: list[str] = Field(default_factory=list, description="Mapped canonical general ids")
    status: str = Field(default="", description="high-confidence or collision")


class ObservedMention(BaseModel):
    label: str = Field(description="Observed surface form")
    normalized: str = Field(description="Normalized surface form")
    mentionType: str = Field(description="formal-match, address-title, or unknown-candidate")
    matchStatus: str = Field(description="resolved or unresolved")
    matchedGeneralIds: list[str] = Field(default_factory=list, description="Resolved general ids when available")
    sourceRef: str = Field(description="Chapter and paragraph reference")
    chapterNo: int | None = Field(default=None, description="Chapter number parsed from filename")
    paragraphIndex: int = Field(description="Paragraph index inside chapter")
    startOffset: int = Field(description="Character offset inside paragraph")
    endOffset: int = Field(description="Character end offset inside paragraph")
    textSnippet: str = Field(description="Short surrounding text for review")
    sceneParticipants: list[str] = Field(default_factory=list, description="Resolved general ids observed in the same paragraph")


class ObservedLabelSummaryEntry(BaseModel):
    label: str = Field(description="Observed surface form")
    normalized: str = Field(description="Normalized surface form")
    mentionType: str = Field(description="Dominant mention type")
    matchStatus: str = Field(description="resolved or unresolved")
    count: int = Field(description="Mention count")
    matchedGeneralIds: list[str] = Field(default_factory=list, description="Resolved general ids when available")
    sceneParticipants: list[str] = Field(default_factory=list, description="Sample scene participants seen with this label")
    sourceRefs: list[str] = Field(description="Sample source refs")
    sampleSnippets: list[str] = Field(description="Sample snippets")


class ChapterMentionSummary(BaseModel):
    chapterNo: int | None = Field(default=None, description="Chapter number")
    chapterPath: str = Field(description="Chapter markdown path")
    mentionCount: int = Field(description="Total mentions in this chapter")
    formalMatchCount: int = Field(description="Resolved formal matches")
    addressTitleCount: int = Field(description="Unresolved address title mentions")
    unknownCandidateCount: int = Field(description="Unknown CJK candidate mentions")
    skippedUnknownCandidateCount: int = Field(default=0, description="CJK candidates skipped by conservative filters")


class ObservedMentionsBundle(BaseModel):
    version: str = Field(description="Output schema version")
    generatedAt: str = Field(description="UTC timestamp")
    chaptersRoot: str = Field(description="Input chapters root")
    formalMapPath: str = Field(description="Input formal mention map path")
    collectCjkCandidates: bool = Field(description="Whether CJK candidate scan was enabled")
    data: list[ObservedMention] = Field(description="Observed mentions")


class ObservedLabelSummaryBundle(BaseModel):
    version: str = Field(description="Output schema version")
    generatedAt: str = Field(description="UTC timestamp")
    totalMentions: int = Field(description="Total observed mention records")
    resolvedMentionCount: int = Field(description="Resolved mention records")
    unresolvedMentionCount: int = Field(description="Unresolved mention records")
    chapters: list[ChapterMentionSummary] = Field(description="Per-chapter summary")
    topResolvedLabels: list[ObservedLabelSummaryEntry] = Field(description="Most frequent resolved labels")
    topUnresolvedLabels: list[ObservedLabelSummaryEntry] = Field(description="Most frequent unresolved labels")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collect observed mention labels from split chapter markdown files.")
    parser.add_argument("--chapters-root", default=str(DEFAULT_CHAPTERS_ROOT), help="Directory containing ch_###.md files")
    parser.add_argument("--formal-map", default=str(DEFAULT_FORMAL_MAP_PATH), help="formal-mention-map.json path")
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT), help="Output directory for observed mention files")
    parser.add_argument("--collect-cjk-candidates", action="store_true", help="Also collect 2-4 CJK character unknown candidates")
    parser.add_argument("--candidate-mode", choices=("conservative", "wide"), default="conservative", help="Unknown CJK candidate filtering mode")
    parser.add_argument("--top", type=int, default=50, help="Number of top labels to keep in summaries")
    parser.add_argument("--overwrite", action="store_true", help="Allow overwriting existing output files")
    return parser.parse_args()


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, model: BaseModel) -> None:
    path.write_text(json.dumps(model.model_dump(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize_label(value: str) -> str:
    cleaned = value.strip().strip(DECORATIVE_WRAPPER_CHARS)
    cleaned = re.sub(r"[\s　]+", "", cleaned)
    cleaned = re.sub(r"[·•‧・]", "", cleaned)
    return cleaned.strip().lower()


def parse_chapter_no(path: Path) -> int | None:
    match = re.search(r"ch_(\d+)", path.stem)
    if match:
        return int(match.group(1))
    if path.stem.isdigit():
        return int(path.stem)
    return None


def split_paragraphs(text: str) -> list[str]:
    return [paragraph.strip() for paragraph in re.split(r"\n\s*\n", text) if paragraph.strip()]


def ensure_output_root(path: Path, overwrite: bool) -> None:
    path.mkdir(parents=True, exist_ok=True)
    if not overwrite:
        collisions = [
            existing
            for existing in (
                path / "observed-mentions.json",
                path / "observed-label-summary.json",
            )
            if existing.exists()
        ]
        if collisions:
            raise FileExistsError(f"Output already exists. Re-run with --overwrite: {collisions}")


def load_formal_map(path: Path) -> dict[str, FormalMentionEntry]:
    if not path.exists() and path.name == "formal-mention-map.json":
        legacy_path = path.with_name("alias-to-general-map.json")
        if legacy_path.exists():
            path = legacy_path
    if not path.exists():
        raise FileNotFoundError(f"formal mention map not found: {path}")
    payload = read_json(path)
    entries = payload.get("entries") or []
    formal_map: dict[str, FormalMentionEntry] = {}
    for raw_entry in entries:
        entry = FormalMentionEntry.model_validate(raw_entry)
        if entry.normalized:
            formal_map[entry.normalized] = entry
    return formal_map


def make_snippet(paragraph: str, start: int, end: int, radius: int = 18) -> str:
    snippet_start = max(0, start - radius)
    snippet_end = min(len(paragraph), end + radius)
    return paragraph[snippet_start:snippet_end].replace("\n", " ")


def append_mention(
    mentions: list[ObservedMention],
    label: str,
    mention_type: str,
    match_status: str,
    matched_general_ids: list[str],
    source_ref: str,
    chapter_no: int | None,
    paragraph_index: int,
    start_offset: int,
    end_offset: int,
    paragraph: str,
) -> None:
    mentions.append(
        ObservedMention(
            label=label,
            normalized=normalize_label(label),
            mentionType=mention_type,
            matchStatus=match_status,
            matchedGeneralIds=matched_general_ids,
            sourceRef=source_ref,
            chapterNo=chapter_no,
            paragraphIndex=paragraph_index,
            startOffset=start_offset,
            endOffset=end_offset,
            textSnippet=make_snippet(paragraph, start_offset, end_offset),
        )
    )


def is_cjk_char(value: str) -> bool:
    return bool(value and "\u4e00" <= value <= "\u9fff")


def is_direct_address_title(paragraph: str, start: int, end: int) -> bool:
    previous_char = paragraph[start - 1] if start > 0 else ""
    next_char = paragraph[end] if end < len(paragraph) else ""
    if is_cjk_char(previous_char):
        return False
    if is_cjk_char(next_char):
        return False
    return True


def has_person_context(paragraph: str, start: int, end: int) -> bool:
    window = paragraph[max(0, start - 8): min(len(paragraph), end + 8)]
    return bool(re.search(r"(姓|名|字|一名|小字|其人|乃是|吳將|蜀將|魏將|賊將|太守|縣令|校尉|中郎將|將軍|軍師)", window))


def has_person_prefix(paragraph: str, start: int) -> bool:
    prefix_window = paragraph[max(0, start - 4): start]
    return any(prefix_window.endswith(prefix) for prefix in PERSON_PREFIXES)


def iter_unknown_candidate_spans(paragraph: str, candidate_mode: str):
    if candidate_mode == "wide":
        for match in CJK_CANDIDATE_RE.finditer(paragraph):
            yield match.group(0), match.start(), match.end()
        return

    for start, _char in enumerate(paragraph):
        for surname in COMPOUND_SURNAMES:
            if not paragraph.startswith(surname, start):
                continue
            name_start = start + len(surname)
            if name_start >= len(paragraph) or not is_cjk_char(paragraph[name_start]):
                continue
            end = name_start + 1
            if end < len(paragraph) and is_cjk_char(paragraph[end]) and paragraph[end] not in NOISE_CHARS:
                end += 1
            yield paragraph[start:end], start, end

        if paragraph[start] not in COMMON_SINGLE_SURNAMES:
            continue
        end = start + 2
        if end > len(paragraph) or not is_cjk_char(paragraph[start + 1]):
            continue
        if end < len(paragraph) and is_cjk_char(paragraph[end]) and paragraph[end] not in NOISE_CHARS:
            third_char = paragraph[end]
            next_char = paragraph[end + 1] if end + 1 < len(paragraph) else ""
            if third_char in NON_NAME_THIRD_CHARS:
                pass
            elif not is_cjk_char(next_char) or next_char in "曰言問答道笑":
                end += 1
            elif has_person_context(paragraph, start, end + 1) and third_char not in LOCATION_SUFFIXES:
                end += 1
        yield paragraph[start:end], start, end


def should_collect_unknown_candidate(label: str, paragraph: str, start: int, end: int, candidate_mode: str) -> bool:
    if candidate_mode == "wide":
        return True
    if paragraph.lstrip().startswith("#"):
        return False
    if label in NOISE_LABELS:
        return False
    if any(noise in label for noise in NOISE_SUBSTRINGS):
        return False
    if label.endswith(("曰", "云", "雲")):
        return False
    if len(label) < 2 or len(label) > 4:
        return False
    if any(char in NOISE_CHARS for char in label):
        return False
    if label.endswith(LOCATION_SUFFIXES):
        return False
    if any(label.endswith(title) for title in ADDRESS_TITLES):
        return False
    if any(label.startswith(surname) for surname in COMPOUND_SURNAMES):
        return True
    if label[0] in COMMON_SINGLE_SURNAMES:
        previous_char = paragraph[start - 1] if start > 0 else ""
        if is_cjk_char(previous_char) and not has_person_prefix(paragraph, start):
            return False
        if len(label) >= 2 and label[1] in NON_NAME_SECOND_CHARS and not has_person_context(paragraph, start, end):
            return False
        return True
    return has_person_context(paragraph, start, end)


def collect_from_paragraph(
    paragraph: str,
    source_ref: str,
    chapter_no: int | None,
    paragraph_index: int,
    formal_entries: list[FormalMentionEntry],
    formal_normalized: set[str],
    collect_cjk_candidates: bool,
    candidate_mode: str,
) -> tuple[list[ObservedMention], int]:
    mentions: list[ObservedMention] = []
    occupied_ranges: list[tuple[int, int]] = []
    skipped_unknown_candidates = 0

    for formal_entry in formal_entries:
        if not formal_entry.alias:
            continue
        for match in re.finditer(re.escape(formal_entry.alias), paragraph):
            overlaps_existing = any(match.start() < end and start < match.end() for start, end in occupied_ranges)
            if overlaps_existing:
                continue
            append_mention(
                mentions,
                formal_entry.alias,
                "formal-match",
                "resolved" if formal_entry.status == "high-confidence" else "unresolved",
                formal_entry.generalIds if formal_entry.status == "high-confidence" else [],
                source_ref,
                chapter_no,
                paragraph_index,
                match.start(),
                match.end(),
                paragraph,
            )
            occupied_ranges.append((match.start(), match.end()))

    for title in ADDRESS_TITLES:
        normalized = normalize_label(title)
        if normalized in formal_normalized:
            continue
        for match in re.finditer(re.escape(title), paragraph):
            if not is_direct_address_title(paragraph, match.start(), match.end()):
                continue
            overlaps_existing = any(match.start() < end and start < match.end() for start, end in occupied_ranges)
            if overlaps_existing:
                continue
            append_mention(
                mentions,
                title,
                "address-title",
                "unresolved",
                [],
                source_ref,
                chapter_no,
                paragraph_index,
                match.start(),
                match.end(),
                paragraph,
            )
            occupied_ranges.append((match.start(), match.end()))

    if collect_cjk_candidates:
        for label, start, end in iter_unknown_candidate_spans(paragraph, candidate_mode):
            normalized = normalize_label(label)
            overlaps_existing = any(start < occupied_end and occupied_start < end for occupied_start, occupied_end in occupied_ranges)
            if normalized in formal_normalized or normalized in {normalize_label(title) for title in ADDRESS_TITLES}:
                continue
            if overlaps_existing:
                continue
            if not should_collect_unknown_candidate(label, paragraph, start, end, candidate_mode):
                skipped_unknown_candidates += 1
                continue
            append_mention(
                mentions,
                label,
                "unknown-candidate",
                "unresolved",
                [],
                source_ref,
                chapter_no,
                paragraph_index,
                start,
                end,
                paragraph,
            )
            occupied_ranges.append((start, end))

    scene_participants = sorted(
        {
            general_id
            for mention in mentions
            if mention.matchStatus == "resolved"
            for general_id in mention.matchedGeneralIds
        }
    )
    for mention in mentions:
        mention.sceneParticipants = scene_participants

    return mentions, skipped_unknown_candidates


def summarize_labels(mentions: list[ObservedMention], match_status: str, limit: int) -> list[ObservedLabelSummaryEntry]:
    grouped: dict[str, dict[str, object]] = defaultdict(
        lambda: {
            "label": "",
            "mentionTypes": defaultdict(int),
            "count": 0,
            "matchedGeneralIds": set(),
            "sceneParticipants": set(),
            "sourceRefs": [],
            "sampleSnippets": [],
        }
    )
    for mention in mentions:
        if mention.matchStatus != match_status:
            continue
        bucket = grouped[mention.normalized]
        bucket["label"] = mention.label
        bucket["mentionTypes"][mention.mentionType] += 1
        bucket["count"] += 1
        bucket["matchedGeneralIds"].update(mention.matchedGeneralIds)
        bucket["sceneParticipants"].update(mention.sceneParticipants)
        if len(bucket["sourceRefs"]) < 5 and mention.sourceRef not in bucket["sourceRefs"]:
            bucket["sourceRefs"].append(mention.sourceRef)
        if len(bucket["sampleSnippets"]) < 3 and mention.textSnippet not in bucket["sampleSnippets"]:
            bucket["sampleSnippets"].append(mention.textSnippet)

    summaries: list[ObservedLabelSummaryEntry] = []
    for normalized, bucket in grouped.items():
        mention_types = bucket["mentionTypes"]
        dominant_type = sorted(mention_types.items(), key=lambda item: (-item[1], item[0]))[0][0]
        summaries.append(
            ObservedLabelSummaryEntry(
                label=str(bucket["label"]),
                normalized=normalized,
                mentionType=dominant_type,
                matchStatus=match_status,
                count=int(bucket["count"]),
                matchedGeneralIds=sorted(bucket["matchedGeneralIds"]),
                sceneParticipants=sorted(bucket["sceneParticipants"]),
                sourceRefs=list(bucket["sourceRefs"]),
                sampleSnippets=list(bucket["sampleSnippets"]),
            )
        )
    summaries.sort(key=lambda item: (-item.count, item.label))
    return summaries[:limit]


def main() -> None:
    args = parse_args()
    chapters_root = Path(args.chapters_root)
    formal_map_path = Path(args.formal_map)
    output_root = Path(args.output_root)

    if not chapters_root.exists():
        raise FileNotFoundError(f"chapters root not found: {chapters_root}")

    chapter_paths = sorted(chapters_root.glob("*.md"))
    if not chapter_paths:
        raise FileNotFoundError(f"no chapter markdown files found in: {chapters_root}")

    formal_map = load_formal_map(formal_map_path)
    formal_entries = sorted(formal_map.values(), key=lambda item: (-len(item.alias), item.alias))
    formal_normalized = set(formal_map)
    ensure_output_root(output_root, overwrite=args.overwrite)

    all_mentions: list[ObservedMention] = []
    chapter_summaries: list[ChapterMentionSummary] = []
    for chapter_path in chapter_paths:
        chapter_no = parse_chapter_no(chapter_path)
        paragraphs = split_paragraphs(chapter_path.read_text(encoding="utf-8"))
        chapter_mentions: list[ObservedMention] = []
        skipped_unknown_candidate_count = 0
        for paragraph_index, paragraph in enumerate(paragraphs, start=1):
            source_ref = f"{chapter_path.stem}#p{paragraph_index}"
            paragraph_mentions, skipped_count = collect_from_paragraph(
                paragraph,
                source_ref,
                chapter_no,
                paragraph_index,
                formal_entries,
                formal_normalized,
                args.collect_cjk_candidates,
                args.candidate_mode,
            )
            chapter_mentions.extend(paragraph_mentions)
            skipped_unknown_candidate_count += skipped_count
        all_mentions.extend(chapter_mentions)
        chapter_summaries.append(
            ChapterMentionSummary(
                chapterNo=chapter_no,
                chapterPath=str(chapter_path),
                mentionCount=len(chapter_mentions),
                formalMatchCount=sum(1 for mention in chapter_mentions if mention.mentionType == "formal-match"),
                addressTitleCount=sum(1 for mention in chapter_mentions if mention.mentionType == "address-title"),
                unknownCandidateCount=sum(1 for mention in chapter_mentions if mention.mentionType == "unknown-candidate"),
                skippedUnknownCandidateCount=skipped_unknown_candidate_count,
            )
        )

    timestamp = utc_now()
    mentions_bundle = ObservedMentionsBundle(
        version="1.0.0",
        generatedAt=timestamp,
        chaptersRoot=str(chapters_root),
        formalMapPath=str(formal_map_path),
        collectCjkCandidates=bool(args.collect_cjk_candidates),
        data=all_mentions,
    )
    summary_bundle = ObservedLabelSummaryBundle(
        version="1.0.0",
        generatedAt=timestamp,
        totalMentions=len(all_mentions),
        resolvedMentionCount=sum(1 for mention in all_mentions if mention.matchStatus == "resolved"),
        unresolvedMentionCount=sum(1 for mention in all_mentions if mention.matchStatus == "unresolved"),
        chapters=chapter_summaries,
        topResolvedLabels=summarize_labels(all_mentions, "resolved", args.top),
        topUnresolvedLabels=summarize_labels(all_mentions, "unresolved", args.top),
    )

    write_json(output_root / "observed-mentions.json", mentions_bundle)
    write_json(output_root / "observed-label-summary.json", summary_bundle)

    print(f"[collect_observed_mentions] wrote {output_root / 'observed-mentions.json'}")
    print(f"[collect_observed_mentions] wrote {output_root / 'observed-label-summary.json'}")
    print(
        "[collect_observed_mentions] "
        f"mentions={summary_bundle.totalMentions} resolved={summary_bundle.resolvedMentionCount} "
        f"unresolved={summary_bundle.unresolvedMentionCount}"
    )


if __name__ == "__main__":
    main()