import { sb } from '../supabase-client.js';
import { getCurrentUser } from '../auth.js';

// デバウンスタイマー
const debounceTimers = new Map();

export async function loadTasks(projectId) {
  const { data, error } = await sb
    .from('tasks')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertTask(projectId, taskData) {
  const user = getCurrentUser();
  const { data, error } = await sb
    .from('tasks')
    .insert({
      project_id: projectId,
      row_id: taskData.row_id,
      sort_order: taskData.sort_order,
      level: taskData.level || 0,
      collapsed: taskData.collapsed || false,
      text: taskData.text || '',
      status: taskData.status || '未着手',
      progress: taskData.progress || 0,
      manager: taskData.manager || '',
      ball: taskData.ball || '',
      start_date: taskData.start_date || '',
      end_date: taskData.end_date || '',
      updated_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export function updateTaskDebounced(taskId, fields, delayMs = 300) {
  const key = taskId;
  if (debounceTimers.has(key)) {
    clearTimeout(debounceTimers.get(key));
  }
  return new Promise((resolve, reject) => {
    debounceTimers.set(key, setTimeout(async () => {
      debounceTimers.delete(key);
      try {
        const result = await updateTaskImmediate(taskId, fields);
        resolve(result);
      } catch (e) {
        reject(e);
      }
    }, delayMs));
  });
}

export async function updateTaskImmediate(taskId, fields) {
  const user = getCurrentUser();
  const { data, error } = await sb
    .from('tasks')
    .update({ ...fields, updated_by: user.id })
    .eq('id', taskId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTask(taskId) {
  const { error } = await sb
    .from('tasks')
    .delete()
    .eq('id', taskId);
  if (error) throw error;
}

export async function deleteTasks(taskIds) {
  const { error } = await sb
    .from('tasks')
    .delete()
    .in('id', taskIds);
  if (error) throw error;
}

export async function reorderTasks(projectId, taskIds) {
  const { error } = await sb.rpc('reorder_tasks', {
    p_project_id: projectId,
    p_task_ids: taskIds,
  });
  if (error) throw error;
}

// 全タスクを一括保存 (初回インポート・フルセーブ用)
export async function syncAllTasks(projectId, localTasks) {
  const { data: remoteTasks, error: loadErr } = await sb
    .from('tasks')
    .select('*')
    .eq('project_id', projectId);
  if (loadErr) throw loadErr;

  const remoteMap = new Map(remoteTasks.map(t => [t.row_id, t]));
  const localRowIds = new Set();
  const user = getCurrentUser();

  const toInsert = [];
  const toUpdate = [];

  localTasks.forEach((task, index) => {
    localRowIds.add(task.row_id);
    const remote = remoteMap.get(task.row_id);
    const dbRow = {
      project_id: projectId,
      row_id: task.row_id,
      sort_order: index,
      level: task.level || 0,
      collapsed: task.collapsed || false,
      text: task.text || '',
      status: task.status || '未着手',
      progress: task.progress || 0,
      manager: task.manager || '',
      ball: task.ball || '',
      start_date: task.start_date || '',
      end_date: task.end_date || '',
      updated_by: user.id,
    };
    if (!remote) {
      toInsert.push(dbRow);
    } else {
      toUpdate.push({ id: remote.id, ...dbRow });
    }
  });

  const toDelete = remoteTasks
    .filter(rt => !localRowIds.has(rt.row_id))
    .map(rt => rt.id);

  if (toInsert.length) {
    const { error } = await sb.from('tasks').insert(toInsert);
    if (error) throw error;
  }
  for (const row of toUpdate) {
    const { id, ...fields } = row;
    const { error } = await sb.from('tasks').update(fields).eq('id', id);
    if (error) throw error;
  }
  if (toDelete.length) {
    const { error } = await sb.from('tasks').delete().in('id', toDelete);
    if (error) throw error;
  }
}
