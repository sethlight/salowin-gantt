# SALOWIN ガントチャート - Supabase セットアップ手順

## 1. Supabaseプロジェクト作成

1. https://supabase.com/dashboard にアクセス
2. 「New Project」でプロジェクトを作成
3. リージョン: `Northeast Asia (Tokyo)` 推奨
4. 作成完了後、以下をメモ:
   - **Project URL**: `https://xxxx.supabase.co`
   - **anon public key**: Settings > API > Project API keys
   - **service_role key**: Settings > API > Project API keys (Edge Function用)

## 2. SQLスキーマ実行

1. Supabase Dashboard > SQL Editor を開く
2. `supabase/migrations/00001_initial_schema.sql` の内容をコピー&ペースト
3. 「Run」で実行

## 3. Realtime有効化

1. Dashboard > Database > Replication を開く
2. 以下のテーブルのRealtimeを有効化:
   - `tasks`
   - `notes`
   - `comments`
   - `project_members`

## 4. Google OAuth設定

### Google Cloud Console側
1. https://console.cloud.google.com にアクセス
2. APIs & Services > Credentials > Create Credentials > OAuth 2.0 Client ID
3. Application type: Web application
4. Authorized JavaScript origins:
   - `https://あなたのドメイン.com`（本番）
   - `http://localhost:3000`（開発）
5. Authorized redirect URIs:
   - `https://xxxx.supabase.co/auth/v1/callback`
6. Client ID と Client Secret をコピー

### Supabase側
1. Dashboard > Authentication > Providers > Google
2. Google providerを有効化
3. Client ID と Client Secret を設定
4. Authentication > URL Configuration > Redirect URLs に以下を追加:
   - `https://あなたのドメイン.com/auth-callback.html`
   - `http://localhost:3000/auth-callback.html`（開発）

## 5. config.js の設定

`js/config.js` を開き、以下を設定:

```javascript
export const SUPABASE_URL = 'https://xxxx.supabase.co';      // Step 1でメモしたURL
export const SUPABASE_ANON_KEY = 'eyJ...your-anon-key...';   // Step 1でメモしたanon key
```

## 6. Chatwork Edge Function デプロイ（任意）

```bash
# Supabase CLIインストール
npm install -g supabase

# プロジェクトリンク
cd gantt-app
supabase link --project-ref xxxx

# Edge Functionデプロイ
supabase functions deploy chatwork-notify

# シークレット設定
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Chatworkを使用する場合、各プロジェクトの設定でRoom IDとAPI Tokenを設定してください。

## 7. ホスティング

### 方法A: ローカルサーバー（開発用）
```bash
# Node.jsの場合
npx serve gantt-app -l 3000

# Pythonの場合
cd gantt-app && python -m http.server 3000
```

### 方法B: Vercel/Netlify（本番用）
`gantt-app` フォルダをそのままデプロイ。ビルド不要。

### 方法C: Supabase Storage
Dashboard > Storage でバケットを作成し、全ファイルをアップロード。

## 8. 既存データの移行（GASからの移行）

1. GASのスプレッドシートからJSON blobをコピー
2. ログイン後、新規プロジェクトを作成
3. ブラウザのコンソールで以下を実行:
```javascript
const mod = await import('./js/migration/import-gas-data.js');
await mod.importGasData('プロジェクトUUID', 'コピーしたJSON文字列');
```

## セキュリティ構成

| 項目 | 対策 |
|------|------|
| 認証 | Google OAuth (Supabase Auth) |
| 認可 | Row Level Security (RLS) - 全7テーブル |
| ロール | owner / editor / viewer |
| APIキー | anon key (公開可) + service role key (サーバーのみ) |
| リアルタイム | RLSポリシー通過後のみ受信可能 |
| Chatworkトークン | Edge Function内でのみ使用 (クライアント非露出) |
