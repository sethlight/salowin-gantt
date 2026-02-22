import { sb } from './supabase-client.js';

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

export function getUserEmail() {
  return currentUser?.email || 'Guest';
}

export function getUserDisplayName() {
  return currentUser?.user_metadata?.display_name || currentUser?.email || 'Guest';
}

// メール+パスワードでサインアップ
export async function signUp(email, password, displayName = '') {
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || email },
    },
  });
  if (error) throw error;
  return data;
}

// メール+パスワードでログイン
export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  currentUser = data.user;
  return data;
}

// パスワードリセットメール送信
export async function resetPassword(email) {
  const { data, error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth-callback`,
  });
  if (error) throw error;
  return data;
}

// パスワード更新（リセットリンクからのコールバック後）
export async function updatePassword(newPassword) {
  const { data, error } = await sb.auth.updateUser({
    password: newPassword,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await sb.auth.signOut();
  currentUser = null;
  window.location.href = '/';
}

export async function initAuth() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      currentUser = session?.user ?? null;
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
    }
  });

  return currentUser;
}

// 未認証時にログインページへリダイレクト
export async function requireAuth() {
  const user = await initAuth();
  if (!user) {
    sessionStorage.setItem('redirectAfterLogin', window.location.href);
    window.location.href = '/';
    return null;
  }
  return user;
}
