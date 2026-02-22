import { sb } from '../supabase-client.js';
import { getCurrentUser } from '../auth.js';

export async function loadNotes(projectId) {
  const { data, error } = await sb
    .from('notes')
    .select('*')
    .eq('project_id', projectId);
  if (error) throw error;
  return data;
}

export async function getNote(projectId, rowId) {
  const { data, error } = await sb
    .from('notes')
    .select('*')
    .eq('project_id', projectId)
    .eq('row_id', rowId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertNote(projectId, rowId, title, content) {
  const user = getCurrentUser();
  const { data, error } = await sb
    .from('notes')
    .upsert(
      {
        project_id: projectId,
        row_id: rowId,
        title,
        content,
        updated_by: user.id,
      },
      { onConflict: 'project_id,row_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteNote(projectId, rowId) {
  const { error } = await sb
    .from('notes')
    .delete()
    .eq('project_id', projectId)
    .eq('row_id', rowId);
  if (error) throw error;
}
