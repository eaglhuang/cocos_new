from __future__ import annotations

import runpy
from pathlib import Path


PIPELINE_SCRIPT = Path(__file__).resolve().parents[3] / "server" / "npc-brain" / "pipelines" / "sanguo-rag" / "clean_and_split.py"


if __name__ == "__main__":
    runpy.run_path(str(PIPELINE_SCRIPT), run_name="__main__")