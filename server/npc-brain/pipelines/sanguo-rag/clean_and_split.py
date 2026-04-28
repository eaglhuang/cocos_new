from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Iterable

from pydantic import BaseModel, Field


DEFAULT_OUTPUT_ROOT = Path("artifacts/data-pipeline/sanguo-rag/markdown")
CHAPTER_TITLE_RE = re.compile(r"^第[〇零一二三四五六七八九十百千0-9]+回.*$", re.MULTILINE)


class SuspiciousLine(BaseModel):
    line_no: int = Field(description="1-based line number in the cleaned source")
    reason: str = Field(description="Why this line should be reviewed")
    content: str = Field(description="Original line content after normalization")


class ParagraphRecord(BaseModel):
    paragraph_index: int = Field(description="1-based paragraph index within chapter")
    source_ref: str = Field(description="Reference like ch_042#p18")
    source_offset_start: int = Field(description="Start offset in cleaned source.md")
    source_offset_end: int = Field(description="End offset in cleaned source.md")
    text: str = Field(description="Paragraph text")


class ChapterRecord(BaseModel):
    chapter_no: int = Field(description="Parsed chapter number if available")
    chapter_id: str = Field(description="Stable chapter file stem")
    title: str = Field(description="Original chapter title line")
    output_path: str = Field(description="Relative path to chapter markdown file")
    source_offset_start: int = Field(description="Chapter start offset in cleaned source.md")
    source_offset_end: int = Field(description="Chapter end offset in cleaned source.md")
    paragraph_count: int = Field(description="Number of paragraph blocks in chapter")
    paragraphs: list[ParagraphRecord] = Field(description="Paragraph index and source offset metadata")


class ConversionReport(BaseModel):
    input_path: str = Field(description="Input source path")
    cleaned_source_path: str = Field(description="Output source.md path")
    chapter_count: int = Field(description="Number of detected chapters")
    stripped_line_count: int = Field(description="Number of lines removed as noise")
    suspicious_lines: list[SuspiciousLine] = Field(description="Lines that may still need manual review")


class ChaptersManifest(BaseModel):
    source_path: str = Field(description="Cleaned source markdown path")
    chapter_count: int = Field(description="Number of chapters written")
    chapters: list[ChapterRecord] = Field(description="Output chapter metadata")


class CleanResult(BaseModel):
    cleaned_text: str
    stripped_line_count: int
    suspicious_lines: list[SuspiciousLine]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Deterministic preprocessing for source markdown/text: clean noise, split chapters, and emit manifests."
    )
    parser.add_argument("--input", required=True, help="Path to source .md or .txt file")
    parser.add_argument(
        "--output-root",
        default=str(DEFAULT_OUTPUT_ROOT),
        help="Root output directory for source.md, chapters/, and manifest files",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Allow overwriting existing source.md, chapters, and manifest files",
    )
    return parser.parse_args()


