/**
 * GASからエクスポートしたJSONデータをSupabaseにインポートするスクリプト
 *
 * 使い方:
 * 1. GASのスプレッドシートから現在のJSONデータをコピー
 * 2. ブラウザのコンソールで以下を実行:
 *    import('./js/migration/import-gas-data.js').then(m => m.importGasData('PROJECT_UUID', 'コピーしたJSON'));
 *
 * または、このファイル内のimportFromTextarea()を使用するインポートページを作成
 */

import { sb } from '../supabase-client.js';
import { getCurrentUser, getUserEmail } from '../auth.js';

export async function importGasData(projectId, gasJsonString) {
  const data = JSON.parse(gasJsonString);
  const tasks = data.tasks || [];
  const notesDB = data.notes || {};
  const user = getCurrentUser();

  console.log(`Importing ${tasks.length} tasks...`);

  // 1. タスクをインポート
  const taskRows = tasks.map((task, index) => ({
    project_id: projectId,
    row_id: task.rowId,
    sort_order: index,
    level: task.level || 0,
    collapsed: (task.collapsed === 'true' || task.collapsed === true),
    text: task.text || '',
    status: task.status || '未着手',
    progress: task.progress || 0,
    manager: task.manager || '',
    ball: task.ball || '',
    start_date: task.startDate || '',
    end_date: task.endDate || '',
    updated_by: user.id,
  }));

  if (taskRows.length > 0) {
    const { error: taskError } = await sb.from('tasks').insert(taskRows);
    if (taskError) {
      console.error('Task import failed:', taskError);
      throw taskError;
    }
    console.log(`${taskRows.length} tasks imported successfully.`);
  }

  // 2. ノートをインポート
  let noteCount = 0;
  for (const [rowId, noteData] of Object.entries(notesDB)) {
    if (noteData.title || noteData.content) {
      const { error } = await sb.from('notes').insert({
        project_id: projectId,
        row_id: rowId,
        title: noteData.title || '',
        content: noteData.content || '',
        updated_by: user.id,
      });
      if (error) console.warn(`Note import for ${rowId} failed:`, error);
      else noteCount++;
    }

    // 3. コメントをインポート
    if (noteData.comments && noteData.comments.length > 0) {
      const commentRows = noteData.comments.map(c => ({
        project_id: projectId,
        row_id: rowId,
        author_id: user.id,
        author_email: c.userEmail || getUserEmail(),
        body: c.text || '',
        cleared: c.cleared || false,
        created_at: c.time ? new Date(c.time).toISOString() : new Date().toISOString(),
      }));
      const { error } = await sb.from('comments').insert(commentRows);
      if (error) console.warn(`Comments import for ${rowId} failed:`, error);
    }
  }

  console.log(`${noteCount} notes imported successfully.`);
  console.log('Migration complete!');
  return { tasks: taskRows.length, notes: noteCount };
}
