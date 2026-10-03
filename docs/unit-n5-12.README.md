# 單元 12「動詞入門：辭書形與三類動詞」試點內容說明

- 內容檔：`/workspace/jp-content/unit-n5-12.json`（UTF-8，縮排 2 格，`schemaVersion: unit-v1-pilot`）
- 產生腳本：`scripts/build_unit_12.py`（修改內容請改此檔再重新產生，勿手改 JSON）
- 檢查腳本：`scripts/check_unit.py`（結構、id、grammar 標籤、tts／助詞、口語字掃描）、`scripts/check_prereq.py`（詞彙前置檢查）
- 全部中文（意思、講解、題目解說、介面字串）使用書面中文；日語術語一律稱「辭書形」。

## 1. 結構統計
3 課、6 個文法點、15 個新詞、59 題（練習 44＋聆聽 15）。聆聽題 15 題（含課內 9、故事 3、小測 3），其中 `needsRealDeviceCheck: true` 共 2 題。

## 2. 欄位清單
- 單元：`id, level, number, title, theme, prerequisites, ui（介面字串）, grammarIndex, lessons[], tips{sections, tables, flowcharts}, story{reading, speaking, listening}, quiz`
- 課：`id, number, title, description, estimatedMinutes, prerequisites, vocab[], reviewVocab[], grammar{points[]}, exercises[], listening[]`
- 詞：`id, kana, kanji, reading, zh, tts, particles, pos, group(一類/二類/三類), groupDetail, groupNote(「一類（看似二類）」), audio, example, addedBeyondOutline`
- 文法點：`id, title, blocks[]`；block 類型 `text / table / example / term / flowchart / table_ref`
- 日語項目（詞、例句、選項、題幹）一律有：`ja, reading（平假名）, zh, tts, particles`（`particles` 為助詞清單，空陣列＝沒有助詞）
- 例句 `example`：另有 `id(e-…), highlight[], note, audio`
- 題目共通：`id, type, kind, lesson, grammar[], prompt, options/left/right/pieces, answer, answerDisplay（回饋面板「正確答案」行）, rule（第二行）, explanation, source(new|reused), sourceRef/sourceNote`
- 題型 `type`：`choice`（選擇）、`fill`（填空）、`match`（配對，`answer` 為 左id→右id 對照）、`reorder`（重組，`answer`＝`answerOrder`＝片段 id 順序，`target` 為正確句）、`listen-choice`（聆聽選擇）
- 聆聽題另有：`audio{ttsText, engine, rate, file}, showStem（預設 false）, stem（僅 showStem 為 true 時存在）, reveal{ja,reading,zh,tts}, needsRealDeviceCheck, listeningNote`

## 3. id 規則（永不改變）
`u-n5-12` 單元；`l-n5-12-1…3` 課；`g-n5-12-01…06` 文法點；`w-n5-12-001…015` 詞；`q-n5-12-001…061` 題（036、045 於 v1.1 停用，不再使用）；`e-n5-12-001…` 例句；`s-n5-12-001…015` 故事句；`st-n5-12(-r/-s/-l)` 故事；`sp-n5-12-01/02` 說話任務；`qz-n5-12` 小測；`tip-/tbl-` 小貼士。選項／配對／片段的 id（a、b、l1、r1、p1）只在題目內有效。書籤與錯題庫可直接使用以上 id。

## 4. 發音文字（tts）規則
`tts` 為送入語音的假名文字：助詞「は／へ／を」轉成「わ／え／お」（如「わたしは」→`わたしわ`），詞語本身的「は／へ」不變（如「はいる」「はなす」）。助詞位置記錄於 `particles:[{surface,index,ttsAs,role}]`（`index` 為 `reading` 字串的位置）。腳本已驗證 `tts` ＝ `reading` 套用 `particles` 的結果。`audio.file` 預留給日後預錄音檔。

## 5. 聆聽標記清單（`needsRealDeviceCheck: true`）
| id | 位置 | 要檢查的點 |
|---|---|---|
| q-n5-12-024 | 第 2 課聆聽 | 「おばあさん」是否讀出長音（5 拍），與「おばさん」（4 拍）有明顯差別；「ば」是否清晰的濁音，沒有變成「ぱ」「は」 |
| q-n5-12-058 | 小測聆聽 | 同上（同一組詞，題目方向不同） |

