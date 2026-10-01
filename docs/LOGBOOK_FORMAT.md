# 進度檔格式

Andy 撳「同步畀老師」之後，app 用 GitHub Contents API 寫入 `main`。老師唔使登入 Andy 部機。Repo 而家係公開，所以下面嘅 raw 網址任何人開到；唔好當佢係私隱檔。

未同步之前，呢兩個網址會 404。

## 老師點樣睇

總表（每次同步成功都會重寫）：

<https://raw.githubusercontent.com/andyleehsa/japanese-log/main/logs/summary.json>

某一個月嘅原始作答，例如 2026 年 10 月：

<https://raw.githubusercontent.com/andyleehsa/japanese-log/main/logs/attempts/2026-10.json>

月份檔嘅名係 `YYYY-MM.json`。要知有邊幾個月，睇 GitHub 上 `logs/attempts/` 個資料夾，或者由 `summary.json` 嘅 `streak.studyDates` 推出月份。

Schema：

- `schema/summary.schema.json`
- `schema/attempts.schema.json`

呢兩個檔由 app 管理。人手改完，下次同步會整份重寫，而且可能因為 JSON 壞咗而同步失敗。

## summary.json

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-02T12:00:00.000Z",
  "lastSyncedAt": "2026-10-02T12:00:00.000Z",
  "lastStudyDate": "2026-10-02",
  "timezoneNote": "attempt.timestamp carries the device's offset; lastSyncedAt is UTC.",
  "streak": {
    "current": 2,
    "longest": 2,
    "studyDates": ["2026-10-01", "2026-10-02"]
  },
  "overall": { "attempts": 8, "correct": 6, "accuracy": 0.75, "errorRate": 0.25 },
  "perLesson": [
    {
      "lessonId": "day-001",
      "title": "私はアンディです",
      "attempts": 5,
      "correct": 4,
      "accuracy": 0.8,
      "errorRate": 0.2
    }
  ],
  "perTag": [
    { "tag": "は", "attempts": 4, "correct": 3, "accuracy": 0.75, "errorRate": 0.25 }
  ],
  "weakThreshold": 0.8,
  "weakTags": [
    { "tag": "は", "attempts": 4, "correct": 3, "accuracy": 0.75, "errorRate": 0.25 }
  ],
  "weakQuestions": [],
  "mistakes": [
    {
      "questionId": "day-002-q3",
      "lessonId": "day-002",
      "lessonTitle": "これ・それ・あれ",
      "prompt": "遠嘅學校：___は学校です。",
      "correctAnswer": "あれ",
      "tags": ["あれ"],
      "lastUserAnswer": "それ",
      "lastAt": "2026-10-02T21:05:00+08:00",
      "wrongCount": 1,
      "attempts": 1,
      "correct": 0,
      "accuracy": 0,
      "errorRate": 1
    }
  ]
}
```

| 欄 | 點睇 |
| --- | --- |
| `lastSyncedAt` | UTC 時間。Andy 部機顯示會轉做香港時間 |
| `lastStudyDate` | 最近一次有作答嘅本地日期 `YYYY-MM-DD` |
| `streak.current` | 連續溫習日。計到今日；如果今日未練但尋日有練，仍然算住。中間斷一日就歸零 |
| `streak.longest` | 歷史最長連續日 |
| `streak.studyDates` | 所有有作答嘅本地日期，由舊到新 |
| `overall` | 全部作答。`accuracy` 係答對次數 ÷ 總次數，包括重練。未有紀錄係 `null` |
| `perLesson` | 每課，按 `lessonId` 排序 |
| `perTag` | 每個題目標籤，按錯誤率由高至低 |
| `weakThreshold` | 而家係 `0.8` |
| `weakTags` | `accuracy < weakThreshold` 嘅標籤，同樣按錯誤率排序 |
| `weakQuestions` / `mistakes` | **最近一次仍然答錯**嘅題，按錯誤率由高至低。答啱最近一次就會離開呢個表 |

`perLesson[].title`、`mistakes[].prompt`、`mistakes[].correctAnswer` 係同步嗰陣由當時嘅課題檔抄出嚟。如果課題未載入到，`prompt` 可能係空字串，用 `questionId` 去課題檔對返。

## attempts/YYYY-MM.json

```json
{
  "schemaVersion": 1,
  "month": "2026-10",
  "attempts": [
    {
      "id": "6f1c0b3e-1111-4222-8333-444444444444",
      "questionId": "day-001-q2",
      "lessonId": "day-001",
      "tags": ["は"],
      "userAnswer": "わ",
      "correct": false,
      "timestamp": "2026-10-01T21:04:05+08:00",
      "localDate": "2026-10-01",
      "attemptNo": 1
    }
  ]
}
```

| 欄 | 說明 |
| --- | --- |
| `id` | 每次作答一個 UUID。合併靠呢個，唔好改 |
| `questionId` | 對應課題入面嘅題目 `id` |
| `lessonId` | 課題 `id` |
| `tags` | 作答當時題目上嘅標籤 |
| `userAnswer` | 選擇題係選項文字；填空係 Andy 打嘅字（未正規化） |
| `correct` | 嗰次對唔對 |
| `timestamp` | 帶裝置時區偏移嘅 ISO-8601，例如 `+08:00` |
| `localDate` | 由 `timestamp` 嘅本地日期抽出嚟，用嚟計連續日 |
| `attemptNo` | 同一題嘅第幾次作答，由 1 起 |

月份用 `localDate` 嘅 `YYYY-MM`。

## 點樣搵弱項

1. 開 `summary.json`。
2. 先睇 `weakTags`。錯誤率 `errorRate` 越高、`attempts` 越多，越值得下一課再練。
3. 再睇 `mistakes`（同 `weakQuestions` 係同一套「最近仍然答錯」嘅題）。`prompt` 同 `correctAnswer` 可以直接出複習題。
4. 如果要計「第一次就啱定係靠重練」，去月份檔用 `questionId` 同 `attemptNo` 自己數。總表嘅正確率係**所有次數**，唔係淨係第一次。
5. `lastStudyDate` 早過尋日，表示連續打卡可能已經斷，或者今日未練。`streak.current` 先至係 app 顯示嗰個數。

## 合併規則

重複撳同步、或者兩部機先後同步，都唔會重複或者整走紀錄：

1. 讀取遠端 `logs/attempts/` 入面所有 `YYYY-MM.json`，再加本部機有、遠端未有嘅月份。
2. 同一個 `id` 只留一筆。遠端已有嘅 `id` 保持原樣，只追加本地新 `id`。
3. 如果寫入時 sha 衝突（409），會重新讀取再合併，最多試 4 次。
4. 內容同遠端一樣（GitHub 回「identical」）當成功，唔會再開一個空 commit。
5. 全部月份寫完，先至重寫 `logs/summary.json`，然後先更新部機入面嘅副本。所以一部新手機同步之後，會攞到另一部機已經同步咗嘅紀錄。

金鑰只喺 Andy 部機。匯出 JSON 都唔包含金鑰。
