# PageCaster

Kindle Cloud Reader を `playwright-cli` で操作し、表示中ページのスクリーンショットを保存するローカルCLIです。

## Setup

```bash
corepack pnpm install
```

`.env.example` を参考に `.env` を作成します。

```env
KINDLE_URL=https://read.amazon.co.jp/
HEADLESS=false
BROWSER_CHANNEL=
PLAYWRIGHT_CLI_COMMAND=playwright-cli
PLAYWRIGHT_CLI_SESSION=pagecaster
VIEWPORT_WIDTH=1600
VIEWPORT_HEIGHT=1200
CAPTURE_CLIP_X=160
CAPTURE_CLIP_Y=80
CAPTURE_CLIP_WIDTH=1280
CAPTURE_CLIP_HEIGHT=1040
PAGE_CHANGE_TIMEOUT_MS=10000
PAGE_CHANGE_POLL_MS=250
PAGE_TURN_KEY=ArrowLeft
```

日本語縦書きの右綴じ本では、多くの場合 `ArrowLeft` が次ページ方向です。環境や本によって逆なら `.env` で `PAGE_TURN_KEY=ArrowRight` に変更してください。

ローカルの Chrome / Edge を使いたい場合は、`.env` に次のどちらかを設定します。

```env
BROWSER_CHANNEL=chrome
```

```env
BROWSER_CHANNEL=msedge
```

## Commands

初回ログイン:

```bash
corepack pnpm kindle:login
```

ブラウザが開いたら手動でログインし、必要なら対象書籍を開いてからターミナルで Enter を押します。ログイン状態は `auth/storage-state.json` に保存されます。

`pnpm login` は pnpm / npm レジストリ用のログインコマンドとして解釈されることがあるため、Kindle用には使わないでください。

1ページ取得:

```bash
corepack pnpm capture --pages 1
```

既に `playwright-cli` の `pagecaster` セッションが開いている場合は、現在表示中のページをそのまま使います。ブラウザが本棚一覧を表示している場合は、対象書籍を開き、本文ページが表示されてから PowerShell 側で Enter を押します。

複数ページ取得:

```bash
corepack pnpm capture --pages 3
```

複数ページ取得でも同様に、最初の本文ページを表示してから Enter を押してください。

自動ページ送りがKindleに効かない場合は、手動ページ送りモードを使います。

```bash
corepack pnpm capture --pages 3 --turn-mode manual
```

この場合は各ページ間でブラウザ上のページを手動で送り、本文が表示されてから PowerShell 側で Enter を押してください。

既に対象ページを開いていて開始確認を省きたい場合:

```bash
corepack pnpm capture --pages 3 --no-confirm-start
```

デバッグ画像:

```bash
corepack pnpm capture:debug
```

## Browser Control

ブラウザ操作は Playwright Node API ではなく `playwright-cli` を呼び出します。

主に使うコマンド:

- `playwright-cli open`
- `playwright-cli goto`
- `playwright-cli state-save`
- `playwright-cli state-load`
- `playwright-cli screenshot`
- `playwright-cli press`

## Output

- `data/screenshots/<run-id>/page-000001.png`
- `data/capture-runs/<run-id>.json`

`auth/storage-state.json` にはログイン状態が含まれるため、共有しないでください。

## OCR

NDLOCR-Lite を事前にインストールします。

```powershell
uv tool install .
ndlocr-lite.exe --help
```

`.env`:

```env
OCR_ENGINE=ndloocr-lite
NDLOCR_LITE_COMMAND=ndlocr-lite.exe
NDLOCR_LITE_JSON_ONLY=true
NDLOCR_LITE_ENABLE_TCY=false
OCR_TIMEOUT_MS=120000
```

`--enable-tcy` は縦中横改善用ですが、NDLOCR-Liteのインストール状態によっては `tcy_wrapper` が見つからず失敗することがあります。まずは `false` でOCRを通し、必要になったら環境を整えて `true` にしてください。

capture run 全体をOCR:

```bash
corepack pnpm ocr --run-id 20260522-012612
```

1枚だけOCR:

```bash
corepack pnpm ocr --image data/screenshots/20260522-012612/page-000001.png
```