其餘聆聽題不依賴長短音、促音或濁音對比（本單元的動詞沒有長音）。另有兩題的 `listeningNote` 有提醒：q-n5-12-060（「かえる」已改為顯示漢字，若 TTS 讀成「蛙」的音調請記錄）、q-n5-12-046（確認助詞「は」讀作「わ」）。

## 6. 給 Andy 在真實 iPhone 測試的聆聽題清單（全部 15 題）
重點測：**q-n5-12-024、q-n5-12-058**（長音）。其餘請確認發音清楚、速度適中：
q-010、011、012（第 1 課）；q-022、023（第 2 課）；q-035、060、037（第 3 課）；q-044、061、046（故事）；q-057、059（小測）。
測試時請記錄：① 是否有讀錯的詞（尤其「かえる」「はいる」「はなす」）；② 「ちょっと」的促音是否清楚；③ 「わたしわ」是否自然。（以上 id 省略前綴 `q-n5-12-`）

## 7. 與 `design/app-design-v2.md` 第 7 節的差異
1. 詞的 `{kana, kanji, zh, audio}` 擴充為 `{kana, kanji, reading, zh, tts, particles, group, …}`；`audio` 保留但為 `null`（預留預錄檔），發音文字用新欄位 `tts`（第 7 節沒有此欄位）。
2. 課的 `grammar{blocks}` 改為 `grammar{points[{id,title,blocks}]}`，因每個文法點需要固定 id 與書面語標題。
3. 題目的 `reading` 欄位改為各日語項目內的 `reading`；另加 `grammar[]`、`answerDisplay`、`explanation`、`kind`、`source`。
4. 第 7 節的 `listening[]` 依規定保留，但題目格式與練習相同；故事另有 `speaking`、`listening`（大綱只標「讀」，依任務要求三項都寫，App 可按老師標示決定顯示）。
5. `tips` 加入 `flowcharts`（三類分類流程圖，含節點、連線與文字步驟 `stepsText`，若 App 暫不畫圖可顯示文字步驟）。
6. 每課的新詞為 5 個：第 2 課大綱只列 くる・おきる・ねる（みる・たべる 為第 1 課舊詞），故**額外新增 おしえる、でかける**（`addedBeyondOutline: true`），並以 `reviewVocab` 列出複習詞 みる・たべる。
7. 題型名稱使用 `choice / fill / match / reorder / listen-choice`；「選圖」「讀解」在本單元未使用。

## 8. 給 App 開發的整合備註
- 重點標記：`**粗體**`＝橙色重點，反引號＝淺底公式標籤；表格儲存格可為字串、日語物件（含讀音）或物件陣列。
- 助詞發音以 `tts` 為準，顯示用 `ja` / `reading`；不要自行轉換。
- 選項預設不洗牌（`shuffle:false`），App 可自行洗牌，答案以 id 判斷。
- `match` 題的 `answer` 是物件（左 id → 右 id）；`reorder` 題的 `answer` 是片段 id 陣列。
- `listen-choice`：作答前不顯示 `reveal`；答錯面板顯示 `reveal.ja` ＋ `reveal.reading`。
- `exposureOnly: true`（「切る」）只在小貼士出現，不出題，也不列入詞表。
- 故事句 `s-n5-12-xxx` 帶 `verbWordId`，可做詞典連結；**v1.1 起故事句不再帶 `group`**。讀頁在作答前請勿顯示 `verbWordId` 所指詞的類別。
- 修改 JSON 後請先執行 `python3 scripts/check_unit.py unit-n5-12.json` 與 `python3 scripts/check_prereq.py`。

## 9. 前置文法人手列表（單元 12 用到的語法）
| 用到的語法 | 來源 |
|---|---|
| 助詞「は」（主題）、名詞（わたし）、時間詞（あさ・いま・きょう・あした）無助詞直接修飾動詞 | 單元 5、6 |
| 副詞「ちょっと」 | 單元 11-3 |
| 辭書形直接結束句子（備忘體） | 本單元 g-n5-12-01 已說明；禮貌形（ます）不使用 |
| 「う段」「行」「段」 | 本單元 g-n5-12-01 補充；對應單元 1 五十音表 |
| 不使用：を、に、へ、で、が、と、ます形、て形、ない形、た形、疑問詞 | 後續單元才教 |

