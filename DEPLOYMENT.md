# phox-ui デプロイガイド

## 環境変数の設定

phox-uiはランタイムで環境変数を読み込みます。ビルド時には環境変数は不要です。

### Cloud Runへのデプロイ

1. **Artifact Registryからイメージをデプロイ**

```bash
gcloud run deploy phox-ui \
  --image=asia-northeast1-docker.pkg.dev/phoxtrot/phox/phox-ui:latest \
  --platform=managed \
  --region=asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBWyxZZKniOBuzdbbiQ-2bTsU4CT5vKhh8,\
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=phoxtrot.firebaseapp.com,\
NEXT_PUBLIC_FIREBASE_PROJECT_ID=phoxtrot,\
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=phoxtrot.firebasestorage.app,\
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=86126970097,\
NEXT_PUBLIC_FIREBASE_APP_ID=1:86126970097:web:3894998b10cf65260ad550,\
NEXT_PUBLIC_BACKEND_URL=https://phox-customer-86126970097.asia-northeast1.run.app"
```

2. **環境変数ファイルを使用する場合**

`env.yaml`ファイルを作成：

```yaml
NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyBWyxZZKniOBuzdbbiQ-2bTsU4CT5vKhh8"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "phoxtrot.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID: "phoxtrot"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "phoxtrot.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "86126970097"
NEXT_PUBLIC_FIREBASE_APP_ID: "1:86126970097:web:3894998b10cf65260ad550"
NEXT_PUBLIC_BACKEND_URL: "https://phox-customer-86126970097.asia-northeast1.run.app"
```

デプロイコマンド：

```bash
gcloud run deploy phox-ui \
  --image=asia-northeast1-docker.pkg.dev/phoxtrot/phox/phox-ui:latest \
  --platform=managed \
  --region=asia-northeast1 \
  --allow-unauthenticated \
  --env-vars-file=env.yaml
```

### ローカルDockerでの実行

```bash
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyBWyxZZKniOBuzdbbiQ-2bTsU4CT5vKhh8" \
  -e NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="phoxtrot.firebaseapp.com" \
  -e NEXT_PUBLIC_FIREBASE_PROJECT_ID="phoxtrot" \
  -e NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="phoxtrot.firebasestorage.app" \
  -e NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="86126970097" \
  -e NEXT_PUBLIC_FIREBASE_APP_ID="1:86126970097:web:3894998b10cf65260ad550" \
  -e NEXT_PUBLIC_BACKEND_URL="https://phox-customer-86126970097.asia-northeast1.run.app" \
  asia-northeast1-docker.pkg.dev/phoxtrot/phox/phox-ui:latest
```

## セキュリティについて

- Firebase APIキーなどは公開情報であり、クライアント側で使用されるため、環境変数として設定しても問題ありません
- Firebase Consoleでドメイン制限を設定することで、不正な利用を防ぐことができます
- 機密情報（サービスアカウントキーなど）は含まれていません

## GitHub Actions

mainブランチにpushすると、自動的にDockerイメージがビルドされ、Artifact Registryに保存されます。
ビルド時には環境変数は不要です。

必要なGitHub Secrets:
- `GCP_SA_KEY`: Google Cloudサービスアカウントのキー（Artifact Registry書き込み権限）
