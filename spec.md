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
- NDLOCR-Lite
- Irodori-TTS
- LM Studio

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
NDLOCR-Lite
↓
OCR結果整形
↓
LM Studio による LLM補正 任意
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
* Kindle の縦書き本文を主対象とする

## OCRエンジン

第一候補:

* NDLOCR-Lite

代替:

* PaddleOCR
* Tesseract
* EasyOCR

## OCR入力

* PNG
* グレースケール済み画像

## NDLOCR-Lite 方針

* 日本語縦書きOCRの第一候補として利用する
* ローカル環境で実行する
* CLI または Python 実行スクリプトから呼び出せる形にする
* 入力画像は前処理済み PNG を基本とする
* 出力はページ単位のテキストとして `data/ocr/` に保存する
* 失敗時はエラー詳細をログに残し、空OCR結果として扱えること

## NDLOCR-Lite 実行方式

NDLOCR-Lite は `ndl-lab/ndlocr-lite` を利用する。

前提:

* Python 3.10 以上
* Windows / macOS / Linux で動作
* GPU は必須としない

導入例:

```bash
git clone https://github.com/ndl-lab/ndlocr-lite
cd ndlocr-lite
pip install -r requirements.txt
```

実行例:

```bash
cd ndlocr-lite/src
python3 ocr.py --sourceimg page.png --output output_dir
```

uv を利用する場合:

```bash
git clone https://github.com/ndl-lab/ndlocr-lite
cd ndlocr-lite
uv tool install .
ndlocr-lite --sourceimg page.png --output output_dir
```

ディレクトリ単位で処理する場合:

```bash
python3 ocr.py --sourcedir data/screenshots/run-id --output data/ocr/run-id
```

利用する主なオプション:

* `--sourceimg`: 1枚の画像をOCRする
* `--sourcedir`: ディレクトリ内の画像を一括OCRする
* `--output`: OCR結果の出力先
* `--json-only`: JSONのみ出力する
* `--enable-tcy`: 縦中横の読み取り改善に利用する

対応入力形式:

* jpg / jpeg
* png
* tiff / tif
* jp2
* bmp

PageCaster では、Phase 2 MVP は `--sourceimg` によるページ単位OCRから開始し、安定後に `--sourcedir` による一括OCRへ拡張する。

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
* LM Studio の OpenAI 互換 API を利用
* ローカルネットワーク上の LM Studio サーバーに接続
* LLM補正は無効化可能

## 入力

OCR結果テキスト

## 出力

自然な日本語文章

## LLMエンドポイント

LM Studio を以下のURLで利用する。

```text
http://192.168.10.37:1234
```

OpenAI互換APIとして、原則 `/v1/chat/completions` を呼び出す。

例:

```text
POST http://192.168.10.37:1234/v1/chat/completions
```

## 設定

`.env` で以下を指定する。

```env
LLM_ENABLED=true
LLM_PROVIDER=lmstudio
LLM_BASE_URL=http://192.168.10.37:1234/v1
LLM_MODEL=
LLM_TIMEOUT_MS=60000
```

`LLM_MODEL` は LM Studio 側でロードしているモデル名を指定する。未指定の場合は、LM Studio の既定モデル、または `/v1/models` で取得できる最初のモデルを利用する方針とする。

## 補正方針

* OCR結果の意味を変えない
* 旧字、表記揺れ、文体を過度に現代化しない
* 明らかなOCR誤認識のみ修正する
* ページをまたぐ文脈補正は将来拡張とする
* 失敗時は補正前テキストをそのまま後続処理へ渡せること

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
OCR_ENGINE=ndloocr-lite
OCR_PATH=
NDLOCR_LITE_PATH=
NDLOCR_LITE_COMMAND=ndlocr-lite
NDLOCR_LITE_PYTHON=
NDLOCR_LITE_SRC_DIR=
NDLOCR_LITE_JSON_ONLY=true
NDLOCR_LITE_ENABLE_TCY=false
IRODORI_TTS_URL=
LLM_ENABLED=true
LLM_PROVIDER=lmstudio
LLM_BASE_URL=http://192.168.10.37:1234/v1
LLM_MODEL=
LLM_TIMEOUT_MS=60000
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
* LLM補正失敗
* LM Studio 接続失敗
* Kindle未ログイン
* Cloud Readerロード失敗
* 空OCR結果

---

# ログ要求

## 必須

* ページ番号
* OCR時間
* LLM補正時間
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
* LLM補正は `http://192.168.10.37:1234` の LM Studio サーバーへの送信のみ許可
* OCRテキストを外部クラウドLLMへ送信しない
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

* NDLOCR-Lite
* 画像前処理
* OCR保存
* OCRエンジン切り替え設定
* `--sourceimg` によるページ単位OCR
* `--json-only` による構造化結果保存
* `--enable-tcy` による縦中横対応
* PaddleOCR は代替エンジンとして保持

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

LM Studio による AI補正

## 実装

* OCR補正
* LM Studio OpenAI互換API連携
* `/v1/models` によるモデル確認
* `/v1/chat/completions` による補正実行
* LLM補正の有効 無効切り替え
* sentence chunking
* 読みやすさ改善

---

# テスト要求

## 必須

* ページ送りテスト
* OCR精度テスト
* LM Studio 接続テスト
* LLM補正フォールバックテスト
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
* [NDLOCR-Lite](https://github.com/ndl-lab/ndlocr-lite)
* [PaddleOCR GitHub](https://github.com/PaddlePaddle/PaddleOCR?utm_source=chatgpt.com)
* [LM Studio](https://lmstudio.ai/)

```
::contentReference[oaicite:4]{index=4}