## 10. 不確定之處／需老師或 Andy 決定
1. 辭書形直接結句的「備忘體」例句（如「あした行く。」）在大綱中沒有明列，屬於本單元為避免提前使用「を」「に」「ます」而採用的折衷；若不想引入，可只保留詞彙與分類題。
2. 第 2 課額外新增兩個二類動詞（おしえる、でかける）以湊足 5 個新詞，請確認是否接受。
3. 沒有題目依賴長音的動詞，故以「おばあさん／おばさん」作長音複習；「おばさん」只在單元 2 小貼士出現，未列入任何單元的詞表。
4. 「來」「去」等 zh 意思簡短，如需要更完整的詞義可再補。

## 11. v1.1 變更記錄（依 App 測試員對 PR #3 的疑點）
### 11.1 故事讀頁洩漏動詞類別
- 移除 `story.reading.lines[].group`（原值「一類／二類／三類／一類（看似二類）」）。q-038、041、043 的答案不再事先可見。
- 同步移除故事題目選項中複製的句子物件內的 `group`（q-039、040、046 的選項；q-044、046 的 `reveal`）。
- 其他位置檢查：小貼士與課內文法頁是教學內容，保留類別資訊；故事其餘欄位沒有類別資訊。q-050（小測）題幹原有「（留意：形似二類）」會提示答案，已刪除；課內 q-027、028 為教學練習，保留該提示。
- `check_unit.py` 新增檢查：故事句不得含 `group`／`groupNote`／`groupDetail`。

### 11.2 分類題標籤統一
- 規則：分類題（`choice`／`listen-group`）的 `answerDisplay` 必須與答案選項的 `text` 完全相同；配對題沿用短標籤（一類／二類／三類）。
- q-027、q-028、q-050：`answerDisplay` 由「一類（五段，看似二類）」改為「一類（五段）」，與選項一致；「看似二類」只放在 `explanation`（並說明是一類（五段）動詞）。這樣做是為了不讓選項本身提示答案。
- q-012、q-037、q-059（`listen-group`）：`answerDisplay` 原為日語詞（行く（いく）等），改為類別標籤（一類（五段）／一類（五段）／二類（一段））；日語詞與讀音仍在 `reveal`。
- 已逐題核對全單元分類題，標籤一致（腳本檢查）。

### 11.3 「かえる」同音問題（題目 id 變更）
| 舊 id（停用） | 新 id | 改前 | 改後 |
|---|---|---|---|
| q-n5-12-036 | q-n5-12-060 | 只聽音頻，選「帰る／かう／入る／話す」 | 題幹顯示漢字「帰る」並註明「回去、回家」，聽音頻後選讀音（かう／はいる／かえる／はなす），`kind: listen-reading`，不再依賴同音辨別 |
| q-n5-12-045 | q-n5-12-061 | 只聽「きょうかえる」判斷類別 | 題幹顯示句子「きょう帰る。」並註明「今天回去」，聽音頻後判斷類別，`kind: listen-group` |
- 036、045 不再出現，也不會用於其他內容。聆聽題總數仍為 15，`needsRealDeviceCheck` 仍為 2 題（q-024、q-058 保留標記）。

### 11.4 對 App 的影響（欄位結構變更）
1. 刪除：`story.reading.lines[].group`。
2. 新增（聆聽題，可選）：`showStem`（q-060、q-061 為 true）與 `stem`（要顯示的漢字／句子）；其他聆聽題維持 `showStem: false` 且沒有 `stem`。App 需在 `showStem` 為 true 時於音頻旁顯示 `stem.ja` ＋ `stem.reading`（和中文提示在 `prompt`）。
3. 新增 `kind` 值：`listen-reading`（q-060）。
4. `listen-group` 題的 `answerDisplay` 現在是類別標籤（與選項相同），不再是日語詞；日語詞用 `reveal`。
5. 題目 id：停用 q-n5-12-036、045，新增 q-n5-12-060、061；舊進度或書籤若記錄這兩個 id 需改為新 id（內容已不同，建議視為新題）。
6. 題目總數 59 題不變（練習 44＋聆聽 15）。

## 12. v1.2 變更記錄
- q-n5-12-060 的 `stem` 新增 `hideReading: true`。作答前只顯示 `stem.ja` 與 `stem.zh`，不顯示 `stem.reading`（避免在選讀音之前把「かえる」寫在題幹上）。作答後，回饋面板可以顯示讀音。
- 其他題目不變。q-n5-12-061 沒有 `hideReading`，作答前仍顯示 `stem.ja` 與 `stem.reading`。
