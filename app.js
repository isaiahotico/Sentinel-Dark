/* Prism Duel front-end prototype. Do not use localStorage or client-side checks as production security. */
(() => {
  const $ = (id) => document.getElementById(id);

  // Firebase web configuration: client config is public; database rules must protect all data.
  const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
  };
  let firebaseAuth = null;
  let firebaseDb = null;
  let cloudUser = null;
  let cloudLoadFinished = false;
  let cloudSaveTimer = null;

  function setConnectionStatus(message, good = false) {
    const el = $('connectionStatus');
    if (!el) return;
    el.textContent = `${good ? '●' : '○'} ${message}`;
    el.title = message;
  }

  function cloudSafeProfile() {
    // Only sync cosmetic/profile-build data from the client. Never trust client balances,
    // match results, wins, deposits, withdrawals, or admin approvals as authoritative.
    return {
      displayName: String(profile.name || 'Prism Rookie').slice(0, 24),
      statBuild: { ...profile.stats },
      availablePoints: Number(profile.availablePoints),
      updatedAt: firebase.database.ServerValue.TIMESTAMP
    };
  }

  async function saveCloudProfile() {
    if (!firebaseDb || !cloudUser || !cloudLoadFinished) return;
    try {
      await firebaseDb.ref(`users/${cloudUser.uid}/publicProfile`).update(cloudSafeProfile());
      setConnectionStatus('Firebase connected · profile synced', true);
    } catch (err) {
      console.error('Firebase profile save failed:', err);
      setConnectionStatus('Firebase save blocked · check database rules');
    }
  }

  function scheduleCloudSave() {
    if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => { saveCloudProfile(); }, 250);
  }

  async function initFirebase() {
    if (!window.firebase) {
      setConnectionStatus('Firebase SDK unavailable');
      return;
    }
    try {
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
      firebaseAuth = firebase.auth(app);
      firebaseDb = firebase.database(app);
      firebaseAuth.onAuthStateChanged(async (user) => {
        cloudUser = user || null;
        cloudLoadFinished = false;
        if (!user) return;
        try {
          const snap = await firebaseDb.ref(`users/${user.uid}/publicProfile`).once('value');
          const saved = snap.val();
          if (saved && typeof saved === 'object') {
            if (typeof saved.displayName === 'string' && saved.displayName.trim()) profile.name = saved.displayName.slice(0, 24);
            if (saved.statBuild && typeof saved.statBuild === 'object') {
              const clean = {};
              for (const stat of statDefs) clean[stat.key] = Math.max(0, Math.min(10000, Math.floor(Number(saved.statBuild[stat.key]) || 0)));
              const points = Object.values(clean).reduce((a, b) => a + b, 0);
              const allowed = Math.max(20, Math.min(10000, Math.floor(Number(saved.availablePoints) || 20)));
              if (points === allowed) {
                profile.stats = clean;
                profile.availablePoints = allowed;
                draft = { ...clean };
              }
            }
          }
          cloudLoadFinished = true;
          renderProfile(); renderStats();
          setConnectionStatus('Firebase connected · profile loaded', true);
          if (!snap.exists()) await saveCloudProfile();
        } catch (err) {
          console.error('Firebase profile load failed:', err);
          setConnectionStatus('Firebase auth OK · database rules need setup');
        }
      });
      await firebaseAuth.signInAnonymously();
    } catch (err) {
      console.error('Firebase initialization/auth failed:', err);
      setConnectionStatus(err && err.code === 'auth/operation-not-allowed' ? 'Enable Anonymous sign-in in Firebase' : 'Firebase connection failed');
    }
  }

  const statDefs = [
    { key: 'health', label: 'Health', per: 20, unit: 'HP', desc: 'Maximum health' },
    { key: 'damage', label: 'Damage', per: 4, unit: 'damage', desc: 'Attack power' },
    { key: 'speed', label: 'Speed', per: 3, unit: '%', desc: 'Turn initiative' },
    { key: 'critical', label: 'Critical', per: 2, unit: '%', desc: 'Critical chance' },
    { key: 'defence', label: 'Defence', per: 10, unit: 'defence', desc: 'Damage mitigation' },
    { key: 'regen', label: 'Regeneration', per: 3, unit: 'HP/turn', desc: 'Healing each turn' }
  ];
  const initialStats = { health: 4, damage: 4, speed: 3, critical: 2, defence: 5, regen: 2 };
  const baseProfile = { name: 'Prism Rookie', stats: { ...initialStats }, availablePoints: 20, level: 1, wins: 0, losses: 0, credits: 10, totalDeposited: 0 };
  let profile = structuredClone(baseProfile);
  let draft = { ...profile.stats };
  let selectedDifficulty = 'easy';
  let selectedMonster = null;
  let activeFight = false;
  let currentFight = null;
  let arenaQueues = { newbie: [], master: [], pro: [] };
  let myQueue = null;
  let requests = [];
  let reviewer = '';

  const monsterPool = [
    { name: 'Copper Golem', rank: 'Common', emoji: '🗿', role: 'Armor', factor: 0.68, difficulty: 'easy' },
    { name: 'Mossfang Wolf', rank: 'Uncommon', emoji: '🐺', role: 'Speed', factor: 0.72, difficulty: 'easy' },
    { name: 'Prism Wraith', rank: 'Rare', emoji: '👻', role: 'Critical', factor: 0.95, difficulty: 'medium' },
    { name: 'Storm Wyvern', rank: 'Epic', emoji: '🐲', role: 'Attack', factor: 1.05, difficulty: 'medium' },
    { name: 'Abyssal Bastion', rank: 'Legendary', emoji: '🦾', role: 'Defence + regeneration', factor: 1.12, difficulty: 'hard' },
    { name: 'Eclipse Dragon', rank: 'Mythic', emoji: '🐉', role: 'High damage + regeneration', factor: 1.25, difficulty: 'hard' }
  ];
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const totalPoints = (stats) => Object.values(stats).reduce((a, b) => a + b, 0);
  const totalStats = () => totalPoints(profile.stats);
  const playerDerived = (stats = profile.stats) => ({
    maxHp: 20 + stats.health * 20,
    damage: stats.damage * 4,
    speed: stats.speed * 3,
    crit: Math.min(60, stats.critical * 2),
    defence: stats.defence * 10,
    regen: stats.regen * 3
  });
  const fmt = (n) => Number(n).toLocaleString('en-PH', { maximumFractionDigits: 2 });
  const now = () => new Date().toLocaleString();
  const notify = (id, msg) => { $(id).textContent = msg; };

  function renderStats() {
    const used = totalPoints(draft), left = profile.availablePoints - used;
    $('pointsBadge').textContent = `${left} points left`;
    $('statsEditor').innerHTML = statDefs.map(s => `<div class="stat-row"><div><div class="font-semibold">${s.label}</div><div class="text-xs muted">+${s.per} ${s.unit} / point · ${s.desc}</div></div><span class="font-black text-lg tabular-nums">${draft[s.key]}</span><div class="flex gap-1"><button class="stat-btn" data-stat="${s.key}" data-step="-1" aria-label="Remove ${s.label} point" ${draft[s.key] <= 0 ? 'disabled' : ''}>−</button><button class="stat-btn" data-stat="${s.key}" data-step="1" aria-label="Add ${s.label} point" ${left <= 0 ? 'disabled' : ''}>+</button></div></div>`).join('');
    $('statSummary').innerHTML = statDefs.map(s => {
      const d = playerDerived(draft); const val = s.key === 'health' ? `${d.maxHp} HP` : s.key === 'damage' ? `${d.damage}` : s.key === 'speed' ? `${d.speed}%` : s.key === 'critical' ? `${d.crit}%` : s.key === 'defence' ? `${d.defence}` : `${d.regen}/turn`;
      return `<div class="rounded-xl p-3 border border-slate-700 bg-slate-950/40"><p class="muted text-xs">${s.label.toUpperCase()}</p><p class="text-xl font-black">${val}</p><p class="muted text-xs">${draft[s.key]} allocated</p></div>`;
    }).join('');
    $('statsMessage').textContent = left === 0 ? 'Build complete: all 20 points are assigned.' : `Allocate ${left} more point${left === 1 ? '' : 's'} to complete your build.`;
  }
  function renderProfile() {
    $('profileHeading').textContent = profile.name; $('playerName').value = profile.name; $('heroCardName').textContent = profile.name;
    $('levelText').textContent = profile.level; $('recordText').textContent = `${profile.wins} wins / ${profile.losses} losses`;
    $('topCredits').textContent = `₱${fmt(profile.credits)} demo credits`; $('walletBalance').textContent = `₱${fmt(profile.credits)}`;
  }
  function renderMonsters() {
    const q = $('monsterSearch').value.trim().toLowerCase();
    const list = monsterPool.filter(m => m.difficulty === selectedDifficulty && `${m.name} ${m.rank} ${m.role}`.toLowerCase().includes(q));
    $('monsterResults').innerHTML = list.length ? list.map(m => `<div class="rounded-xl border border-slate-700 bg-slate-950/40 p-3 flex items-center gap-3"><div class="card w-16 h-20 flex items-center justify-center text-3xl">${m.emoji}</div><div class="flex-1 min-w-0"><div class="font-bold">${esc(m.name)}</div><div class="text-xs muted">${m.rank} · ${m.role}</div><div class="text-xs muted">Strength scales to your build</div></div><button class="btn btn-primary" data-monster="${esc(m.name)}">Select</button></div>`).join('') : '<p class="muted text-sm">No monster found. Try another name or difficulty.</p>';
  }
  function buildMonster(m) {
    const p = playerDerived(); const scale = m.factor * (0.8 + totalStats() / 100);
    const stats = { maxHp: Math.max(35, Math.round(p.maxHp * scale)), hp: Math.max(35, Math.round(p.maxHp * scale)), damage: Math.max(4, Math.round(p.damage * scale * (m.difficulty === 'hard' ? 1.35 : m.difficulty === 'medium' ? 1.15 : .8))), defence: Math.round(p.defence * scale * (m.role.includes('Armor') || m.role.includes('Defence') ? 1.5 : .65)), crit: Math.min(45, Math.round(p.crit * scale * (m.role.includes('Critical') ? 1.5 : 0.7))), regen: Math.round(p.regen * scale * (m.role.includes('regeneration') ? 1.5 : 0.45)), speed: Math.round(p.speed * scale) };
    return { ...m, stats };
  }
  function chooseMonster(name) {
    const m = monsterPool.find(x => x.name === name); if (!m) return;
    selectedMonster = buildMonster(m);
    $('fightState').textContent = 'Monster selected'; $('fightBtn').disabled = false; $('escapeBtn').disabled = false; $('cancelBtn').disabled = false;
    $('battleCards').innerHTML = `<div class="card p-4"><p class="text-xs font-bold">YOUR CARD</p><div class="text-5xl text-center my-3">🛡️</div><p class="font-black text-center">${esc(profile.name)}</p><p class="text-center text-sm">${playerDerived().maxHp} HP · ${playerDerived().damage} ATK</p></div><div class="card p-4"><p class="text-xs font-bold">${esc(selectedMonster.rank.toUpperCase())} MONSTER</p><div class="text-5xl text-center my-3">${selectedMonster.emoji}</div><p class="font-black text-center">${esc(selectedMonster.name)}</p><p class="text-center text-sm">${selectedMonster.stats.maxHp} HP · ${selectedMonster.stats.damage} ATK</p></div>`;
    $('battleLog').textContent = `${selectedMonster.name} appeared. Choose Fight, Escape, or Cancel.`;
  }
  const damageFor = (attacker, defender) => Math.max(1, Math.round(attacker.damage * (1 + (Math.random() < attacker.crit / 100 ? 1 : 0)) - defender.defence * .1));
  function startFight() {
    if (!selectedMonster || activeFight) return;
    if (totalPoints(profile.stats) !== profile.availablePoints) { notify('battleLog', `Assign all ${profile.availablePoints} available stat points before fighting.`); return; }
    activeFight = true; $('fightBtn').disabled = true; $('escapeBtn').disabled = true; $('cancelBtn').disabled = true; $('fightState').textContent = 'Battle running…';
    const hero = { ...playerDerived(), hp: playerDerived().maxHp };
    const foe = { ...selectedMonster.stats };
    const heroFirst = hero.speed + Math.random() * 10 >= foe.speed + Math.random() * 10;
    const logs = [`Battle begins: ${heroFirst ? 'you have initiative' : selectedMonster.name + ' has initiative'}.`];
    let turn = 1;
    while (hero.hp > 0 && foe.hp > 0 && turn <= 30) {
      const heroAttacks = (turn % 2 === 1) === heroFirst;
      if (heroAttacks) {
        const d = damageFor(hero, foe); foe.hp = Math.max(0, foe.hp - d); logs.push(`Turn ${turn}: your card deals ${d} damage. Monster HP ${foe.hp}/${foe.maxHp}.`);
        if (foe.hp > 0) hero.hp = Math.min(hero.maxHp, hero.hp + hero.regen);
      } else {
        const d = damageFor(foe, hero); hero.hp = Math.max(0, hero.hp - d); logs.push(`Turn ${turn}: ${selectedMonster.name} deals ${d} damage. Your HP ${hero.hp}/${hero.maxHp}.`);
        if (hero.hp > 0) foe.hp = Math.min(foe.maxHp, foe.hp + foe.regen);
      }
      turn++;
    }
    const won = foe.hp <= 0 && hero.hp > 0;
    if (won) {
      profile.wins++; profile.level = 1 + Math.floor(profile.wins / 3);
      const chance = { easy: 3, medium: 5, hard: 7 }[selectedDifficulty];
      const earned = Math.random() * 100 < chance;
      if (earned) { const keys = statDefs.map(s => s.key); const k = keys[Math.floor(Math.random() * keys.length)]; profile.stats[k]++; profile.availablePoints++; logs.push(`Reward roll succeeded: +1 permanent ${statDefs.find(s => s.key === k).label} point. Total available points: ${profile.availablePoints}.`); }
      else logs.push(`Reward roll: no stat point this time (${chance}% chance).`);
      logs.push('Victory!');
    } else if (hero.hp <= 0) { profile.losses++; logs.push('Defeat. Review your build and try another strategy.'); }
    else { logs.push('Battle ended after 30 turns: draw.'); }
    currentFight = { hero, foe, won }; $('fightState').textContent = won ? 'Victory!' : hero.hp <= 0 ? 'Defeat' : 'Draw';
    $('battleLog').innerHTML = logs.map(l => `<div>› ${esc(l)}</div>`).join(''); activeFight = false; draft = { ...profile.stats }; renderProfile(); renderStats();
    $('fightBtn').disabled = false; $('escapeBtn').disabled = false; $('cancelBtn').disabled = false;
  }
  const leagueRules = { newbie: { label:'Newbie', min:0, max:100, cap:10, tax:0, desc:'0–100 total stats · ₱0–₱10 demo stake · no fee' }, master: { label:'Master', min:0, max:500, cap:50, tax:1, desc:'Up to 500 total stats · ₱10–₱50 demo stake · ₱1 fee' }, pro: { label:'Pro', min:501, max:Infinity, cap:1000, tax:10, desc:'Above 500 total stats · ₱100–₱1,000 demo stake · ₱10 fee' } };
  // Arena entries must represent human players only. AI/bot entries are never created or displayed.
  // A production server must validate these fields and all bet/refresh operations atomically.
  function isHumanLiveEntry(entry) {
    return entry && entry.kind === 'human' && entry.live === true && typeof entry.id === 'string';
  }
  function entryBet(entry) {
    // Only a live human entry may carry a bet. This demo has no real-money wagering.
    return isHumanLiveEntry(entry) ? Math.max(0, Number(entry.bet) || 0) : 0;
  }
  function renderArena() {
    // Hide invalid/offline/bot entries; never render an AI as a PvP opponent.
    for (const key of Object.keys(arenaQueues)) {
      arenaQueues[key] = arenaQueues[key].filter(isHumanLiveEntry);
    }
    $('leagueCards').innerHTML = Object.entries(leagueRules).map(([key, r]) => `<div class="card p-4"><div class="flex justify-between items-center"><h3 class="text-lg font-black">${r.label} League</h3><span>${key==='newbie'?'🟢':key==='master'?'🔷':'🔥'}</span></div><p class="text-sm mt-2">${r.desc}</p><p class="text-xs mt-2">${arenaQueues[key].length}/10 seats filled</p></div>`).join('');
    const all = Object.entries(arenaQueues).flatMap(([league, entries]) => entries.map(e => ({ ...e, league })));
    $('queueCount').textContent = `${all.length} / 30`;
    $('queueList').innerHTML = all.length ? all.map(e => {
      const bet = entryBet(e);
      const samePlayer = e.uid && cloudUser && e.uid === cloudUser.uid;
      const statGap = Math.abs(Number(e.total) - totalStats());
      const canChallenge = !samePlayer && statGap <= 5 && e.live === true && e.kind === 'human';
      return `<div class="panel p-3"><div class="flex justify-between gap-2"><strong>${esc(e.name)}</strong><span class="pill">${leagueRules[e.league].label}</span></div><p class="muted text-sm mt-1">${e.total} total stats · <span class="text-emerald-300">● Live player</span></p><p class="muted text-xs">Demo stake: ₱${fmt(bet)} · ${bet > 0 ? 'ACTIVE BET — REFRESH LOCKED' : '0 bet — refresh allowed'}</p><p class="muted text-xs mt-1">Stat difference: ${statGap} ${statGap <= 5 ? '· eligible' : '· outside the ±5 match limit'}</p><div class="flex gap-2 mt-3"><button class="btn" data-refresh-entry="${e.id}" ${bet > 0 ? 'disabled title="Entries with active bets cannot be refreshed"' : ''}>↻ Refresh</button><button class="btn btn-primary" data-challenge="${e.id}" ${!canChallenge ? 'disabled title="Challenge requires a different live human player within 5 total stats"' : ''}>Challenge</button></div></div>`;
    }).join('') : '<div class="muted text-sm">No live human players are waiting in this demo queue. No bots or AI opponents are generated.</div>';
  }
  function getLeague() { return $('arenaLeague').value; }
  function canEnterLeague(key) {
    const t = totalStats();
    if (key === 'newbie') return t <= 100;
    if (key === 'master') return t > 100 && t <= 500;
    return t > 500;
  }
  function joinQueue() {
    const league = getLeague();
    if (totalPoints(profile.stats) !== profile.availablePoints) return notify('arenaMessage', `Allocate all ${profile.availablePoints} available points first.`);
    if (!canEnterLeague(league)) return notify('arenaMessage', `Your ${totalStats()} total stats do not qualify for ${leagueRules[league].label}.`);
    if (myQueue) return notify('arenaMessage', 'You already have a seat. Leave that queue before joining another.');
    if (arenaQueues[league].length >= 10) return notify('arenaMessage', 'This queue is full (10 seats). Try another league.');
    const entry = { id: `p-${Date.now()}`, uid: cloudUser ? cloudUser.uid : null, kind: 'human', live: true, name: profile.name, total: totalStats(), bet: 0, status: 'Waiting for real player' };
    arenaQueues[league].push(entry); myQueue = { league, id: entry.id }; renderArena(); notify('arenaMessage', 'Seat reserved in this demo. Waiting for another real player; no AI opponent will be added.');
  }
  function leaveQueue() {
    if (!myQueue) return notify('arenaMessage', 'You are not in a queue.');
    const entries = arenaQueues[myQueue.league] || [];
    const ownEntry = entries.find(e => e.id === myQueue.id);
    if (ownEntry && entryBet(ownEntry) > 0) return notify('arenaMessage', 'Your seat has an active bet and is locked. It cannot be removed from the queue.');
    arenaQueues[myQueue.league] = entries.filter(e => e.id !== myQueue.id); myQueue = null; renderArena(); notify('arenaMessage', 'You left the queue.');
  }
  function refreshEntry(id) {
    for (const [league, entries] of Object.entries(arenaQueues)) {
      const e = entries.find(x => x.id === id);
      if (!e) continue;
      if (!isHumanLiveEntry(e)) return notify('arenaMessage', 'Blocked: only live human player entries are permitted in the arena.');
      if (entryBet(e) > 0) return notify('arenaMessage', 'Blocked: entries with active bets cannot be refreshed.');
      arenaQueues[league] = entries.filter(x => x.id !== id);
      if (myQueue && myQueue.id === id) myQueue = null;
      renderArena();
      return notify('arenaMessage', 'Refreshed this zero-bet player seat. Entries with active bets were preserved.');
    }
  }
  function submitRequest(type) {
    if (type === 'deposit') {
      const name = $('depositName').value.trim(), amount = Number($('depositAmount').value), proof = $('depositProof').value.trim();
      if (!name || !proof || !Number.isFinite(amount) || amount < 10) return alert('Enter the account name, proof reference, and a deposit amount of at least ₱10.');
      requests.unshift({ id: Date.now(), type, name, amount, proof, date: now(), status: 'Pending', details: 'Demo request only' });
    } else {
      const amount = Number($('withdrawAmount').value), name = $('gcashName').value.trim(), number = $('gcashNumber').value.trim();
      if (amount < 10 || !Number.isFinite(amount) || !name || !/^09\d{9}$/.test(number)) return alert('Withdrawal minimum is ₱10. Enter the GCash account name and a valid 11-digit 09 number.');
      if (profile.totalDeposited < 20) return alert('Demo rule: at least ₱20 in approved deposits is required before withdrawal.');
      if (amount > profile.credits) return alert('Insufficient demo balance.');
      requests.unshift({ id: Date.now(), type, name, amount, proof: `GCash ${number}`, date: now(), status: 'Pending', details: 'Demo request only' });
    }
    renderWallet(); renderAdmin(); alert('Demo request submitted for review. No money was transferred.');
  }
  function renderWallet() {
    $('walletBalance').textContent = `₱${fmt(profile.credits)}`; $('topCredits').textContent = `₱${fmt(profile.credits)} demo credits`;
    $('walletHistory').innerHTML = requests.length ? requests.map(r => `<div class="rounded-xl border border-slate-700 bg-slate-950/40 p-3"><div class="flex justify-between gap-2"><strong>${r.type === 'deposit' ? 'Deposit' : 'Withdrawal'} · ₱${fmt(r.amount)}</strong><span class="pill">${r.status}</span></div><p class="muted text-xs mt-1">${esc(r.name)} · ${esc(r.date)}</p><p class="muted text-sm mt-1">Proof/details: ${esc(r.proof)}</p></div>`).join('') : '<p class="muted text-sm">No requests submitted yet.</p>';
  }
  function renderAdmin() {
    const pending = requests.filter(r => r.status === 'Pending'); $('pendingCount').textContent = `${pending.length} pending`;
    $('adminRequests').innerHTML = requests.length ? requests.map(r => `<div class="rounded-xl border border-slate-700 bg-slate-950/40 p-3"><div class="flex justify-between gap-2"><strong>${r.type === 'deposit' ? 'Deposit' : 'Withdrawal'} · ₱${fmt(r.amount)}</strong><span class="pill">${r.status}</span></div><p class="muted text-xs mt-1">${esc(r.name)} · ${esc(r.date)}</p><p class="text-sm mt-1">Proof/details: ${esc(r.proof)}</p>${r.status === 'Pending' ? `<div class="flex gap-2 mt-3"><button class="btn btn-good" data-approve="${r.id}">Approve demo</button><button class="btn btn-warn" data-reject="${r.id}">Reject demo</button></div>` : ''}</div>`).join('') : '<p class="muted text-sm">No requests to review.</p>';
  }
  function review(id, approve) {
    if (!reviewer) return notify('adminStatus', 'Enter a reviewer label and open the demo panel first.');
    const r = requests.find(x => x.id === Number(id)); if (!r || r.status !== 'Pending') return;
    r.status = approve ? 'Approved (demo)' : 'Rejected (demo)'; r.reviewedBy = reviewer;
    if (approve && r.type === 'deposit') { profile.credits += r.amount; profile.totalDeposited += r.amount; }
    if (approve && r.type === 'withdraw') profile.credits -= r.amount;
    renderAdmin(); renderWallet(); renderProfile(); notify('adminStatus', `Demo request ${approve ? 'approved' : 'rejected'} by ${reviewer}. No real transfer occurred.`);
  }
  function switchView(view) {
    document.querySelectorAll('.view').forEach(el => el.classList.toggle('hidden-view', el.id !== `view-${view}`));
    document.querySelectorAll('.navbtn').forEach(el => el.classList.toggle('active', el.dataset.view === view));
  }

  document.querySelectorAll('.navbtn').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
  $('statsEditor').addEventListener('click', e => { const b = e.target.closest('[data-stat]'); if (!b) return; const k = b.dataset.stat, step = Number(b.dataset.step); const sum = totalPoints(draft); if (step > 0 && sum >= profile.availablePoints) return; if (draft[k] + step < 0) return; draft[k] += step; renderStats(); });
  $('saveName').addEventListener('click', () => { const n = $('playerName').value.trim(); if (!n) return alert('Enter a display name.'); profile.name = n.slice(0,24); renderProfile(); scheduleCloudSave(); });
  $('resetStats').addEventListener('click', () => { draft = { health:20, damage:0, speed:0, critical:0, defence:0, regen:0 }; renderStats(); });
  $('saveStats').addEventListener('click', () => { if (totalPoints(draft) !== profile.availablePoints) return notify('statsMessage', `Assign exactly ${profile.availablePoints} points first. You have ${totalPoints(draft)}.`); if (activeFight) return notify('statsMessage', 'You cannot change stats during a battle.'); profile.stats = { ...draft }; renderStats(); renderProfile(); scheduleCloudSave(); notify('statsMessage', 'Build saved. Firebase sync is attempted when authentication and database rules permit it.'); });
  document.querySelectorAll('.difficulty').forEach(b => b.addEventListener('click', () => { selectedDifficulty = b.dataset.diff; document.querySelectorAll('.difficulty').forEach(x => x.classList.toggle('active', x === b)); renderMonsters(); }));
  $('monsterSearch').addEventListener('input', renderMonsters);
  $('monsterResults').addEventListener('click', e => { const b = e.target.closest('[data-monster]'); if (b) chooseMonster(b.dataset.monster); });
  $('fightBtn').addEventListener('click', startFight);
  $('escapeBtn').addEventListener('click', () => { if (activeFight) return; selectedMonster = null; $('fightState').textContent = 'Escaped'; $('battleLog').textContent = 'You escaped safely. No rewards or penalties.'; $('fightBtn').disabled = $('escapeBtn').disabled = $('cancelBtn').disabled = true; });
  $('cancelBtn').addEventListener('click', () => { if (activeFight) return; selectedMonster = null; $('fightState').textContent = 'Cancelled'; $('battleLog').textContent = 'Encounter cancelled.'; $('fightBtn').disabled = $('escapeBtn').disabled = $('cancelBtn').disabled = true; });
  $('refreshQueues').addEventListener('click', () => { let count = 0; for (const [league, entries] of Object.entries(arenaQueues)) { arenaQueues[league] = entries.filter(e => { if (!isHumanLiveEntry(e)) return false; if (entryBet(e) === 0) { count++; if (myQueue && myQueue.id === e.id) myQueue = null; return false; } return true; }); } renderArena(); notify('arenaMessage', `Refreshed ${count} zero-bet live-player seat(s). All entries with active bets were preserved; no AI entries are created.`); });
  $('joinQueue').addEventListener('click', joinQueue); $('leaveQueue').addEventListener('click', leaveQueue);
  $('queueList').addEventListener('click', e => { const r = e.target.closest('[data-refresh-entry]'); if (r) refreshEntry(r.dataset.refreshEntry); const c = e.target.closest('[data-challenge]'); if (c) { const target = Object.values(arenaQueues).flat().find(x => x.id === c.dataset.challenge); if (!target || !isHumanLiveEntry(target)) return notify('arenaMessage', 'Only a live human player can be challenged.'); const gap = Math.abs(Number(target.total) - totalStats()); if (gap > 5) return notify('arenaMessage', 'Match blocked: players must be within 5 total stat points.'); notify('arenaMessage', 'Match eligible. Starting a real PvP battle requires the secure real-time matchmaking backend; this demo will not fake an opponent or result.'); } });
  $('submitDeposit').addEventListener('click', () => submitRequest('deposit')); $('submitWithdraw').addEventListener('click', () => submitRequest('withdraw'));
  $('adminUnlock').addEventListener('click', () => { reviewer = $('adminToken').value.trim(); if (!reviewer) return notify('adminStatus', 'Enter a reviewer label. This is not secure authentication.'); notify('adminStatus', `Demo review panel opened for ${reviewer}. Production access control must be server-side.`); });
  $('adminRequests').addEventListener('click', e => { const a = e.target.closest('[data-approve]'), r = e.target.closest('[data-reject]'); if (a) review(a.dataset.approve, true); if (r) review(r.dataset.reject, false); });
  $('resetDemo').addEventListener('click', () => { if (!confirm('Reset all demo profile, queue, and wallet data for this page?')) return; profile = structuredClone(baseProfile); draft = { ...profile.stats }; arenaQueues = { newbie: [], master: [], pro: [] }; myQueue = null; requests = []; reviewer = ''; selectedMonster = null; activeFight = false; renderProfile(); renderStats(); renderMonsters(); renderArena(); renderWallet(); renderAdmin(); notify('battleLog', 'Battle log: choose a monster to begin.'); notify('arenaMessage', 'Demo reset. No AI opponents are generated.'); switchView('profile'); });

  renderProfile(); renderStats(); renderMonsters(); renderArena(); renderWallet(); renderAdmin();
  initFirebase();
})();
