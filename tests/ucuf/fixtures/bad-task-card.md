# UCUF 故意違規測試任務卡（M11-P2 fixture）

> 此檔案故意觸發 R-TC-01 ~ R-TC-10 全部 10 條違規，
> 供 validate-ucuf-task-card.js 端到端驗證使用。
> **請勿作為真實任務卡範本。**

```yaml
# R-TC-01 FAIL: screen_id 為空
screen_id:

# R-TC-02 FAIL: parent_panel 不是 CompositePanel
parent_panel: UIPreviewBuilder

# R-TC-03 FAIL: content_contract_schema 為空
content_contract_schema:

# R-TC-04 WARN: fragments_owned 應為陣列，但此處為純量字串
fragments_owned: not-an-array

# R-TC-05 FAIL: data_sources_owned 為空陣列
data_sources_owned:

# R-TC-06 FAIL: skin_manifest 為空
skin_manifest:

# R-TC-07 FAIL: verification_commands 為空陣列
verification_commands:

# R-TC-08 FAIL: smoke_route 為空
smoke_route:

# R-TC-09 WARN: deliverables 含空字串條目（inline comment 被 stripInlineComment 清掉後變空值）
deliverables:
  - # empty deliverable item

# R-TC-10 FAIL: type 不在合法清單中
type: invalid-type
```
