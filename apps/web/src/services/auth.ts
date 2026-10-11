import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';

/**
 * Аутентификация дашборда через Supabase Auth (email/пароль).
 *
 * RLS в схеме разрешает доступ только роли `authenticated`, поэтому без входа
 * данные из БД не загрузятся. Здесь — мини-обёртка над supabase.auth.
 */

export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signUp({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getSupabase().auth.signOut();
}

/** Подписка на изменение сессии. Возвращает функцию отписки. */
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  if (!isSupabaseConfigured()) return () => {};
  const { data } = getSupabase().auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
