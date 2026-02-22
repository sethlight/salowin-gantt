import { sb } from '../supabase-client.js';
import { getCurrentUser } from '../auth.js';

let activeChannels = [];

export function subscribeToProject(projectId, handlers) {
  unsubscribeAll();

  const tasksChannel = sb
    .channel(`tasks:${projectId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tasks', filter: `project_id=eq.${projectId}` },
      (payload) => handlers.onTaskChange(payload)
    )
    .subscribe();

  const notesChannel = sb
    .channel(`notes:${projectId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notes', filter: `project_id=eq.${projectId}` },
      (payload) => handlers.onNoteChange(payload)
    )
    .subscribe();

  const commentsChannel = sb
    .channel(`comments:${projectId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'comments', filter: `project_id=eq.${projectId}` },
      (payload) => handlers.onCommentChange(payload)
    )
    .subscribe();

  const presenceChannel = sb
    .channel(`presence:${projectId}`)
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      handlers.onPresenceSync(state);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const user = getCurrentUser();
        if (user) {
          await presenceChannel.track({
            user_id: user.id,
            email: user.email,
            display_name: user.user_metadata?.full_name || user.email,
            online_at: new Date().toISOString(),
          });
        }
      }
    });

  activeChannels = [tasksChannel, notesChannel, commentsChannel, presenceChannel];
}

export function unsubscribeAll() {
  activeChannels.forEach(ch => sb.removeChannel(ch));
  activeChannels = [];
}