def read_text(path: Path) -> str:
    for encoding in ("utf-8", "utf-8-sig", "cp950"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError("unknown", b"", 0, 1, f"Unable to decode input file: {path}")


def normalize_line(line: str) -> str:
    line = line.replace("\u3000", " ")
    line = line.replace("\ufeff", "")
    line = line.replace("\u200b", "")
    line = re.sub(r"[ \t]+", " ", line)
    return line.strip()


def should_strip_line(line: str) -> bool:
    if not line:
        return False
    if re.fullmatch(r"[-_=~*·•\s]{3,}", line):
        return True
    if re.fullmatch(r"[0-9]{1,4}", line):
        return True
    if re.fullmatch(r"第\s*[0-9]{1,4}\s*頁", line):
        return True
    if re.fullmatch(r"-\s*[0-9]{1,4}\s*-", line):
        return True
    return False


def collect_suspicious_lines(lines: Iterable[str]) -> list[SuspiciousLine]:
    suspicious: list[SuspiciousLine] = []
    for idx, line in enumerate(lines, start=1):
        if "�" in line:
            suspicious.append(SuspiciousLine(line_no=idx, reason="replacement-character", content=line))
        elif len(line) > 0 and len(re.findall(r"[A-Za-z0-9]", line)) > 25 and len(line) < 50:
            suspicious.append(SuspiciousLine(line_no=idx, reason="dense-ascii-fragment", content=line))
    return suspicious


def clean_text(raw_text: str) -> CleanResult:
    text = raw_text.replace("\r\n", "\n").replace("\r", "\n")
    normalized_lines: list[str] = []
    stripped_line_count = 0

    for raw_line in text.split("\n"):
        line = normalize_line(raw_line)
        if should_strip_line(line):
            stripped_line_count += 1
            continue
        normalized_lines.append(line)

    cleaned_lines: list[str] = []
    previous_blank = False
    for line in normalized_lines:
        is_blank = line == ""
        if is_blank and previous_blank:
            continue
        cleaned_lines.append(line)
        previous_blank = is_blank

    cleaned_text = "\n".join(cleaned_lines).strip() + "\n"
    suspicious_lines = collect_suspicious_lines(cleaned_lines)

    return CleanResult(
        cleaned_text=cleaned_text,
        stripped_line_count=stripped_line_count,
        suspicious_lines=suspicious_lines,
    )


def split_chapters(cleaned_text: str) -> list[tuple[str, str, int, int]]:
    matches = list(CHAPTER_TITLE_RE.finditer(cleaned_text))
    if not matches:
        body = cleaned_text.strip()
        if not body:
            return []
        return [("第0回 未分章來源", body, 0, len(body))]

    chapters: list[tuple[str, str, int, int]] = []
    for idx, match in enumerate(matches):
        title = match.group(0).strip()
        start = match.start()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(cleaned_text)
        block = cleaned_text[start:end].strip()
        chapters.append((title, block, start, end))
    return chapters


def extract_chapter_no(title: str, fallback_index: int) -> int:
    numerals = re.search(r"第([〇零一二三四五六七八九十百千0-9]+)回", title)
    if not numerals:
        return fallback_index

    token = numerals.group(1)
    if token.isdigit():
        return int(token)

    values = {"零": 0, "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
    units = {"十": 10, "百": 100, "千": 1000}
    total = 0
    current = 0
    for char in token:
        if char in values:
            current = values[char]
        elif char in units:
            current = 1 if current == 0 else current
            total += current * units[char]
            current = 0
    total += current
    return total if total > 0 else fallback_index


def split_paragraphs(chapter_id: str, chapter_body: str, chapter_start: int, cleaned_text: str) -> list[ParagraphRecord]:
    title, separator, remainder = chapter_body.partition("\n")
    body_text = remainder.strip() if separator else chapter_body.strip()
    paragraphs = [block.strip() for block in re.split(r"\n\s*\n", body_text) if block.strip()]
    records: list[ParagraphRecord] = []
    search_cursor = chapter_start + len(title) + (1 if separator else 0)

    for idx, paragraph in enumerate(paragraphs, start=1):
        start = cleaned_text.find(paragraph, search_cursor)
        if start == -1:
            start = search_cursor
        end = start + len(paragraph)
        records.append(
            ParagraphRecord(
                paragraph_index=idx,
                source_ref=f"{chapter_id}#p{idx}",
                source_offset_start=start,
                source_offset_end=end,
                text=paragraph,
            )
        )
        search_cursor = end
    return records


def ensure_output_root(output_root: Path, overwrite: bool) -> None:
    output_root.mkdir(parents=True, exist_ok=True)
    chapters_dir = output_root / "chapters"
    chapters_dir.mkdir(parents=True, exist_ok=True)

    if not overwrite:
        collisions = [
            path
            for path in (
                output_root / "source.md",
                output_root / "conversion-report.json",
                output_root / "chapters-manifest.json",
            )
            if path.exists()
        ]
        if collisions:
            raise FileExistsError(f"Output already exists. Re-run with --overwrite: {collisions}")


def write_json(path: Path, model: BaseModel) -> None:
    path.write_text(json.dumps(model.model_dump(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_root = Path(args.output_root)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    ensure_output_root(output_root, overwrite=args.overwrite)

    raw_text = read_text(input_path)
    clean_result = clean_text(raw_text)

    cleaned_source_path = output_root / "source.md"
    cleaned_source_path.write_text(clean_result.cleaned_text, encoding="utf-8")

    chapter_blocks = split_chapters(clean_result.cleaned_text)
    chapter_records: list[ChapterRecord] = []
    chapters_dir = output_root / "chapters"

    for idx, (title, block, start, end) in enumerate(chapter_blocks, start=1):
        chapter_no = extract_chapter_no(title, idx)
        chapter_id = f"ch_{chapter_no:03d}"
        chapter_path = chapters_dir / f"{chapter_id}.md"
        chapter_path.write_text(block.strip() + "\n", encoding="utf-8")

        paragraphs = split_paragraphs(
            chapter_id=chapter_id,
            chapter_body=block,
            chapter_start=start,
            cleaned_text=clean_result.cleaned_text,
        )

        chapter_records.append(
            ChapterRecord(
                chapter_no=chapter_no,
                chapter_id=chapter_id,
                title=title,
                output_path=str(chapter_path.relative_to(output_root)),
                source_offset_start=start,
                source_offset_end=end,
                paragraph_count=len(paragraphs),
                paragraphs=paragraphs,
            )
        )

    conversion_report = ConversionReport(
        input_path=str(input_path),
        cleaned_source_path=str(cleaned_source_path),
        chapter_count=len(chapter_records),
        stripped_line_count=clean_result.stripped_line_count,
        suspicious_lines=clean_result.suspicious_lines,
    )
    manifest = ChaptersManifest(
        source_path=str(cleaned_source_path),
        chapter_count=len(chapter_records),
        chapters=chapter_records,
    )

    write_json(output_root / "conversion-report.json", conversion_report)
    write_json(output_root / "chapters-manifest.json", manifest)

    print(f"[clean_and_split] wrote {cleaned_source_path}")
    print(f"[clean_and_split] wrote {len(chapter_records)} chapter files to {chapters_dir}")
    print(f"[clean_and_split] wrote {output_root / 'conversion-report.json'}")
    print(f"[clean_and_split] wrote {output_root / 'chapters-manifest.json'}")


if __name__ == "__main__":
    main()