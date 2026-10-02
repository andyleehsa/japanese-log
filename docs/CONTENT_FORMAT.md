# 課程內容格式

這份說明給準備日語內容的老師。請用書面中文撰寫意思、講解和題目。日語術語一律稱「辭書形」。

正式欄位、id 規則和發音規則，請看 [unit-n5-12.README.md](unit-n5-12.README.md)。單元 12 是第一份試點，之後的單元沿用同一份格式（`schemaVersion: unit-v1-pilot`）。

## 檔案放在哪裡

- `content/units-index.json`：等級路線。每個單元有 `id`、`level`、`number`、`title`、`lessonCount`、`prerequisites`、`status`、`file`。
- `content/units/unit-n5-12.json`：已經可以上課的單元。索引裡的 `file` 只寫檔名，程式會到 `content/units/` 讀取。
- `status` 為 `planned` 的單元會出現在路線上，點進去會看到「內容準備中」，不會當成錯誤。
- `status` 改為 `ready` 並填上檔名之後，該單元的課、小貼士、故事和小測才會打開。

進度的分母是索引裡、同一個 `level` 的 `lessonCount` 加總。現在 N5 是 66 課，是因為索引如此記載。以後增加聽力課、文法課，或加入 N4、N3，只要改索引的 `level` 和 `lessonCount`，不必改程式。

## 請不要手改 JSON

單元 12 由產生腳本寫出。要改內容時，請改產生腳本再重新產生，不要直接改 JSON。若檢查發現資料問題，請把問題記下來，交給老師重新產生。

檢查指令（不需要安裝 Python）：

```bash
npm run validate-content
```

這個檢查會看結構、id 是否唯一且符合永久格式、題目的文法標籤是否存在、`tts` 是否等於 `reading` 套用助詞之後的結果、中文欄位有沒有口語字，以及 `ready` 單元的 `lessonCount` 是否和檔案裡的課數一致。

## 發音

每個日語項目都有 `ja`（顯示）、`reading`（平假名）、`zh`、`tts`、`particles`。

程式只把 `tts` 送給語音，不會讀 `ja` 或 `reading`。助詞「は／へ／を」在 `tts` 裡寫成「わ／え／お」。詞語本身的「は」保持不變，例如「はいる」。

`audio.file` 先留空（`null`）。以後若放了預錄檔，程式會播檔案；沒有檔案時才用 `tts`。

## 題目

題型是 `choice`、`fill`、`match`、`reorder`、`listen-choice`。

- 回饋面板第一行用 `answerDisplay`，第二行用 `rule`，較長的說明用 `explanation`。
- 選項預設不洗牌。若洗牌，仍用選項 `id` 評分。
- `match` 的答案是「左邊 id → 右邊 id」。`reorder` 的答案是片段 id 的順序。
- `listen-choice` 在作答前不顯示 `reveal`。答錯時面板顯示 `reveal.ja` 和 `reveal.reading`。
- `exposureOnly: true` 的詞只出現在講解或小貼士，不會變成生詞卡，也不會出題。

錯題本會記下題目 id 和文法標籤。課的完成狀態記下課 id，例如 `l-n5-12-1`。
