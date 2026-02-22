import { sb } from '../supabase-client.js';
import { getCurrentUser } from '../auth.js';

export async function listProjects() {
  const { data, error } = await sb
    .from('projects')
    .select(`
      *,
      project_members!inner(role)
    `)
    .order('updated_at', { ascending: false });
  if (error) throw error;

  return data.map(p => ({
    ...p,
    myRole: p.project_members?.[0]?.role || 'viewer',
  }));
}

export async function createProject(name, description = '') {
  const { data, error } = await sb.rpc('create_project', {
    p_name: name,
    p_description: description,
  });
  if (error) throw error;
  return data;
}

export async function updateProject(projectId, fields) {
  const { data, error } = await sb
    .from('projects')
    .update(fields)
    .eq('id', projectId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProject(projectId) {
  const { error } = await sb
    .from('projects')
    .delete()
    .eq('id', projectId);
  if (error) throw error;
}
