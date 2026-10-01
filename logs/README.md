# 學習紀錄

呢個資料夾由 Andy 部手機上嘅「日文日誌」寫入，唔好人手改。

- `attempts/YYYY-MM.json`：每個月份嘅作答，靠每筆紀錄嘅 `id` 合併，重複同步唔會重複計。格式同以前一樣。
- `vocab.json`：生詞「識／唔識」。同一個生詞 id 留 `updatedAt` 較遲嗰筆。
- `summary.json`：每次同步成功之後重寫，老師睇進度用呢份。多咗每級課程百分比、每個課題統計，同生詞識／唔識。

Andy 未同步之前，呢兩個檔未存在。格式見 [docs/LOGBOOK_FORMAT.md](../docs/LOGBOOK_FORMAT.md)。