出力:

- `data/ocr/<run-id>/page-000001/`
- `data/ocr/<run-id>/ocr-run.json`

## Text Preparation

OCR結果をTTSへ渡しやすい本文チャンクに整形します。複数ページを文書ストリームとして連結し、改ページで文が途切れている場合は自然につないでから、文末・段落・読点・page break 周辺の境界候補を使ってchunk化します。LM Studio は任意の後処理としてchunkごとの安全な `anchor / target / to` 修正候補だけを返し、本文全文の自由生成は採用しません。

`.env`:

```env
LLM_ENABLED=true
LLM_PROVIDER=lmstudio
LLM_BASE_URL=http://192.168.10.37:1234/v1
LLM_MODEL=google/gemma-4-26b-a4b
LLM_TIMEOUT_MS=1200000
LLM_CORRECTION_MODE=anchor
LLM_MAX_TOKENS=10000
LLM_MAX_EDIT_RATIO=0.25
LLM_MAX_FIXES_PER_CHUNK=5
LLM_MAX_ANCHOR_CHARS=40
LLM_MAX_FIX_RATIO=0.25
LLM_DEBUG_SAVE_RESPONSES=true
TEXT_CHUNK_MAX_CHARS=240
TEXT_CHUNK_MIN_CHARS=40
TEXT_SPLIT_MODE=local
TEXT_ENABLE_LLM_BOUNDARY=false
TEXT_PAGE_BREAK_JOIN=true
```

LM Studio は OpenAI互換APIを有効にし、`http://192.168.10.37:1234` でアクセスできる状態にします。`LLM_MODEL` は LM Studio にロード済みのモデルIDを指定してください。reasoning-heavy なモデルは `content` に到達する前に時間がかかることがあるため、実データ検証では `LLM_MODEL` を明示して挙動を確認します。`LLM_TIMEOUT_MS=1200000` で1chunkあたり最大20分待つため、遅い呼び出しは `text-run.json` の `llmCalls[].elapsedMs` で確認できます。通信失敗時は `transportError` に fetch例外とcauseを保存します。`LLM_DEBUG_SAVE_RESPONSES=true` の場合、chunkごとのrequest/response、`content`、`reasoning_content` を `data/text/<run-id>/debug/llm/` に保存します。`LLM_ENABLED=false` の場合はLM Studioへ接続せず、ローカル整形済みchunkをそのまま保存します。

LM Studioの接続確認:

```powershell
Invoke-RestMethod http://192.168.10.37:1234/v1/models
```

OCR run 全体をTTS向けテキストに整形:

```bash
corepack pnpm prepare-text --ocr-run-id 20260522-012612
```

ページを絞る場合:

```bash
corepack pnpm prepare-text --ocr-run-id 20260522-012612 --pages 1-2
```

目次ページをTTS対象から除外する場合:

```bash
corepack pnpm prepare-text --ocr-run-id 20260522-012612 --pages 2-4 --exclude-toc
```

除外されたページは `text-run.json` の `pages[].skipReason` に `TOC` と記録され、`chunks.json` には含まれません。

1ページ分のOCR JSONだけを整形:

```bash
corepack pnpm prepare-text --ocr-json data/ocr/20260522-012612/page-000001/page-000001.json
```

LM Studioを使わずローカル整形だけで確認:

```powershell
$env:LLM_ENABLED="false"; corepack pnpm prepare-text --ocr-run-id 20260522-012612
```

出力:

- `data/text/<run-id>/text-run.json`
- `data/text/<run-id>/chunks.json`
- `data/text/<run-id>/page-000001.raw.txt`
- `data/text/<run-id>/page-000001.normalized.txt`
- `data/text/<run-id>/page-000001.corrected.txt`

`chunks.json` example:

```json
[
  {
    "id": "p000001-c001",
    "pageIndex": 1,
    "order": 1,
    "text": "TTSへ渡す最終chunk本文。",
    "charLength": 14,
    "sourcePageIndexes": [1],
    "boundaryEndId": "b0001",
    "splitReason": "local",
    "correction": {
      "usedLlm": true,
      "acceptedEditCount": 1,
      "rejectedEditCount": 0
    }
  }
]
```
