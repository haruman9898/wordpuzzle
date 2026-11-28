# wordpuzzle — アルファベット分解パズル

スマホブラウザ（縦画面）向けのカジュアルパズル。アルファベットを形のパーツに分解し、ドラッグで枠にはめて英単語を完成させる。企画・仕様・レビューは Muse、実装は Claude Code。

## 資料（正の順）
1. `docs/spec/decisions.md` — ユーザーの承認事項。仕様書より新しい場合はこちらを優先する
2. `docs/spec/spec-v0.1.md` — 実装仕様
3. `docs/spec/prototype-brief.md` — 試作指示書（範囲・定数・報告項目）
4. `docs/spec/parts-table-v0.6.md` — 全26文字の分解式
5. `docs/spec/concept-memo-v0.2.md` — 背景と決定の理由
6. `docs/letters-preview.html` — 承認済みの文字形状（線の太さ 12）

## 守ること
- 仕様の食い違いや、仕様にない追加は、勝手に決めずに報告する。仕様書の更新は Muse の担当。決定事項は `docs/spec/decisions.md` に追記する。
- 数値の調整から始めない。まず小さく作って触って確かめる（1単語の手触り確認版 → ステージ1〜3）。
- 調整用の定数（制限時間、星の境界、BONUS_SECONDS、HINT_DELAY_SEC、SNAP_RADIUS、DRAG_OFFSET_Y、POOL_ORIENTATION）はコード冒頭にまとめる。
- ビルドツールを使わない静的な HTML/CSS/JS。音は Web Audio で合成（音声ファイルなし）。
- 振動が効かない環境でも、音と演出だけで成立させる。エラーにしない。
- `localStorage` の読み書きは try/catch で守る。

## 検証の限界
- 手触り・振動・音の質は、ユーザーの iPhone（iOS 17.4 以降）でしか確認できない。ヘッドレス Chromium の FPS はスマホの FPS ではない。
- 実機の FPS は、公開版の診断表示をユーザーに読んでもらう。

## 進め方・運用
- Sonnet がメインでコードを書く。Haiku がリポジトリ内の検索・grep・diff のレビューを担当する。重要な判断は Opus（アドバイザー）。設定は `.claude/` にある。
- 開発ブランチは `claude/funny-franklin-znsfm4`。PR は、ユーザーから依頼があった時だけ作る。
- 公開は GitHub Pages。Settings → Pages → Source を「GitHub Actions」にする設定は、ユーザーがリポジトリ側で一度行う。
