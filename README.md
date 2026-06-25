# VALO-TROLL SCOREBOARD 🎮

VALORANTの身内ゲーム「トロール人狼」を5人で10回戦行い、スコアを競い合うためのスコア管理Webアプリケーションです。
VALORANTをモチーフにしたスタイリッシュなサイバー・ダーク風のUIデザインを採用し、レスポンシブ（スマホ・PC）に対応しています。

## 🚀 主な機能

- **プレイヤー登録 (5人固定)**: プレイヤー名の初期値は不要で、プレースホルダーのみのシンプルな登録。
- **リアルタイムランキング**: 合計ポイントに応じてプレイヤーの順位が自動ソートされます（1位にはゴールド王冠👑などの装飾）。
- **ラウンド進行・ポイント自動計算**:
  - 各ラウンドで「本当のトロールは誰か」「勝利チームはどちらか」「各プレイヤーのトロール投票先」を入力。
  - 勝利判定や市民のトロール的中（見破り）によるボーナス得点（+1点）をシステムが自動で計算。
- **ゲーム履歴ログ（アコーディオン）**: 過去のラウンド情報（役職、投票先、獲得ポイント）をアコーディオン形式でスタイリッシュに確認可能。
- **LocalStorageによる自動保存 (72時間TTL)**: リロード対策はもちろん、最後の保存から3日（72時間）経過したデータは自動消去されます。
- **URLでのデータ共有と編集引き継ぎ**:
  - 現在のゲームデータをBase64でエンコードしてクエリパラメータ（`?room=...`）として共有URLをコピーできます。
  - 共有URLから開いた場合は「閲覧モード」になり、「このデータをもとに編集を引き継ぐ」ボタンをクリックすることで、その状態からゲームを続行できます。
- **データ一括破棄**: 誤操作防止の確認アラート付きで、ワンクリックで全ゲームデータを初期化できます。

---

## 🛠️ 技術スタック

- **フレームワーク**: Next.js (App Router)
- **言語**: TypeScript
- **スタイリング**: Tailwind CSS (v4)
- **デプロイ**: GitHub Pages (Static Export) 前提

---

## 💻 開発・起動手順

### 1. 依存関係のインストール
プロジェクトのルートディレクトリで以下を実行します。

```bash
npm install
```

### 2. ローカル開発サーバーの起動
ローカルでアプリケーションを起動します。

```bash
npm run dev
```
起動後、ブラウザで [http://localhost:3000](http://localhost:3000) にアクセスします。

---

## 📦 デプロイ方法 (GitHub Pages / Static Export)

本プロジェクトはサーバー側の処理（APIやDB）を持たないため、静的HTMLファイルとしてビルドし、GitHub Pagesなどの静的ホスティングサービスにデプロイできます。

### 1. サブパスの設定
GitHub Pagesでリポジトリ名がサブパスになる場合（例: `https://<username>.github.io/<repository-name>/`）、`next.config.ts` の `basePath` を合わせる必要があります。

デフォルトではリポジトリ名が `for-valorant-troll-werewolf-games` であることを前提に設定されています。
もしリポジトリ名が異なる場合は、ビルド時に環境変数 `NEXT_PUBLIC_BASE_PATH` を指定してください。

```bash
# 例: リポジトリ名が "my-troll-game" の場合
NEXT_PUBLIC_BASE_PATH="/my-troll-game" npm run build
```

### 2. 静的エクスポートの実行
ビルドを実行すると、プロジェクトルートに `out` ディレクトリが生成され、その中に静的なHTML/CSS/JSファイルが出力されます。

```bash
npm run build
```

### 3. デプロイ

#### 方法A: GitHub Actionsによる自動デプロイ（推奨）
GitHubにプッシュするだけで自動的にビルドおよびデプロイが行われるように設定します。

`.github/workflows/deploy.yml` に以下の内容を作成して配置してください。

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main # または master

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Pages
        uses: actions/configure-pages@v4

      - name: Install dependencies
        run: npm ci

      - name: Build with Next.js
        run: npm run build
        env:
          # リポジトリ名に応じたサブパスを指定 (自動設定されます)
          NEXT_PUBLIC_BASE_PATH: "/${{ github.event.repository.name }}"

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./out

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

#### 方法B: 手動デプロイ (`gh-pages` パッケージを使用)
1. `gh-pages` パッケージを開発用依存関係としてインストールします。
   ```bash
   npm install -D gh-pages
   ```
2. `package.json` の `scripts` にデプロイ用のコマンドを追加します。
   ```json
   "scripts": {
     "dev": "next dev",
     "build": "next build",
     "start": "next start",
     "lint": "eslint",
     "deploy": "gh-pages -d out"
   }
   ```
3. ビルドしてデプロイを実行します。
   ```bash
   npm run build
   npm run deploy
   ```
   これで GitHub 上の `gh-pages` ブランチにビルド結果がプッシュされ、公開されます。
