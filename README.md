# 日文日誌

離線可用的日文學習網頁。課程按等級排列成單元路線；目前開放的是 N5 單元 12。練習、錯題本和生詞標記只保存在這部裝置，沒有同步，也不需要金鑰。

開啟網址：<https://andyleehsa.github.io/japanese-log/>

## 開啟 GitHub Pages

1. 打開 <https://github.com/andyleehsa/japanese-log>
2. 進入 **Settings**
3. 左側選擇 **Pages**
4. **Build and deployment** 選擇 **Deploy from a branch**
5. Branch 選擇 **main**，folder 選擇 **/ (root)**
6. 按 **Save**

幾分鐘後，網站會在 <https://andyleehsa.github.io/japanese-log/>。在 iPhone 上加入主畫面的步驟見 [docs/SETUP_FOR_ANDY.md](docs/SETUP_FOR_ANDY.md)。

## 怎樣用

底部有三個分頁：學習、複習、我的。

- **學習**：顯示目前等級的單元。進度的分母是該等級所有單元的課數之和，分子是已走到完成畫面的課。只有一份等級時，不顯示等級切換。
- **單元**：狀態為準備中的單元可以點開，畫面寫「內容準備中」。已開放的單元可以進入各課、小貼士、情境故事和小測。尚未完成的前置單元只顯示「建議先完成」，不會鎖住。
- **一課**：生詞卡、文法、練習、聆聽，走到完成畫面後這一課計入進度。
- **複習**：錯題本。答錯的題目會按 2、5、10 日再出現。
- **我的**：字體可選標準、大、特大。可以清除這部裝置上的進度。

日文練習字至少 24px。喇叭讀的是發音欄位；若題目附有音檔就播音檔，否則使用系統語音。

## 檔案

| 路徑 | 用途 |
| --- | --- |
| `index.html`、`js/`、`css/`、`sw.js`、`manifest.json` | 網頁與離線快取 |
| `content/units-index.json` | 等級與單元路線 |
| `content/units/` | 已開放單元的課文 |
| `docs/` | 設定、課文格式、單元說明 |
| `scripts/validate-content.js` | 檢查課文，不需第三方套件 |
| `scripts/check_unit.py` | 同一套單元檢查的 Python 版本 |
| `scripts/test-logic.js` | 判分、進度與回饋的邏輯測試 |

老師撰寫單元前請讀 [docs/CONTENT_FORMAT.md](docs/CONTENT_FORMAT.md)。單元 12 的欄位說明見 [docs/unit-n5-12.README.md](docs/unit-n5-12.README.md)。

檢查課文與邏輯：

```bash
node scripts/test-logic.js
npm run validate-content
python3 scripts/check_unit.py content/units/unit-n5-12.json
```
