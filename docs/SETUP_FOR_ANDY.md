# Andy 設定步驟

呢份係畀 Andy 喺 iPhone 用 Safari 跟住做。唔使寫程式。做完之後，每日開主畫面個「日文日誌」圖示就得。

你會做三件事：開網站、加到主畫面、貼上一條 GitHub 金鑰。金鑰只留喺你部手機，唔好貼去聊天或者 GitHub 檔案。

## 1. 開啟網站

1. 用 Safari 打開：<https://github.com/andyleehsa/japanese-log/settings/pages>
2. 如果要登入，先登入你個 GitHub 帳號。
3. 見到 **Build and deployment**：
   - Source 揀 **Deploy from a branch**
   - Branch 揀 **main**
   - 隔離個資料夾揀 **/ (root)**
4. 撳 **Save**。
5. 等一兩分鐘，頁面會話網站喺：<https://andyleehsa.github.io/japanese-log/>

如果未見到 Save，可以改用手動路徑：打開 <https://github.com/andyleehsa/japanese-log> → **Settings** → **Pages** → **Deploy from a branch** → **main** → **/ (root)** → **Save**。

手機版有時要先撳左上角選單，先見到 Settings。

未開 Pages 之前，個網址會顯示 404。開咗都可能要等幾分鐘。

唔好將呢個 repo 轉做 private，否則老師開唔到進度連結。亦唔好喺 GitHub 鎖死 `main`（branch protection 唔畀 push），否則個 app 寫唔到紀錄。

## 2. 加到主畫面

一定要用 **Safari**，唔好用 Chrome。

1. Safari 打開 <https://andyleehsa.github.io/japanese-log/>
2. 見到「日文日誌」同今日課題，就係開得啱。
3. 撳底部分享掣（一個正方形，上面有箭嘴）。
4. 向下搵 **加入主畫面**（英文係 **Add to Home Screen**）。
5. 名稱留 **日文日誌**，撳 **加入**。
6. 返回主畫面，撳新圖示開。開咗之後上面唔應該再見到 Safari 條網址。

第一次要有網絡。之後冇網絡仍然睇到之前載入過嘅課題同你嘅紀錄。老師放咗新課題，駁返網絡，喺主頁撳「重新載入課題」。

## 3. 建立金鑰

金鑰令部手機可以將練習紀錄寫入你個 repo。只給呢一個 repo、只給改檔案嘅權限。

1. Safari 打開：<https://github.com/settings/personal-access-tokens/new>
2. 如果問你用邊種，揀 **Fine-grained tokens**（唔好用舊式、開頭 `ghp_` 嗰種）。
3. 填表：
   - **Token name**：`japanese-log-phone`
   - **Expiration**：揀 90 日，或者清單入面最長嗰個。過期就要再做一次，再貼過新金鑰。
   - **Resource owner**：揀你自己（`andyleehsa`）
   - **Repository access**：揀 **Only select repositories**
   - 撳選 repo 嘅框，只揀 **japanese-log**
4. **Permissions** → **Repository permissions**：
   - 搵 **Contents**
   - 右邊由 **No access** 改做 **Read and write**
   - 其他全部留 **No access**。唔使勾 Actions、Administration 或者其他。
5. 拉到最底，撳 **Generate token**。
6. 下一頁會顯示一條好長嘅字，開頭係 `github_pat_`。呢頁只會出現一次。撳複製。
7. 如果唔小心關咗頁，舊嗰條睇唔返，要再 Generate 一條新嘅。

## 4. 貼入 app 同試一次

1. 由主畫面個圖示開「日文日誌」。用 Safari 分頁都用得，但建議用圖示，咁先係獨立 app。
2. 底欄撳 **設定**。
3. 撳住個大格，貼上成條金鑰。
4. 撳 **儲存金鑰**。應該見到「已儲存（尾 xxxx）」，xxxx 係金鑰最後 4 個字。
5. 撳 **而家同步**。
6. 成功會話：「同步成功。老師而家可以睇到你嘅進度。」即使未做練習都可以同步，用來確認金鑰啱。

失敗時個 app 會用中文講原因：

| 你見到 | 點算 |
| --- | --- |
| 而家冇網絡 | 駁 Wi-Fi 或流動數據再撳一次。紀錄仍然喺部機 |
| 金鑰唔啱或者過期 | 重新產生一條，再貼過 |
| GitHub 拒絕咗 | Contents 未揀 Read and write，或者揀錯 repo |
| 搵唔到 japanese-log | Resource owner 或者 repo 揀錯。GitHub 有時會用「搵唔到」代表冇權限 |

老師確認嘅網址（用瀏覽器開，應該見到 JSON，唔係 404）：

<https://raw.githubusercontent.com/andyleehsa/japanese-log/main/logs/summary.json>

## 5. 每日點用

1. 開圖示。主頁有連續幾多日、整體正確率、今日課題。
2. 撳 **開始溫習**，睇完教學再撳 **開始練習**。
3. 選擇題撳一次就有對錯同解釋。填空用平假名打，再撳提交。
4. 做完如果已儲存金鑰同有網絡，會自動同步。主頁有「上次同步」時間。
5. **錯題** 可以再練最近仍然答錯嘅題。答啱就會離開錯題本。
6. **紀錄** 睇每課、每個主題、日曆。

有「讀出嚟」嘅掣先會讀日文。如果部機唔支援，個掣唔會出現。

## 6. 同步唔到嘅後備

設定頁撳 **匯出 JSON**。iPhone 多數會開分享畫面，揀「儲存檔案」或者傳給老師。呢個檔有練習紀錄，冇金鑰。

換手機：新機再貼一條金鑰（或者同一條未過期嘅），撳同步。已經寫入 GitHub 嘅紀錄會拉返落新機。舊機未同步嘅紀錄要喺舊機再同步一次，先至唔會唔見。

金鑰過期：跟第 3 步再開一條，貼上覆蓋。可以喺 GitHub 嘅 fine-grained tokens 頁刪走舊嗰條。

清除練習紀錄（設定頁最底「進階」）只會清呢部機，唔會刪 GitHub 上已同步嘅紀錄，亦唔會清金鑰。
