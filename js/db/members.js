import { sb } from '../supabase-client.js';

export async function listMembers(projectId) {
  const { data, error } = await sb
    .from('project_members')
    .select(`
      *,
      profiles:user_id(email, display_name, avatar_url)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addMemberByEmail(projectId, email, role = 'editor') {
  // メールアドレスからユーザーを検索
  const { data: users, error: findErr } = await sb.rpc('find_user_by_email', {
    p_email: email,
  });
  if (findErr) throw findErr;
  if (!users || users.length === 0) {
    throw new Error('このメールアドレスのユーザーが見つかりません。先にアカウント登録してもらってください。');
  }

  const userId = users[0].id;
  const { data, error } = await sb
    .from('project_members')
    .insert({ project_id: projectId, user_id: userId, role })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('このユーザーは既にメンバーです。');
    throw error;
  }
  return data;
}

export async function updateMemberRole(memberId, role) {
  const { data, error } = await sb
    .from('project_members')
    .update({ role })
    .eq('id', memberId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeMember(memberId) {
  const { error } = await sb
    .from('project_members')
    .delete()
    .eq('id', memberId);
  if (error) throw error;
}
