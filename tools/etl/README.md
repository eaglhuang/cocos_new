# ETL Compatibility Wrappers

`tools/etl/` 不再承載正式三國大腦中台腳本。

正式位置已移回：

- `server/npc-brain/pipelines/sanguo-rag/`

目前這個目錄只保留：

- 相容舊指令的 `commands/*.py` wrapper
- 舊的開發痕跡與暫存結構

若要新增、維護或審查正式 pipeline 腳本，請直接改 `server/npc-brain/pipelines/sanguo-rag/`。

## Canonical Commands

- `server/npc-brain/pipelines/sanguo-rag/clean_and_split.py`
- `server/npc-brain/pipelines/sanguo-rag/build_alias_dict.py`
- `server/npc-brain/pipelines/sanguo-rag/collect_observed_mentions.py`
- `server/npc-brain/pipelines/sanguo-rag/config/general-alias-overrides.json`

中間產物仍統一落在：

- `artifacts/data-pipeline/sanguo-rag/markdown/`
- `artifacts/data-pipeline/sanguo-rag/extracted/`

## Wrapper Note

下列舊入口仍可執行，但只會轉呼叫正式腳本：

- `tools/etl/commands/clean_and_split.py`
- `tools/etl/commands/build_alias_dict.py`
- `tools/etl/commands/collect_observed_mentions.py`

## WSL Quickstart For Layer 1

如果你只是要跑第一層 deterministic preprocessing，WSL 內只需要最小環境。

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip git

python3 -m venv ~/.venv/3klife-etl
source ~/.venv/3klife-etl/bin/activate

python -m pip install -U pip pydantic
```

注意事項：

- 建立與啟動請使用同一個路徑，本教學統一採 `~/.venv/3klife-etl`
- `re`、`pathlib`、`json`、`csv` 都是 Python 標準庫，不需要額外 `pip install`
- 這一層不需要 LangChain、LangGraph、unstructured、pandas、Pinecone

### First Command Skeleton

第一支 deterministic preprocessing 正式腳本已放在 `server/npc-brain/pipelines/sanguo-rag/clean_and_split.py`。

執行範例：

```bash
source ~/.venv/3klife-etl/bin/activate

python server/npc-brain/pipelines/sanguo-rag/clean_and_split.py \
  --input artifacts/data-pipeline/sanguo-rag/markdown/source.md \
  --output-root artifacts/data-pipeline/sanguo-rag/markdown \
  --overwrite
```

預期輸出：

- `artifacts/data-pipeline/sanguo-rag/markdown/source.md`
- `artifacts/data-pipeline/sanguo-rag/markdown/conversion-report.json`
- `artifacts/data-pipeline/sanguo-rag/markdown/chapters/ch_###.md`
- `artifacts/data-pipeline/sanguo-rag/markdown/chapters-manifest.json`

### Phase 3 Mention Registry

Phase 3 的 deterministic-first 正式腳本已放在 `server/npc-brain/pipelines/sanguo-rag/build_alias_dict.py`。

Tracked input：

- `assets/resources/data/generals.json`
- `server/npc-brain/pipelines/sanguo-rag/config/general-alias-overrides.json`

執行範例：

```bash
source ~/.venv/3klife-etl/bin/activate

python server/npc-brain/pipelines/sanguo-rag/build_alias_dict.py \
  --generals assets/resources/data/generals.json \
  --overrides server/npc-brain/pipelines/sanguo-rag/config/general-alias-overrides.json \
  --output-root artifacts/data-pipeline/sanguo-rag/extracted/alias-dictionary \
  --overwrite
```

預期輸出：

- `artifacts/data-pipeline/sanguo-rag/extracted/alias-dictionary/roster-identity-records.json`
- `artifacts/data-pipeline/sanguo-rag/extracted/alias-dictionary/formal-mention-map.json`
- `artifacts/data-pipeline/sanguo-rag/extracted/alias-dictionary/general-alias-records.json`
- `artifacts/data-pipeline/sanguo-rag/extracted/alias-dictionary/alias-to-general-map.json`
- `artifacts/data-pipeline/sanguo-rag/extracted/alias-dictionary/alias-review-report.json`

`general-alias-records.json` 與 `alias-to-general-map.json` 目前只作為相容舊流程的 mirror；新的語意名稱以 `roster-identity-records.json` 與 `formal-mention-map.json` 為主。

目前輸出重點：

- `roster-identity-records.json`：每位武將的主名冊紀錄，含已採納稱呼、`aliasSource`、`aliasType`、`reviewStatus`
- `formal-mention-map.json`：稱呼到 `generalId` 的正式對照，並保留每位武將對應的 provenance metadata
- `alias-review-report.json`：collision、排除原因、top unresolved labels，以及各種 provenance / review 狀態統計

這一步只處理 `武將主名冊 -> 正式對照表` 的 bootstrap，不做事件抽取或 keyword pack，也還沒有建立真正的 `文本稱呼表`。

如果下一步要讓 alias 更穩，優先順序建議是：

1. 先把 `build_alias_dict.py` 的 provenance 與 review 欄位做齊，讓已採納稱呼的來源可追。
2. 再新增一支專門蒐集 `文本稱呼表` 的腳本，輸出 `label + sourceRef + sceneParticipants + paragraphIndex`。
3. 最後才把經審核的文本稱呼候選升格回正式對照表，避免 alias 自我繁殖。

### Phase 3b Observed Mentions

文本稱呼表正式腳本已放在 `server/npc-brain/pipelines/sanguo-rag/collect_observed_mentions.py`。

執行範例：

```bash
source ~/.venv/3klife-etl/bin/activate

python server/npc-brain/pipelines/sanguo-rag/collect_observed_mentions.py \
  --chapters-root artifacts/data-pipeline/sanguo-rag/markdown/chapters \
  --formal-map artifacts/data-pipeline/sanguo-rag/extracted/alias-dictionary/formal-mention-map.json \
  --output-root artifacts/data-pipeline/sanguo-rag/extracted/observed-mentions \
  --overwrite
```

預期輸出：

- `artifacts/data-pipeline/sanguo-rag/extracted/observed-mentions/observed-mentions.json`
- `artifacts/data-pipeline/sanguo-rag/extracted/observed-mentions/observed-label-summary.json`

若要讓 `alias-review-report.json` 帶入文本中尚未能解析的稱呼排行，先跑 `collect_observed_mentions.py`，再重跑 `build_alias_dict.py`；後者會自動讀取預設的 `observed-mentions.json` 並填入 `topUnresolvedLabels`。