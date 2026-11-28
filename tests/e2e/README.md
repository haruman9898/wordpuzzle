# E2E テスト（Playwright・ヘッドレス Chromium）

実際のマウス操作（ドラッグ）で、はめる・間違い・入れ替え・ヒント・コイン保存・保存不可・標準形モードを確認する。
手触り・振動・音の質は、このテストでは分からない（ユーザーの iPhone で確認する）。

```
python3 -m http.server 8123 &          # リポジトリのルートで
cd tests/e2e && OUT=/tmp node t1.js && OUT=/tmp node t2.js
```
