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
