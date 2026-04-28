# Sanguo RAG Pipelines

`server/npc-brain/pipelines/sanguo-rag/` 是三國大腦中台的正式 ETL / RAG pipeline 腳本位置。

目前已落地的正式腳本：

- `clean_and_split.py`：清洗 Markdown、拆章回、輸出 `chapters-manifest.json`
- `build_alias_dict.py`：輸出武將主名冊與正式對照表
- `collect_observed_mentions.py`：從章回 markdown 蒐集文本稱呼表

對應 config：

- `config/general-alias-overrides.json`

中間產物仍統一落在：

- `artifacts/data-pipeline/sanguo-rag/markdown/`
- `artifacts/data-pipeline/sanguo-rag/extracted/`

舊的 `tools/etl/commands/*.py` 現在只保留為相容 wrapper，正式維護位置以本目錄為準。

## Observed Mentions

真實毛評本正文章回目前可用：

- `artifacts/data-pipeline/sanguoyanyi-mao-hant-2026-04-28/body/chapters/`

掃描範例：

```bash
python server/npc-brain/pipelines/sanguo-rag/collect_observed_mentions.py \
	--chapters-root artifacts/data-pipeline/sanguoyanyi-mao-hant-2026-04-28/body/chapters \
	--formal-map artifacts/data-pipeline/sanguo-rag/extracted/alias-dictionary/formal-mention-map.json \
	--output-root artifacts/data-pipeline/sanguo-rag/extracted/observed-mentions \
	--collect-cjk-candidates \
	--candidate-mode conservative \
	--overwrite
```

`conservative` 模式只保留較像人物稱呼的 unknown candidate，並為每筆 mention 補同段已解析出的 `sceneParticipants`，供 E-5a 對話稱呼消歧使用。

## Manual Roster Seeds

若毛評本文本提到的史實人物尚未進正式 gameplay `generals.json`，可先補在：

- `server/npc-brain/pipelines/sanguo-rag/config/manual-roster-seeds.json`

`build_alias_dict.py` 會先讀 gameplay roster，再把這份 manual roster seed 合併進 `武將主名冊 / 正式對照表`。這適合先補 RAG 身份對照，不必為了 mention resolution 立即擴寫整份遊戲角色資料。