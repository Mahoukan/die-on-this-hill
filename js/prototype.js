(() => {
  const qs = (selector) => document.querySelector(selector);
  const toast = (message) => {
    const el = qs('#prototype-toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => el.classList.remove('show'), 1800);
  };

  const joinForm = qs('#join-form');
  if (joinForm) {
    joinForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const codeInput = qs('#room-code');
      const code = (codeInput?.value || 'HILL').trim().toUpperCase();
      window.location.href = `lobby.html?room=${encodeURIComponent(code || 'HILL')}`;
    });
  }

  const roomCode = qs('#copy-room-code');
  const copyMessage = qs('#copy-message');
  const params = new URLSearchParams(window.location.search);
  const requestedRoom = params.get('room');
  if (roomCode && requestedRoom) roomCode.textContent = requestedRoom.slice(0, 6).toUpperCase();

  const copyText = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  };

  roomCode?.addEventListener('click', async () => {
    const code = roomCode.textContent.trim();
    const copied = await copyText(code);
    if (copyMessage) copyMessage.textContent = copied ? 'Room code copied.' : `Room code: ${code}`;
    toast(copied ? 'Room code copied' : code);
  });

  qs('#copy-link')?.addEventListener('click', async () => {
    const code = roomCode?.textContent.trim() || 'HILL';
    const url = new URL('lobby.html', location.href);
    url.searchParams.set('room', code);
    const copied = await copyText(url.href);
    toast(copied ? 'Invite link copied' : 'Copying is unavailable in this browser');
  });

  qs('#display-button')?.addEventListener('click', () => {
    window.open('display.html', '_blank', 'noopener');
  });

  const names = ['Oliver', 'Shalini', 'Chelsey', 'Lexie', 'Samy', 'Marlee'];
  let fakeIndex = 0;
  qs('#add-player')?.addEventListener('click', () => {
    const grid = qs('#player-grid');
    if (!grid) return;
    const name = names[fakeIndex % names.length];
    fakeIndex += 1;
    const card = document.createElement('article');
    card.className = 'player-card';
    card.innerHTML = `
      <div class="avatar">${name[0]}</div>
      <div class="player-info"><strong>${name}</strong><span>Ready</span></div>
      <span class="ready-check" aria-label="Ready">✓</span>`;
    grid.appendChild(card);
    const heading = qs('#players-title');
    if (heading) heading.textContent = `${grid.children.length} players joined`;
  });

  document.querySelectorAll('.segmented button').forEach((button) => {
    button.addEventListener('click', () => {
      button.parentElement.querySelectorAll('button').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
    });
  });

  const startGame = () => {
    try { sessionStorage.removeItem('doth-prototype'); } catch { /* Local storage is optional. */ }
    window.location.href = 'answer.html';
  };
  qs('#start-game')?.addEventListener('click', startGame);
  qs('#next-screen')?.addEventListener('click', startGame);
})();
