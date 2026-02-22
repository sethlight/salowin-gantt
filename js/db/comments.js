import { sb } from '../supabase-client.js';
import { getCurrentUser, getUserEmail } from '../auth.js';

export async function loadComments(projectId, rowId) {
  const { data, error } = await sb
    .from('comments')
    .select('*')
    .eq('project_id', projectId)
    .eq('row_id', rowId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function loadAllCommentCounts(projectId) {
  const { data, error } = await sb
    .from('comments')
    .select('row_id, cleared')
    .eq('project_id', projectId);
  if (error) throw error;

  // row_idごとに未クリアコメント数を集計
  const counts = {};
  data.forEach(c => {
    if (!counts[c.row_id]) counts[c.row_id] = 0;
    if (!c.cleared) counts[c.row_id]++;
  });
  return counts;
}

export async function addComment(projectId, rowId, body) {
  const user = getCurrentUser();
  const { data, error } = await sb
    .from('comments')
    .insert({
      project_id: projectId,
      row_id: rowId,
      author_id: user.id,
      author_email: getUserEmail(),
      body,
      cleared: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleCommentCleared(commentId, cleared) {
  const { data, error } = await sb
    .from('comments')
    .update({ cleared })
    .eq('id', commentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteComment(commentId) {
  const { error } = await sb
    .from('comments')
    .delete()
    .eq('id', commentId);
  if (error) throw error;
}
