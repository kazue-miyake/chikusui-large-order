# Google Sheets保存の設定手順

## 作成済みの保存先

- スプレッドシート: https://docs.google.com/spreadsheets/d/10SQCFtT_J4jToNORlHjrNziLh3AN4v_Zdhmj4t4ZONY/edit
- データタブ: `注文データ`
- Apps Scriptコード: `sheets_web_app.gs`

## Apps Script設定

1. 上記スプレッドシートを開く。
2. メニューから `拡張機能` -> `Apps Script` を開く。
3. `sheets_web_app.gs` の内容を貼り付けて保存する。
4. `デプロイ` -> `新しいデプロイ` を選ぶ。
5. 種類は `ウェブアプリ`。
6. 実行ユーザーは `自分`。
7. アクセスできるユーザーは、このアプリを使う範囲に合わせて選ぶ。
   - 店舗内だけなら限定公開。
   - GitHub Pagesから複数端末で使うなら、必要に応じて `全員` または `リンクを知っている全員`。
8. 発行された `https://script.google.com/macros/s/.../exec` のURLをコピーする。
9. 大口注文ツールを開き、`Google Sheets連携` のURL欄へ貼り付けて `URL保存`。
10. 既存の端末内データを移す場合は `端末データ移行`。

## 注意

- 通常項目はスプレッドシートに保存される。
- 写真はGoogle Driveの `大口注文_製造指示書写真` フォルダへ保存され、シートには画像URLが保存される。
- 削除は物理削除ではなく、シート上で `deleted=TRUE` にする方式。
