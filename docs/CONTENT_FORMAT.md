# 課題格式

Andy 唔會打內容。老師每次推一課上 `main`，Andy 喺 app 撳「重新載入課題」就見到。教學同解釋用**繁體中文、書面粵語**（例如「係」「唔」「嘅」），日文內容保持正確日文。

正式課題請刪走樣本，或者將 `sample` 設做 `false`。而家嘅 `day-001`、`day-002` 係樣本。

推上 GitHub 之後，Actions 會跑 `node scripts/validate-content.js`。有錯就唔好當嗰課已經上線。

## 老師每次要改邊度

1. 新增 `content/lessons/<id>.json`，例如 `content/lessons/day-003.json`。
2. 喺 `content/index.json` 嘅 `lessons` 加一項，順序就係 app 嘅順序。
3. `id`、`title`、`date`、`tags` 要同課題檔一致。`tags` 次序可以唔同，但成員要一樣。
4. `file` 一定係 `lessons/<id>.json`。

`id` 用小寫英數同連字號，建議 `day-001` 呢款。題目 `id` 要穩定：Andy 答過之後唔好改同一個 `id` 嘅題意。改題就用新 `id`。

## content/index.json

```json
{
  "schemaVersion": 1,
  "lessons": [
    {
      "id": "day-001",
      "title": "私はアンディです",
      "date": "2026-10-01",
      "file": "lessons/day-001.json",
      "tags": ["です", "は", "自我介紹"],
      "sample": true
    }
  ]
}
```

| 欄 | 必須 | 說明 |
| --- | --- | --- |
| `schemaVersion` | 係 | 而家係 `1` |
| `id` | 係 | 同檔名、課題檔 `id` 一樣 |
| `title` | 係 | 列表標題，可以係日文 |
| `date` | 係 | `YYYY-MM-DD`。同今日一樣嘅日期會變成「今日課題」。未來日期唔會鎖住，Andy 仍然入到 |
| `file` | 係 | `lessons/<id>.json` |
| `tags` | 係 | 至少一個。同課題檔 `tags` 成員一致 |
| `sample` | 否 | `true` 會顯示「樣本」 |

## 課題檔

路徑：`content/lessons/day-003.json`。Schema：`schema/lesson.schema.json`。

頂部欄位如下。`teaching` 同 `questions` 都要至少有一項，唔可以係空陣列。完整檔見下面嘅例子同 `content/lessons/day-001.json`。

```json
{
  "id": "day-003",
  "title": "助詞「を」",
  "date": "2026-10-03",
  "level": "N5",
  "sample": false,
  "tags": ["を"]
}
```

| 欄 | 必須 | 說明 |
| --- | --- | --- |
| `level` | 係 | 例如 `N5`、`N4`、`N3` |
| `teaching` | 係 | 至少一段 |
| `questions` | 係 | 至少一題 |
| `sampleNote` | 否 | 只係畀人睇嘅備註，app 唔顯示 |

唔好加表以外嘅欄，檢查會當係錯。

## 教學區塊

`teaching` 每項有 `type`。

### heading / paragraph / tip

```json
{ "type": "heading", "text": "今日學咩" }
```

```json
{ "type": "paragraph", "text": "句式係 `A は B です`。\n助詞 **は** 讀 wa。" }
```

```json
{ "type": "tip", "text": "唔好寫「私わ」。" }
```

`paragraph` 同 `tip` 支援少量標記：`**粗體**`、`` `程式字` ``、換行。唔好寫 HTML。

### vocab

```json
{
  "type": "vocab",
  "caption": "今日詞彙",
  "items": [
    { "word": "水", "reading": "みず", "meaning": "水", "speak": "みず" }
  ]
}
```

`word`、`reading`、`meaning` 必須有。`speak` 有嘅話，支援語音嘅手機會顯示「讀出嚟」。

### example

```json
{
  "type": "example",
  "jp": "これは水です。",
  "reading": "これは みずです。",
  "zh": "呢個係水。",
  "note": "物件喺自己隔離。",
  "speak": "これは水です。",
  "audio": "content/audio/day-003-example.mp3"
}
```

`jp` 同 `zh` 必須有。`reading`、`note`、`speak`、`audio` 可選。`audio` 可以係 repo 入面嘅相對路徑，或者 `https://` 網址。唔好用 `javascript:`。

讀音行仍然寫助詞「は」，唔好寫成讀音「わ」。讀音另用 `note` 講。

## 題目

每題要有穩定 `id`，例如 `day-003-q1`，而且要以課題 `id` 加 `-` 開頭。全 repo 唔可以重複。

共通欄位：`prompt`、`explanation`、`tags`（至少一個）、可選 `speak`、`audio`、`hint`。`hint` 會喺未作答之前顯示。

### choice

`answer` 係 `choices` 嘅索引，由 0 起計。

```json
{
  "id": "day-003-q1",
  "type": "choice",
  "prompt": "「水を飲みます」入面，「を」標示咩？",
  "speak": "水を飲みます",
  "choices": ["動作嘅對象", "主題", "地點", "時間"],
  "answer": 0,
  "explanation": "「を」標示動作嘅對象。主題先用「は」。",
  "tags": ["を"]
}
```

### fill

`prompt` 要用三個底線 `___` 標空格。`accepted` 係可接受答案，至少一個。

App 會先做 Unicode NFKC（全形轉半形），再刪走所有空白，先至比較。`は` 同 `ハ` **唔會**自動當一樣，要自己兩邊都列入 `accepted`。大小楷嘅英數會當唔同，除非 NFKC 本身唔區分。

```json
{
  "id": "day-003-q2",
  "type": "fill",
  "prompt": "喝水：水___飲みます。",
  "speak": "水を飲みます",
  "accepted": ["を"],
  "explanation": "對象用「を」。",
  "tags": ["を"]
}
```

### listening（而家可以用，樣本未用）

聽力題同 choice 或 fill 一樣，但一定要有 `speak`（瀏覽器用 ja-JP 朗讀）或者 `audio`（音檔），兩樣有一樣就得。唔好同時有 `choices` 同 `accepted`。

```json
{
  "id": "day-003-q3",
  "type": "listening",
  "prompt": "聽完揀意思。",
  "speak": "これは水です。",
  "audio": "content/audio/day-003-q3.mp3",
  "choices": ["呢個係水。", "呢個係茶。"],
  "answer": 0,
  "explanation": "「水」係水。",
  "tags": ["これ"]
}
```

填空版就用 `accepted`，唔好再加 `choices`。`prompt` 如果係填空，一樣要有 `___`。

如果部機冇 Web Speech API，`speak` 按鈕會隱藏；有 `audio` 就仍然可以播檔。

## 完整可跑例子

可跑嘅完整課題係：

- `content/lessons/day-001.json`（は／です）
- `content/lessons/day-002.json`（これ・それ・あれ）

兩課都係 N5，而且標咗 `sample: true`。

## 本地檢查

```bash
node scripts/validate-content.js
```

冇第三方套件。輸出 `content ok` 就係通過。錯誤會寫明檔案同欄位。
