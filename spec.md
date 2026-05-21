# Kindle OCR Reader

## 概要

Kindle Cloud Reader を Playwright で操作し、表示中ページをスクリーンショット取得して OCR に渡し、日本語音声読み上げを行うローカルアプリケーションを開発する。

本システムは DRM の解除や Kindle ファイル解析を行わず、ユーザーが画面上に表示している内容のみを対象とする。

主用途は以下。

- 個人利用向け読み上げ支援
- 日本語縦書き Kindle の音声化
- OCR + TTS パイプラインの研究
- AI による文章補正実験

---

# 技術スタック

## 必須

- TypeScript
- Node.js
- Playwright
- Kindle Cloud Reader
- PaddleOCR
- Irodori-TTS

## 推奨

- sharp
- zod
- pino
- commander
- dotenv

---

# システム構成

```text
Playwright
↓
Kindle Cloud Reader
↓
ページスクリーンショット
↓
画像前処理
↓
PaddleOCR
↓
OCR結果整形
↓
LLM補正 任意
↓
Irodori-TTS
↓
音声再生
````

---

# スコープ

## 実装対象

* Kindle Cloud Reader 自動操作
* ページ領域スクリーンショット
* ページ送り
* ページ変化検知
* OCR 実行
* OCR テキスト保存
* 音声生成
* 音声再生
* 読書位置管理

## 非対象

* DRM解除
* Kindleファイル解析
* Kindle内部データ抽出
* 商用配布
* 全文抽出ツール化
* Amazon制限回避

---

# アーキテクチャ

## ディレクトリ構成

```text
src/
  app/
  browser/
  capture/
  ocr/
  tts/
  storage/
  pipeline/
  utils/
  config/

data/
  screenshots/
  ocr/
  audio/
  cache/

prompts/

docs/
```

---

# 機能要求

# 1. Kindle Cloud Reader 起動

## 要件

* Playwright で Chromium を起動
* Kindle Cloud Reader を開く
* ログイン状態を維持
* storageState に対応

## 詳細

初回ログイン後、認証情報を保存する。

```ts
browser.newContext({
  storageState: "auth.json"
})
```

---

# 2. スクリーンショット取得

## 要件

* Kindle本文領域のみ取得
* PNG形式
* 高解像度対応
* headful mode

## 詳細

以下いずれかで取得。

* locator.screenshot
* clip screenshot

例:

```ts
await locator.screenshot({
  path: "page.png"
})
```

---

# 3. ページ送り

## 要件

* ArrowRight に対応
* マウスクリック送り対応
* 自動送り間隔設定可能

## 詳細

Playwright keyboard API を利用。

```ts
await page.keyboard.press("ArrowRight")
```

---

# 4. ページ変化検知

## 要件

* sleep固定待機は禁止
* スクショ差分判定
* hash比較

## 詳細

前後画像 hash を比較し、変化したら次処理へ進む。

推奨:

* perceptual hash
* sha256
* pixelmatch

---

# 5. OCR

## 要件

* 日本語縦書き対応
* ローカル実行
* CLI 呼び出し可能

## OCRエンジン

第一候補:

* PaddleOCR

代替:

* Tesseract
* EasyOCR

## OCR入力

* PNG
* グレースケール済み画像

---

# 6. 画像前処理

## 要件

* OCR精度向上
* ノイズ低減
* ルビ軽減

## 処理

* grayscale
* threshold
* contrast
* resize
* sharpen

## ライブラリ

* sharp

---

# 7. OCR整形

## 要件

* 改行修正
* ルビ除去
* ページ番号除去
* 縦書き順序補正

## 詳細

OCR結果を自然な日本語文章へ変換する。

例:

```text
縦書きOCR結果
↓
自然な横書き文章
```

---

# 8. LLM補正 任意

## 要件

* OCR誤認識修正
* 不自然改行修正
* 会話文補正

## 入力

OCR結果テキスト

## 出力

自然な日本語文章

---

# 9. Irodori-TTS連携

## 要件

* テキスト音声化
* ストリーミング再生
* sentence chunking

## 入力

整形済みテキスト

## 出力

wav または streaming audio

---

# 10. 音声再生

## 要件

* 自動連続再生
* 停止
* 次ページ
* 再生位置保持

---

# 11. 状態管理

## 保存対象

* 現在ページ
* OCR済みページ
* 音声生成済みページ
* 再生位置

## 保存形式

json

例:

```json
{
  "bookId": "xxx",
  "page": 120,
  "audioGenerated": true
}
```

---

# CLI要求

## コマンド例

```bash
pnpm start
```

```bash
pnpm capture
```

```bash
pnpm ocr
```

```bash
pnpm tts
```

---

# 設定ファイル

## .env

```env
KINDLE_URL=
OCR_PATH=
IRODORI_TTS_URL=
HEADLESS=false
CAPTURE_INTERVAL_MS=1000
```

---

# Playwright設定

## 必須

* Chromium
* headful
* viewport固定

## 推奨

```ts
{
  viewport: {
    width: 1600,
    height: 1200
  }
}
```

---

# エラーハンドリング

## 必須

* ページ送り失敗
* OCR失敗
* Kindle未ログイン
* Cloud Readerロード失敗
* 空OCR結果

---

# ログ要求

## 必須

* ページ番号
* OCR時間
* TTS時間
* スクショ保存先
* エラー詳細

---

# 性能要求

## MVP

* 1ページ 3秒以内 OCR開始
* 連続100ページ処理可能
* メモリリーク無し

---

# セキュリティ

## 必須

* ローカル実行限定
* 外部共有禁止
* Kindle認証情報暗号化推奨

---

# 実装フェーズ

# Phase 1

## 目的

スクリーンショット取得

## 実装

* Playwright起動
* Kindle Cloud Reader起動
* 手動ログイン
* スクショ保存
* ページ送り

---

# Phase 2

## 目的

OCR連携

## 実装

* PaddleOCR
* 画像前処理
* OCR保存

---

# Phase 3

## 目的

TTS連携

## 実装

* Irodori-TTS
* 音声再生
* queue制御

---

# Phase 4

## 目的

AI補正

## 実装

* OCR補正
* sentence chunking
* 読みやすさ改善

---

# テスト要求

## 必須

* ページ送りテスト
* OCR精度テスト
* 重複ページ検知
* 空ページ処理
* エラー復旧

---

# 将来拡張

## 候補

* Whisper風 sentence timing
* AI要約
* 登場人物メモ
* 読書履歴
* Kindleライブラリ管理
* Web UI
* 音声キャッシュ
* マルチブック対応

---

# 参考資料

* [Playwright Screenshots Documentation](https://playwright.dev/docs/screenshots?utm_source=chatgpt.com)
* [Kindle Cloud Reader](https://read.amazon.com/?utm_source=chatgpt.com)
* [Irodori-TTS GitHub](https://github.com/Aratako/Irodori-TTS?utm_source=chatgpt.com)
* [PaddleOCR GitHub](https://github.com/PaddlePaddle/PaddleOCR?utm_source=chatgpt.com)

```
::contentReference[oaicite:4]{index=4}