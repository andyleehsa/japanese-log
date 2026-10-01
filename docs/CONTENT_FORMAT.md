# 課題格式

Andy 唔會打內容。老師每次推一課上 `main`，Andy 喺 app 撳「重新載入課題」就見到。教學同解釋用**繁體中文、書面粵語**（例如「係」「唔」「嘅」），日文內容保持正確日文。

正式課題請刪走樣本，或者將 `sample` 設做 `false`。而家嘅 `day-001`、`day-002` 係樣本。

推上 GitHub 之後，Actions 會跑 `node scripts/validate-content.js`。有錯就唔好當嗰課已經上線。

## 老師每次要改邊度

1. 新增 `content/lessons/<id>.json`，例如 `content/lessons/day-003.json`。
2. 喺 `content/index.json` 嘅 `lessons` 加一項，順序就係 app 嘅順序。
3. `id`、`title`、`date`、`tags` 要同課題檔一致。`tags` 次序可以唔同，但成員要一樣。
4. `file` 一定係 `lessons/<id>.json`。
5. 如果呢課屬於課程大綱某個課題，`topics` 要同 `content/curriculum.json` 入面嗰個課題嘅 `lessonIds` 對得上。兩邊都要寫，檢查會對照。

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
      "topics": ["n5-wa-desu"],
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
| `topics` | 否 | 課題 id 陣列，對應 `content/curriculum.json`。同課題檔 `topics` 要一樣。唔屬於任何課題就唔寫 |
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
  "tags": ["を"],
  "topics": ["n5-particles"]
}
```

| 欄 | 必須 | 說明 |
| --- | --- | --- |
| `level` | 係 | 例如 `N5`、`N4`、`N3` |
| `teaching` | 係 | 至少一段 |
| `questions` | 係 | 至少一題 |
| `topics` | 否 | 同 `content/index.json` 嗰課嘅 `topics` 一樣 |
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

`word`、`reading`、`meaning` 必須有。`speak` 有嘅話，每一段日文都有三個大掣：「讀出嚟」、「慢速」（大約 0.7 倍）、「再聽」。如果部機未有日文語音，畫面會用中文提示去 iPhone「設定」→「輔助使用」→「朗讀內容」→「聲音」→「日文」下載，唔會靜靜地冇反應。

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

如果部機冇日文語音，三個掣仍然喺度，撳咗會見到中文提示，話你去邊度加日文聲音。有 `audio` 就仍然可以播檔。

## 完整可跑例子

可跑嘅完整課題係：

- `content/lessons/day-001.json`（は／です）
- `content/lessons/day-002.json`（これ・それ・あれ）

兩課都係 N5，而且標咗 `sample: true`。

## 課程大綱 content/curriculum.json

App 主頁會為 **N5、N4、N3 每一級** 顯示一條進度列同百分比。課題列表喺 `#/level/N5`（N4、N3 同樣）。Andy 可以隨時開任何課題、任何課，**唔使按順序做完先至開下一課**。重練會繼續寫新嘅作答紀錄，錯題本仍然用「最近一次答錯」。

而家 repo 入面嘅 `content/curriculum.json` 標咗 `sample: true`。N5 有九個課題（は同です、これ・それ・あれ、動詞分組、い形容詞、な形容詞、て形、た形、ない形、助詞），N4 同 N3 各有幾個樣本課題。只有 `n5-wa-desu` → `day-001`、`n5-kosoado` → `day-002` 已經連住課。其餘課題 `lessonIds` 係空陣列，`planned` 仍然要寫，代表老師計劃之後放幾多課。

Schema：`schema/curriculum.schema.json`。`levels` 一定要係 N5、N4、N3，而且就係呢個次序。課題 `id` 全檔唔可以重複。

### 點樣先算完成

`completionAccuracy` 而家固定係 `0.8`。

1. **一課達標**：每一題都至少做過一次，而且嗰課正確率（答對次數 ÷ 全部作答次數，包括重練）至少 80%。
2. **課題百分比** = 已達標嘅課數 ÷ `planned`。`planned` 係整數，至少 1，而且唔可以少過已經連住嘅課數。未連課、`planned` 係 2，百分比就係 0%。
3. **課題達標**：已達標課數 ≥ `planned`。
4. **一級百分比** = 呢級每一個課題百分比嘅平均（每個課題一樣權重）。所以做完一課、但課題仲計劃多課，主頁百分比會升，唔使等成個課題達標。

### 完整例子

下面係可以通過檢查嘅最小大綱。正式內容請以 `content/curriculum.json` 做樣，將 `sample` 改做 `false`，同埋把 `lessonIds` 連去真課題。

