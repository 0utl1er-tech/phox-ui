import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";

// Firebase設定を取得（ビルド時ではなくランタイムで評価）
function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

// Firebase初期化（クライアントサイドでのみ実行）
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

function initializeFirebase() {
  if (typeof window === 'undefined') {
    // サーバーサイドでは何もしない
    return { app: null, auth: null };
  }

  if (!firebaseApp) {
    const config = getFirebaseConfig();
    firebaseApp = !getApps().length ? initializeApp(config) : getApp();
    firebaseAuth = getAuth(firebaseApp);
  }

  return { app: firebaseApp, auth: firebaseAuth };
}

// 初期化関数をエクスポート
const { app, auth } = initializeFirebase();

export { app, auth };
