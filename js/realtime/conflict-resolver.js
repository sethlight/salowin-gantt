import { getCurrentUser } from '../auth.js';

// 編集中フィールドの追跡
const pendingEdits = new Map();

export function markPendingEdit(rowId, field) {
  if (!pendingEdits.has(rowId)) pendingEdits.set(rowId, new Set());
  pendingEdits.get(rowId).add(field);
}

export function clearPendingEdit(rowId, field) {
  const fields = pendingEdits.get(rowId);
  if (fields) {
    fields.delete(field);
    if (fields.size === 0) pendingEdits.delete(rowId);
  }
}

export function clearAllPendingEdits(rowId) {
  pendingEdits.delete(rowId);
}

// 自分の変更かどうか判定
function isOwnChange(payload) {
  const user = getCurrentUser();
  if (!user) return false;
  const newRow = payload.new;
  return newRow?.updated_by === user.id;
}

export function handleRemoteTaskChange(payload, localTasks, renderCallback) {
  // 自分の変更はスキップ（ローカルで既に反映済み）
  if (isOwnChange(payload)) return;

  const { eventType } = payload;
  const newRow = payload.new;
  const oldRow = payload.old;

  switch (eventType) {
    case 'INSERT': {
      const exists = localTasks.find(t => t.id === newRow.id);
      if (!exists) {
        localTasks.push(newRow);
        localTasks.sort((a, b) => a.sort_order - b.sort_order);
        renderCallback('insert', newRow);
      }
      break;
    }
    case 'UPDATE': {
      const idx = localTasks.findIndex(t => t.id === newRow.id);
      if (idx === -1) break;

      const rowId = newRow.row_id;
      if (pendingEdits.has(rowId)) {
        // 編集中のフィールドは保護
        const editingFields = pendingEdits.get(rowId);
        for (const [key, value] of Object.entries(newRow)) {
          if (!editingFields.has(key)) {
            localTasks[idx][key] = value;
          }
        }
      } else {
        localTasks[idx] = { ...localTasks[idx], ...newRow };
      }
      localTasks.sort((a, b) => a.sort_order - b.sort_order);
      renderCallback('update', newRow);
      break;
    }
    case 'DELETE': {
      const delId = oldRow?.id || newRow?.id;
      const delIdx = localTasks.findIndex(t => t.id === delId);
      if (delIdx !== -1) {
        localTasks.splice(delIdx, 1);
        renderCallback('delete', oldRow || newRow);
      }
      break;
    }
  }
}

export function handleRemoteNoteChange(payload, notesCache, renderCallback) {
  if (isOwnChange(payload)) return;
  const { eventType } = payload;
  const newRow = payload.new;
  const oldRow = payload.old;

  switch (eventType) {
    case 'INSERT':
    case 'UPDATE':
      notesCache[newRow.row_id] = newRow;
      renderCallback('upsert', newRow);
      break;
    case 'DELETE':
      delete notesCache[(oldRow || newRow).row_id];
      renderCallback('delete', oldRow || newRow);
      break;
  }
}

export function handleRemoteCommentChange(payload, renderCallback) {
  const { eventType } = payload;
  renderCallback(eventType, payload.new || payload.old);
}