```json
{
  "schemaVersion": 1,
  "sample": true,
  "completionAccuracy": 0.8,
  "levels": [
    {
      "level": "N5",
      "topics": [
        {
          "id": "n5-wa-desu",
          "title": "は同です",
          "description": "用「は」講「我係……」。",
          "level": "N5",
          "lessonIds": ["day-001"],
          "planned": 1
        },
        {
          "id": "n5-te-form",
          "title": "て形",
          "description": "て形點變。樣本大綱，課題未放。",
          "level": "N5",
          "lessonIds": [],
          "planned": 2
        }
      ]
    },
    {
      "level": "N4",
      "topics": [
        {
          "id": "n4-potential",
          "title": "可能形",
          "description": "做得唔做到。",
          "level": "N4",
          "lessonIds": [],
          "planned": 1
        }
      ]
    },
    {
      "level": "N3",
      "topics": [
        {
          "id": "n3-passive",
          "title": "受身",
          "description": "被人做咗啲咩。",
          "level": "N3",
          "lessonIds": [],
          "planned": 1
        }
      ]
    }
  ]
}
```

| 欄 | 必須 | 說明 |
| --- | --- | --- |
| `id` | 係 | 小寫英數同連字號，全大綱唯一 |
| `title` | 係 | 繁體中文課題名，例如「て形」 |
| `description` | 係 | 一句短說明 |
| `level` | 係 | 要同所屬級別一樣：`N5`、`N4` 或 `N3` |
| `lessonIds` | 係 | 已放上嚟嘅課題 id。可以係 `[]`。每個 id 要喺 `content/index.json` |
| `planned` | 係 | 計劃總課數。至少 1，而且 ≥ `lessonIds` 長度 |

加新課嘅時候：課題檔同 index 都寫 `topics`，大綱嗰個課題嘅 `lessonIds` 加同一個 id。如果 `planned` 細過新嘅課數，要一齊改大。

## 生詞庫 content/vocab/

三個檔，每個級別一個：

- `content/vocab/n5.json`
- `content/vocab/n4.json`
- `content/vocab/n3.json`

Schema：`schema/vocab.schema.json`。而家三個檔都係 `sample: true`。N5 樣本有動詞、い形容詞、な形容詞、名詞（飲食、交通、家庭、時間數字）、副詞，每個分類幾個詞。N4、N3 各有動詞同名詞幾個詞，方便試進度。

App 路徑：生詞 → 揀級別 → 揀分類。可以搜尋日文、讀音或者意思。每個分類有「卡片溫習」：先顯示日文同讀音，撳「睇意思」先顯示中文，可以「收起意思」。撳「識」或「唔識」會記喺部機，同步時寫入 `logs/vocab.json`，老師喺 `summary.json` 睇到唔識嘅詞。

**一級生詞進度** = 標咗「識」嘅詞數 ÷ 呢級總詞數。未標記同「唔識」都唔計入百分比。

詞 `id` 全三個檔加埋唔可以重複。分類 `id` 都唔可以重複。`reading` 用平假名（可以有長音 `ー` 同空白）。例句讀音可以有片假名同標點。

```json
{
  "schemaVersion": 1,
  "level": "N5",
  "sample": true,
  "categories": [
    {
      "id": "n5-verb",
      "title": "動詞",
      "entries": [
        {
          "id": "n5-ikimasu",
          "japanese": "行きます",
          "reading": "いきます",
          "meaning": "去",
          "level": "N5",
          "category": "n5-verb",
          "example": {
            "jp": "学校へ行きます。",
            "reading": "がっこうへ いきます。",
            "zh": "去學校。"
          },
          "tags": ["一組"],
          "speak": "いきます"
        }
      ]
    }
  ]
}
```

| 欄 | 必須 | 說明 |
| --- | --- | --- |
| `japanese` | 係 | 漢字或假名，畫面顯示用 |
| `reading` | 係 | 平假名讀音 |
| `meaning` | 係 | 繁體中文意思 |
| `level` | 係 | 同檔案級別一樣 |
| `category` | 係 | 同所屬分類 `id` 一樣 |
| `example` | 否 | `jp`、`reading`、`zh` 三樣都要有 |
| `tags` | 否 | 至少一個字串。而家只係資料，畫面未用嚟篩 |
| `speak` | 否 | 有嘅話，畫面有「讀出嚟」「慢速」「再聽」三個大掣 |

分類同生詞都可以隨時再開，唔使做完先至入下一組。

## 本地檢查

```bash
node scripts/validate-content.js
```

冇第三方套件。輸出 `content ok` 就係通過。錯誤會寫明檔案同欄位。
