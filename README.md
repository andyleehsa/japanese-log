# 日文日誌

Andy 用嚟自學日文嘅單人網頁 app。每日一課同練習由老師寫 JSON 放上嚟；Andy 唔使打內容。進度存在部手機，撳「同步畀老師」先寫入呢個 repo。

開啟網址：<https://andyleehsa.github.io/japanese-log/>

## 開啟 GitHub Pages

1. 打開 <https://github.com/andyleehsa/japanese-log>
2. 撳 **Settings**
3. 左邊撳 **Pages**
4. **Build and deployment** 揀 **Deploy from a branch**
5. Branch 揀 **main**，folder 揀 **/ (root)**
6. 撳 **Save**

幾分鐘之後，網站會喺 <https://andyleehsa.github.io/japanese-log/>。iPhone 完整步驟見 [docs/SETUP_FOR_ANDY.md](docs/SETUP_FOR_ANDY.md)。

## 檔案

| 路徑 | 用途 |
| --- | --- |
| `index.html`、`js/`、`css/`、`sw.js`、`manifest.json` | 網頁同離線用 |
| `content/index.json`、`content/lessons/` | 課題 |
| `logs/summary.json`、`logs/attempts/` | Andy 同步之後先出現 |
| `docs/` | 課題格式、進度格式、Andy 設定 |
| `schema/` | JSON Schema |
| `scripts/validate-content.js` | 檢查課題，冇第三方套件 |

老師寫課題之前請讀 [docs/CONTENT_FORMAT.md](docs/CONTENT_FORMAT.md)。睇進度請讀 [docs/LOGBOOK_FORMAT.md](docs/LOGBOOK_FORMAT.md)。

檢查課題：

```bash
node scripts/validate-content.js
node scripts/test-logic.js
```

`day-001` 同 `day-002` 係樣本，可以換走。
