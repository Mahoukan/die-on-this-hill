/* Local UI state only. No server, accounts, or multiplayer connection. */
(() => {
  'use strict';

  const find = (selector) => document.querySelector(selector);
  const phase = document.body.dataset.phase;
  const storageKey = 'doth-prototype';
  const params = new URLSearchParams(location.search);
  const requestedRound = Number(params.get('round'));
  const round = Number.isInteger(requestedRound) && requestedRound >= 2 && requestedRound <= 8 ? requestedRound : 2;
  let state;
  try {
    state = JSON.parse(sessionStorage.getItem(storageKey)) || {};
  } catch {
    state = {};
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) state = {};
  if (!state.rounds || typeof state.rounds !== 'object') state.rounds = {};
  if (!state.rounds[round] || typeof state.rounds[round] !== 'object') state.rounds[round] = {};
  const roundState = state.rounds[round];
  const save = () => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* File browsers may restrict storage. The current page still works. */ }
  };
  const reset = () => {
    try { sessionStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
  };

  document.querySelectorAll('[data-round]').forEach((element) => {
    element.innerHTML = `Round <strong>${round}</strong> of 8`;
  });
  if (round > 2) {
    document.querySelectorAll('[data-score]').forEach((element) => { element.innerHTML = '<strong>550</strong> pts'; });
  }
  // Carry the preview round through local page links; keep each stage a real HTML file.
  document.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href');
    if (/^(answer|bluff|debate|vote|reveal|bluff-results|results)\.html$/.test(href) && round > 2) {
      link.setAttribute('href', `${href}?round=${round}`);
    }
  });
  document.querySelectorAll('[data-reset-game]').forEach((link) => link.addEventListener('click', reset));

  // Use elapsed wall time so a backgrounded phone tab doesn't slow the countdown.
  const timerElement = find('[data-timer]');
  const timerBox = timerElement?.closest('.timer');
  let interval;
  let deadline;
  let onExpiry = () => {};
  const stopTimer = (label = 'locked') => {
    window.clearInterval(interval);
    timerBox?.classList.remove('is-urgent');
    timerBox?.classList.add('is-stopped');
    if (timerBox) timerBox.querySelector('.timer-label').textContent = label;
  };
  const startTimer = (seconds, callback) => {
    if (!timerElement) return;
    window.clearInterval(interval);
    timerBox.classList.remove('is-stopped', 'is-urgent');
    deadline = Date.now() + seconds * 1000;
    onExpiry = callback;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      timerElement.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
      timerBox.classList.toggle('is-urgent', remaining > 0 && remaining <= 10);
      if (remaining === 0) {
        stopTimer('time’s up');
        onExpiry();
      }
    };
    interval = window.setInterval(tick, 250);
    tick();
  };

  if (phase === 'answer' || phase === 'bluff') {
    const isBluff = phase === 'bluff';
    const form = find(isBluff ? '#bluff-form' : '#answer-form');
    const input = form.querySelector('input');
    const button = form.querySelector('button');
    const status = find(isBluff ? '#bluff-status' : '#answer-status');
    const stateKey = isBluff ? 'bluff' : 'answer';
    if (isBluff) find('[data-genuine-answer]').textContent = roundState.answer?.value || 'Canada';
    const lock = (value, timedOut = false) => {
      input.value = value;
      input.disabled = true;
      if (!value) input.placeholder = 'No answer submitted';
      button.disabled = true;
      button.classList.add('is-locked');
      button.textContent = value ? (isBluff ? 'BLUFF LOCKED' : 'ANSWER LOCKED') : 'TIME’S UP';
      status.hidden = false;
      status.textContent = value
        ? (isBluff ? 'Bluff locked. Waiting for everyone else...' : 'Your answer is locked. Waiting for everyone else...')
        : 'Time’s up. No answer submitted. Waiting for everyone else...';
      find('#continue-link').hidden = false;
      if (!isBluff && value) find('#answered-count').textContent = '4 of 5 players answered';
      roundState[stateKey] = { value, locked: true, timedOut };
      save();
      stopTimer(timedOut ? 'time’s up' : 'locked');
    };
    input.addEventListener('input', () => input.setCustomValidity(''));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (input.disabled) return;
      const value = input.value.trim();
      if (!value) {
        input.setCustomValidity('Enter an answer before locking it in.');
        input.reportValidity();
        return;
      }
      lock(value);
    });
    if (roundState[stateKey]?.locked) lock(roundState[stateKey].value, roundState[stateKey].timedOut);
    else startTimer(30, () => lock(input.value.trim(), true));
  }

  if (phase === 'debate') {
    startTimer(60, () => {
      find('#debate-status').textContent = 'Time’s up. Make your final choice on the next screen.';
      find('#voting-open').hidden = false;
      find('#continue-link').textContent = 'Continue to vote →';
    });
  }

  if (phase === 'vote') {
    const form = find('#vote-form');
    const options = find('#vote-options');
    const lockButton = find('#lock-vote');
    const hillButton = find('#hill-button');
    const remaining = find('#hill-remaining');
    const dialog = find('#hill-dialog');
    const selected = () => form.querySelector('input:checked')?.value || '';
    let locked = false;
    const updateActions = () => {
      lockButton.disabled = locked || !selected();
      hillButton.disabled = locked || !selected() || Boolean(state.hillUsed);
      remaining.innerHTML = state.hillUsed
        ? '0 remaining <span>· You’ve used your Hill this game.</span>'
        : '1 remaining <span>· Once per game. Double the stakes.</span>';
    };
    const lockVote = (hill = false, timedOut = false) => {
      if (locked) return;
      const answer = selected();
      if (!answer && !timedOut) return;
      if (hill && state.hillUsed) return;
      locked = true;
      if (hill) state.hillUsed = true;
      roundState.vote = { answer, hill, locked: true, timedOut };
      save();
      options.disabled = true;
      lockButton.textContent = answer ? 'ANSWER LOCKED' : 'TIME’S UP';
      const status = find('#vote-status');
      status.hidden = false;
      status.textContent = answer
        ? `${answer} locked${hill ? ' — you will die on this hill. Double points are at stake.' : '.'} Waiting for everyone else...`
        : 'Time’s up. No answer locked. Waiting for everyone else...';
      find('#continue-link').hidden = false;
      stopTimer(timedOut ? 'time’s up' : 'locked');
      updateActions();
      if (dialog.open) dialog.close();
    };
    options.addEventListener('change', updateActions);
    form.addEventListener('submit', (event) => { event.preventDefault(); lockVote(); });
    hillButton.addEventListener('click', () => {
      if (locked || !selected() || state.hillUsed) return;
      find('#hill-selected-answer').textContent = selected();
      dialog.showModal();
    });
    find('#hill-back').addEventListener('click', () => dialog.close());
    find('#hill-confirm').addEventListener('click', () => {
      // A confirmation that reaches the deadline cannot spend the ability.
      if (Date.now() >= deadline) { lockVote(false, true); return; }
      lockVote(true);
    });
    updateActions();
    if (roundState.vote?.locked) {
      const previousVote = roundState.vote;
      form.querySelectorAll('input').forEach((input) => { input.checked = input.value === previousVote.answer; });
      // Restore without spending the once-per-game ability a second time.
      locked = true;
      options.disabled = true;
      lockButton.textContent = previousVote.answer ? 'ANSWER LOCKED' : 'TIME’S UP';
      const status = find('#vote-status');
      status.hidden = false;
      status.textContent = previousVote.answer
        ? `${previousVote.answer} locked${previousVote.hill ? ' — you will die on this hill. Double points are at stake.' : '.'} Waiting for everyone else...`
        : 'Time’s up. No answer locked. Waiting for everyone else...';
      find('#continue-link').hidden = false;
      stopTimer(previousVote.timedOut ? 'time’s up' : 'locked');
      updateActions();
    } else startTimer(15, () => lockVote(false, true));
  }

  if (phase === 'reveal') {
    find('#show-votes').addEventListener('click', () => {
      find('#reveal-votes').hidden = false;
      find('#reveal-votes-action').hidden = true;
      find('#show-correct').focus();
    });
    find('#show-correct').addEventListener('click', () => {
      find('#correct-reveal').hidden = false;
      find('#reveal-answer-action').hidden = true;
      find('#sweden-card').classList.add('is-correct');
      find('.correct-label').hidden = false;
      find('#correct-title').focus();
    });
  }

  if (phase === 'results') {
    find('[data-results-title]').textContent = `ROUND ${round} RESULTS`;
    const nextRound = find('#next-round');
    if (round < 8) {
      nextRound.href = `answer.html?round=${round + 1}`;
      nextRound.addEventListener('click', () => {
        delete state.rounds[round + 1];
        save();
      });
    } else {
      nextRound.href = 'final-results.html';
      nextRound.textContent = 'FINAL RESULTS →';
    }
    find('.phase-note').textContent = round === 8
      ? 'That’s the last round. Time to claim your bragging rights.'
      : `${8 - round} more rounds. Plenty of time to get overconfident.`;
  }

  if (phase === 'display') {
    const previews = {
      debate: { title: 'MAKE YOUR CASE', eyebrow: 'The debate', seconds: 60, timer: 'to debate', instruction: 'ARGUE AMONGST YOURSELVES' },
      vote: { title: 'FINAL ANSWER', eyebrow: 'The vote', seconds: 15, timer: 'to choose', instruction: 'LOCK YOUR ANSWER ON YOUR PHONE' },
      reveal: { title: 'THE CORRECT ANSWER IS…', eyebrow: 'The reveal', instruction: 'SWEDEN · THAT’S ONE HILL WORTH DEFENDING' }
    };
    const showPhase = (name) => {
      const preview = previews[name];
      find('#display-title').textContent = preview.title;
      find('#display-eyebrow').textContent = preview.eyebrow;
      find('#display-instruction').textContent = preview.instruction;
      find('[data-answer="Sweden"]').classList.toggle('is-correct', name === 'reveal');
      timerBox.hidden = name === 'reveal';
      document.querySelectorAll('[data-display-phase]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.displayPhase === name));
      });
      if (preview.seconds) {
        find('#display-timer-label').textContent = preview.timer;
        startTimer(preview.seconds, () => {
          find('#display-instruction').textContent = name === 'debate' ? 'TIME TO VOTE · CHOOSE ON YOUR PHONE' : 'TIME’S UP · PUT YOUR PHONES DOWN';
        });
      } else stopTimer();
    };
    document.querySelectorAll('[data-display-phase]').forEach((button) => button.addEventListener('click', () => showPhase(button.dataset.displayPhase)));
    showPhase('debate');
  }
})();
