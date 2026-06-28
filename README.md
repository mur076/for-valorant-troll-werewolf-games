# VALO-TROLL SCOREBOARD 🎮

VALORANTの身内ゲーム「トロール人狼」を5人で行い、スコアを競い合うためのスコア管理Webアプリケーションです。
VALORANTをモチーフにしたスタイリッシュなサイバー・ダーク風のUIデザインを採用し、レスポンシブ（スマホ・PC）に対応しています。

身内戦や飲み会での景品争奪戦などで最高に盛り上がれるよう、各種の特別な得点ルールや評価オプションを搭載しています。

---

## 🚀 主な機能

*   **プレイヤー登録 (5人固定)**: プレイヤー名のほかに、最初のマウント時に初期エージェントを直接選択可能。
*   **ゲームルール ＆ アドバンスド配点カスタマイズ**:
    *   対戦回数の変更に加え、各勝利ポイント、トロール見破りポイントを自由にスピンボタンで増減可能。
    *   **デフォルト設定値は、7ラウンドプレイ時に最適な「市民有利バランス」** に調整されています。
*   **身内戦を盛り上げる新スコアリングロジック**:
    *   **満場一致ペナルティ**: トロールが市民4人全員に特定されて負けた場合、トロール側のポイントが大きく減点されます。
    *   **市民完全勝利 ＆ トロール的中ペナルティ**: 試合に勝利し、かつトロールの特定にも成功した際、市民全員にボーナス点、トロールに追加ペナルティが入ります。
    *   **トロール完全勝利 / 完全隠蔽大ボーナス**: 市民がトロールを見失って敗北した際、市民全員にペナルティ、トロールに大きな加点が入ります。さらにトロールへの投票が `0` 票だった場合は「完全隠蔽」として大ボーナスを獲得できます。
*   **トロール特別プレイ評価（戦犯 / 芸術的トグル）**:
    *   ラウンド結果確定時に、トロールの立ち回りについて `[⚠️ バレバレ戦犯]` (減点) や `[✨ 芸術的（神プレイ）]` (加点) のオプション評価を簡単に付与できます。
*   **リアルタイムランキング (LEADERBOARD)**:
    *   合計ポイントに応じてプレイヤーの順位が自動ソートされます。
    *   1位には高輝度アウトラインとゴールドグロー付きの王冠バッジ👑、2位には視認性の高い白銀バッジを付与。
*   **動的配点リスト付きルールブックUI (開閉式)**:
    *   ページ下部（対戦履歴の直下）に「ルールブックを表示」ボタンを新設。
    *   ゲームの遊び方に加え、設定画面でカスタマイズした各配点ポイントが**リアルタイムでテキストに自動反映される配点リスト**を搭載。
*   **対戦履歴ログ（アコーディオン）**:
    *   過去のラウンド情報（役職、使用エージェント、投票先、獲得ポイント）をアコーディオン形式でスタイリッシュに確認可能。
    *   アコーディオンを閉じた状態では「そのラウンド（回）単体での最下位」、開いた詳細パネル内では「その時点での累計最下位」が切り分けて算出されます。
*   **LocalStorageによる自動保存 (72時間TTL)**:
    *   リロード対策はもちろん、最後の保存から3日（72時間）経過したデータは自動消去されます。
*   **URLでのデータ共有と編集引き継ぎ**:
    *   現在のゲームデータをBase64でエンコードしてクエリパラメータ（`?room=...`）として共有URLをコピーできます。
    *   共有URLから開いた場合は「閲覧モード」になり、「このデータをもとに編集を引き継ぐ」ボタンをクリックすることで、その状態からゲームを続行（編集）できます。
*   **データ一括破棄**: 誤操作防止の確認アラート付きで、ワンクリックで全ゲームデータを初期化できます。

---

## 🛠️ 技術スタック

*   **フレームワーク**: Next.js (App Router)
*   **言語**: TypeScript
*   **スタイリング**: Tailwind CSS (v4)
*   **レスポンシブ設計**: CSS Grid と padding-bottom アスペクト比ハック（`pb-[100%]` ハック）を組み合わせ、ウィンドウサイズ変更時にもグリッド画像が潰れ・オーバーラップを起こさない頑健なレイアウト。
*   **デプロイ**: GitHub Pages (Static Export) 前提

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
