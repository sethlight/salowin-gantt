import { sb } from '../supabase-client.js';

export async function getSettings(projectId) {
  const { data, error } = await sb
    .from('project_settings')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateSettings(projectId, fields) {
  const { data, error } = await sb
    .from('project_settings')
    .update(fields)
    .eq('project_id', projectId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
