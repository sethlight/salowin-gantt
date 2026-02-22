# SALOWIN ガントチャート

チームでプロジェクトのスケジュールを管理できる **Webベースのガントチャートツール** です。
ブラウザだけで使えるので、インストールは不要です。

## どんなことができるの？

### プロジェクト管理
- **プロジェクトの作成・編集・削除** - 複数のプロジェクトを一覧で管理
- **メンバー招待** - メールアドレスでチームメンバーを招待（権限：オーナー / 編集者 / 閲覧者）

### ガントチャート
- **タスクの追加・編集・削除** - タスク名、担当者、ステータス、進捗率を設定
- **ドラッグ＆ドロップでスケジュール変更** - バーを掴んで日程を移動
- **タスクの階層化** - インデント（字下げ）で親タスク・子タスクを表現
- **開始日・締切日の設定** - 日付入力またはバーの端をドラッグして期間を調整
- **締切アラート** - 締切が近い・過ぎたタスクを色付きで警告表示
- **今日のラインジャンプ** - ワンクリックで本日の日付へスクロール
- **元に戻す / やり直し** - 操作の取り消し・やり直しが可能

### ノート＆コメント
- **リッチテキストノート** - 各タスクに見出し・太字・リスト付きのノートを記録（左右2分割のモーダル）
- **コメント機能** - タスクごとにコメントを投稿し、チーム内でやり取り
- **コメントの解決・削除** - 完了したコメントにチェックを付けて整理

### Chatwork通知
- **コメント投稿時に自動通知** - Chatworkの指定ルームへ、タスク名・送信者・URLを含む通知メッセージを送信
- **プロジェクトごとに設定** - プロジェクトカードの設定アイコンからChatwork Room IDとAPIトークンを登録

### リアルタイム同期
- **複数人同時編集** - チームメンバーが同時にガントチャートを操作可能
- **オンライン状況の表示** - 誰がいま閲覧しているかリアルタイムで確認

### 認証
- **メール＆パスワード認証** - アカウント登録・ログイン
- **パスワードリセット** - メールでリセットリンクを送信し、新しいパスワードを設定

---

## 技術構成（エンジニア向け）

| 区分 | 技術 |
|------|------|
| フロントエンド | HTML / CSS / JavaScript（フレームワーク不使用） |
| エディタ | Quill.js（リッチテキストエディタ） |
| バックエンド | Supabase（PostgreSQL + Auth + Realtime + Edge Functions） |
| 通知連携 | Supabase Edge Functions（Deno）→ Chatwork API |
| ホスティング | Vercel（静的サイト） |
| 認証 | Supabase Auth（Email / Password） |
| セキュリティ | Row Level Security（RLS）によるデータアクセス制御 |

### フォルダ構成

```
gantt-app/
├── index.html              # ダッシュボード（ログイン・プロジェクト一覧）
├── gantt.html              # ガントチャート画面
├── auth-callback.html      # 認証コールバック（パスワードリセット処理）
├── vercel.json             # Vercelデプロイ設定
├── css/
│   ├── common.css          # 共通スタイル
│   ├── dashboard.css       # ダッシュボード用スタイル
│   └── gantt.css           # ガントチャート用スタイル
├── js/
│   ├── config.js           # Supabase接続設定
│   ├── auth.js             # 認証処理（ログイン・サインアップ・リセット）
│   ├── supabase-client.js  # Supabaseクライアント初期化
│   ├── db/
│   │   ├── projects.js     # プロジェクトCRUD
│   │   ├── tasks.js        # タスクCRUD
│   │   ├── notes.js        # ノートCRUD
│   │   ├── comments.js     # コメントCRUD
│   │   ├── members.js      # メンバー管理
│   │   └── settings.js     # プロジェクト設定（Chatwork連携）
│   ├── realtime/
│   │   ├── subscriptions.js    # リアルタイム購読
│   │   ├── conflict-resolver.js # 競合解決
│   │   └── presence.js         # オンラインプレゼンス
│   └── migration/
│       └── import-gas-data.js  # GASからの移行ツール
└── supabase/
    ├── migrations/
    │   └── 00001_initial_schema.sql  # DBスキーマ（テーブル・RLS定義）
    └── functions/
        └── chatwork-notify/
            └── index.ts              # Chatwork通知Edge Function
```

### データベーステーブル

| テーブル | 説明 |
|---------|------|
| `profiles` | ユーザー情報（auth.usersのミラー） |
| `projects` | プロジェクト |
| `project_members` | プロジェクトメンバーと権限（owner / editor / viewer） |
| `tasks` | ガントチャートのタスク（階層・日程・進捗） |
| `task_notes` | タスクに紐づくリッチテキストノート |
| `task_comments` | タスクに紐づくコメント |
| `project_settings` | プロジェクト設定（Chatwork連携情報） |

### セットアップ手順

1. **Supabase** でプロジェクトを作成し、`supabase/migrations/00001_initial_schema.sql` を実行
2. `js/config.js` にSupabaseのURL・anonキーを設定
3. Supabase Dashboard > Authentication > URL Configuration でサイトURLを設定
4. **Vercel** にデプロイ（`vercel --prod`）
5. Chatwork通知を使う場合は `supabase functions deploy chatwork-notify --no-verify-jwt` でEdge Functionをデプロイ

---

## 本番URL

https://gantt-app-nu.vercel.app
