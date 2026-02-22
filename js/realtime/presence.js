// オンラインユーザー表示管理
let presenceContainer = null;

export function initPresenceUI(containerId) {
  presenceContainer = document.getElementById(containerId);
}

export function renderPresence(presenceState) {
  if (!presenceContainer) return;

  const users = [];
  for (const [key, presences] of Object.entries(presenceState)) {
    if (presences && presences.length > 0) {
      users.push(presences[0]);
    }
  }

  if (users.length === 0) {
    presenceContainer.innerHTML = '';
    return;
  }

  presenceContainer.innerHTML = users.map(u => {
    const name = u.display_name || u.email || '?';
    const initial = name.charAt(0).toUpperCase();
    return `<div class="presence-avatar" title="${escapeAttr(name)}">${initial}</div>`;
  }).join('');
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
