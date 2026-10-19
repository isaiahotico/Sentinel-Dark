/* =================================================================
   AURA DUELISTS - APP.JS GAME ENGINE & MATCHMAKING SYSTEM
   Platinum Shining Cards, Dynamic Monster Scaling, Arena Matchmaking, Cashier & Admin
   ================================================================= */

// 1. GAME DATA & PLAYER INITIAL STATE
const gameState = {
  player: {
    name: "AuraKnight",
    basePoints: 20,          // Customizable starting points
    earnedPoints: 0,         // Permanent points gained from PVE drops
    balance: 1000.00,          // User account starts with 10 Peso initial balance
    totalDeposited: 0.00,    // Total approved deposits (Requires >= ₱20 to withdraw)
    stats: {
      health: 5,             // allocated points
      damage: 5,
      speed: 3,
      critical: 3,
      defence: 2,
      regeneration: 2
    }
  },
  pve: {
    selectedZone: 'easy',    // 'easy', 'medium', 'hard'
    currentMonster: null,
    isBattling: false
  },
  pvp: {
    currentTier: 'newbie',   // 'newbie', 'master', 'pro'
    queues: {
      newbie: [],
      master: [],
      pro: []
    }
  },
  admin: {
    unlocked: false,
    pendingDeposits: [],
    pendingWithdrawals: []
  }
};

// Exact Stat Conversion Multipliers
const STAT_RULES = {
  health: { perPoint: 20, base: 100, label: "HP" },
  damage: { perPoint: 4, base: 10, label: "DMG" },
  speed: { perPoint: 3, base: 10, label: "%" },
  critical: { perPoint: 2, base: 5, label: "%" },
  defence: { perPoint: 10, base: 0, label: "DEF" },
  regeneration: { perPoint: 3, base: 0, label: "/turn" }
};

// PVP Tier Settings, Taxes, and Wagers
const TIER_RULES = {
  newbie: { maxStat: 100, minBet: 0, maxBet: 10, tax: 0, name: "Newbie Tier" },
  master: { maxStat: 500, minBet: 10, maxBet: 50, tax: 1, name: "Master Tier" },
  pro: { maxStat: Infinity, minBet: 100, maxBet: 1000, tax: 10, name: "Pro Champions" }
};

// PVE Drop Chances per Difficulty
const ZONE_DROP_RATES = {
  easy: 0.03,    // 3% Chance
  medium: 0.05,  // 5% Chance
  hard: 0.07     // 7% Chance
};

/* =================================================================
   2. INITIALIZATION & STATE PERSISTENCE
   ================================================================= */
window.addEventListener('DOMContentLoaded', () => {
  loadState();
  initArenaQueues();
  updateUI();
});

function saveState() {
  localStorage.setItem('auraDuelistState_v3', JSON.stringify(gameState));
}

function loadState() {
  const saved = localStorage.getItem('auraDuelistState_v3');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      gameState.player = { ...gameState.player, ...parsed.player };
      if (parsed.admin) gameState.admin = parsed.admin;
    } catch (e) {
      console.error("State parse error", e);
    }
  }
}

/* =================================================================
   3. STAT MATRIX & CALCULATIONS
   ================================================================= */
function getTotalAllocatedPoints() {
  return Object.values(gameState.player.stats).reduce((a, b) => a + b, 0);
}

function getMaxPoolPoints() {
  return gameState.player.basePoints + gameState.player.earnedPoints;
}

function getPlayerEffectiveStats() {
  const st = gameState.player.stats;
  return {
    hp: STAT_RULES.health.base + (st.health * STAT_RULES.health.perPoint),
    dmg: STAT_RULES.damage.base + (st.damage * STAT_RULES.damage.perPoint),
    speed: STAT_RULES.speed.base + (st.speed * STAT_RULES.speed.perPoint),
    crit: STAT_RULES.critical.base + (st.critical * STAT_RULES.critical.perPoint),
    def: STAT_RULES.defence.base + (st.defence * STAT_RULES.defence.perPoint),
    regen: STAT_RULES.regeneration.base + (st.regeneration * STAT_RULES.regeneration.perPoint)
  };
}

function modifyStat(statKey, delta) {
  const currentVal = gameState.player.stats[statKey] || 0;
  const totalAllocated = getTotalAllocatedPoints();
  const maxPool = getMaxPoolPoints();

  if (delta > 0 && totalAllocated >= maxPool) {
    showToast("No unallocated stat points remaining!", "amber");
    return;
  }

  if (delta < 0 && currentVal <= 0) {
    return;
  }

  gameState.player.stats[statKey] = currentVal + delta;
  saveState();
  updateUI();
}

function resetStats() {
  Object.keys(gameState.player.stats).forEach(k => {
    gameState.player.stats[k] = 0;
  });
  saveState();
  updateUI();
  showToast("All stat points reset to pool.", "info");
}

function editPlayerName() {
  const newName = prompt("Enter new player avatar name:", gameState.player.name);
  if (newName && newName.trim().length > 0) {
    gameState.player.name = newName.trim().substring(0, 16);
    saveState();
    updateUI();
    showToast(`Avatar name changed to ${gameState.player.name}!`, "success");
  }
}

/* =================================================================
   4. PVE BATTLEFIELD & DYNAMIC MONSTER SCALING
   ================================================================= */
function selectZone(zoneKey) {
  if (gameState.pve.isBattling) return;
  gameState.pve.selectedZone = zoneKey;
  
  ['easy', 'medium', 'hard'].forEach(z => {
    const el = document.getElementById(`zoneCard-${z}`);
    if (z === zoneKey) {
      el.className = `cursor-pointer border-2 ${z === 'easy' ? 'border-emerald-500' : z === 'medium' ? 'border-amber-500' : 'border-red-500'} bg-slate-900/90 rounded-2xl p-4 transition shadow-lg`;
    } else {
      el.className = "cursor-pointer border border-slate-800 bg-slate-900/60 rounded-2xl p-4 transition shadow-lg hover:border-slate-700";
    }
  });

  cancelSearch();
}

function searchMonster() {
  const idle = document.getElementById('pveIdleState');
  const searching = document.getElementById('pveSearchingState');
  const found = document.getElementById('pveFoundState');
  const combat = document.getElementById('pveCombatStage');

  idle.classList.add('hidden');
  combat.classList.add('hidden');
  searching.classList.remove('hidden');

  setTimeout(() => {
    searching.classList.add('hidden');
    found.classList.remove('hidden');

    const userStatsTotal = getTotalAllocatedPoints();
    const zone = gameState.pve.selectedZone;

    // Monster dynamic scaling based on user total stats
    let monsterHp, monsterDmg, monsterDef, monsterRegen, monsterCrit, monsterSpeed;
    let monsterName = "Wild Monster", monsterIcon = "fa-spaghetti-monster-flying", monsterRole = "General";

    if (zone === 'easy') {
      // Easy (qq): Small overall stats, high armor variants are strongest
      const isArmorVariant = Math.random() < 0.5;
      monsterName = isArmorVariant ? "Ironclad Beetle" : "Crypt Skeleton";
      monsterIcon = isArmorVariant ? "fa-shield-halved" : "fa-skull";
      monsterRole = isArmorVariant ? "High Armor Tank" : "Crypt Lurker";

      monsterHp = Math.round(100 + (userStatsTotal * 12));
      monsterDmg = Math.round(8 + (userStatsTotal * 2.2));
      monsterDef = isArmorVariant ? Math.round(20 + (userStatsTotal * 8)) : Math.round(10 + (userStatsTotal * 3));
      monsterRegen = 1;
      monsterCrit = 4;
      monsterSpeed = Math.round(8 + (userStatsTotal * 1.5));

    } else if (zone === 'medium') {
      // Medium: Focus on Attack & Critical
      const isCritVariant = Math.random() < 0.5;
      monsterName = isCritVariant ? "Crimson Assassin" : "Ignis Hellhound";
      monsterIcon = isCritVariant ? "fa-ghost" : "fa-fire-flame-curved";
      monsterRole = isCritVariant ? "Lethal Piercer" : "Attack & Crit Focus";

      monsterHp = Math.round(120 + (userStatsTotal * 16));
      monsterDmg = Math.round(14 + (userStatsTotal * 3.8)); // High Attack
      monsterDef = Math.round(10 + (userStatsTotal * 4));
      monsterRegen = 3;
      monsterCrit = isCritVariant ? 22 : 16; // High Critical
      monsterSpeed = Math.round(12 + (userStatsTotal * 2.2));

    } else { // Hard Mode
      // Hard: Focus on Regeneration, Defence, and High Damage
      const isColossus = Math.random() < 0.5;
      monsterName = isColossus ? "Dread Colossus" : "Void Sovereign";
      monsterIcon = isColossus ? "fa-dungeon" : "fa-eye";
      monsterRole = isColossus ? "High Def & Regen Behemoth" : "High Damage Overlord";

      monsterHp = Math.round(180 + (userStatsTotal * 22));
      monsterDmg = Math.round(20 + (userStatsTotal * 4.8)); // High Damage
      monsterDef = Math.round(30 + (userStatsTotal * 10)); // High Defence
      monsterRegen = Math.round(6 + (userStatsTotal * 1.2)); // High Regeneration
      monsterCrit = 15;
      monsterSpeed = Math.round(14 + (userStatsTotal * 2.5));
    }

    gameState.pve.currentMonster = {
      name: monsterName,
      icon: monsterIcon,
      role: monsterRole,
      zone: zone,
      userScaledStats: userStatsTotal,
      hp: monsterHp,
      maxHp: monsterHp,
      dmg: monsterDmg,
      def: monsterDef,
      regen: monsterRegen,
      crit: monsterCrit,
      spd: monsterSpeed
    };

    document.getElementById('encounterZoneTag').textContent = `ZONE: ${zone.toUpperCase()}`;
    document.getElementById('encounterDropTag').textContent = `Drop Rate: ${(ZONE_DROP_RATES[zone] * 100)}% Stat`;
    document.getElementById('encounterName').textContent = gameState.pve.currentMonster.name;
    document.getElementById('encounterLevelBadge').textContent = `Monster Scaled to ${userStatsTotal} Stats`;
    document.getElementById('encounterClass').textContent = gameState.pve.currentMonster.role;
    document.getElementById('encounterIcon').className = `fa-solid ${gameState.pve.currentMonster.icon} text-6xl text-red-400 drop-shadow-[0_0_20px_rgba(239,68,68,0.85)]`;
    
    document.getElementById('encounterHp').textContent = gameState.pve.currentMonster.hp;
    document.getElementById('encounterDmg').textContent = gameState.pve.currentMonster.dmg;
    document.getElementById('encounterDef').textContent = gameState.pve.currentMonster.def;
    document.getElementById('encounterRegen').textContent = gameState.pve.currentMonster.regen;
    document.getElementById('encounterCrit').textContent = `${gameState.pve.currentMonster.crit}%`;
    document.getElementById('encounterSpeed').textContent = `${gameState.pve.currentMonster.spd}%`;
  }, 650);
}

function cancelSearch() {
  document.getElementById('pveSearchingState').classList.add('hidden');
  document.getElementById('pveFoundState').classList.add('hidden');
  document.getElementById('pveCombatStage').classList.add('hidden');
  document.getElementById('pveIdleState').classList.remove('hidden');
  gameState.pve.currentMonster = null;
}

function escapeBattle() {
  showToast("Escaped safely from monster combat!", "info");
  cancelSearch();
}

function startCombat() {
  if (!gameState.pve.currentMonster) return;
  gameState.pve.isBattling = true;

  document.getElementById('pveFoundState').classList.add('hidden');
  document.getElementById('pveCombatStage').classList.remove('hidden');
  document.getElementById('combatResultOverlay').classList.add('hidden');

  const log = document.getElementById('combatLog');
  log.innerHTML = `<div class="text-cyan-400 font-bold">>>> COMBAT ENGAGED against ${gameState.pve.currentMonster.name}!</div>`;

  const pStats = getPlayerEffectiveStats();
  const playerFighter = {
    name: gameState.player.name,
    hp: pStats.hp,
    maxHp: pStats.hp,
    dmg: pStats.dmg,
    def: pStats.def,
    regen: pStats.regen,
    crit: pStats.crit,
    spd: pStats.speed
  };

  const monsterFighter = { ...gameState.pve.currentMonster };

  document.getElementById('battlePlayerName').textContent = playerFighter.name;
  document.getElementById('battleEnemyName').textContent = monsterFighter.name;
  document.getElementById('battleEnemyAvatarIcon').className = `fa-solid ${monsterFighter.icon}`;
  document.getElementById('battleEnemyTierBadge').textContent = monsterFighter.zone.toUpperCase();

  runTurnBasedCombat(playerFighter, monsterFighter);
}

function runTurnBasedCombat(player, enemy) {
  let turn = 1;

  function syncHealthBars() {
    const pPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    const ePct = Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100));

    document.getElementById('battlePlayerHpBar').style.width = `${pPct}%`;
    document.getElementById('battlePlayerHpText').textContent = `${Math.ceil(player.hp)} / ${player.maxHp} HP`;

    document.getElementById('battleEnemyHpBar').style.width = `${ePct}%`;
    document.getElementById('battleEnemyHpText').textContent = `${Math.ceil(enemy.hp)} / ${enemy.maxHp} HP`;
  }

  syncHealthBars();

  const combatInterval = setInterval(() => {
    document.getElementById('combatTurnCounter').textContent = `Turn ${turn}`;

    // Regeneration
    if (player.regen > 0 && player.hp < player.maxHp) {
      const heal = Math.min(player.regen, player.maxHp - player.hp);
      player.hp += heal;
      appendCombatLog(`💚 ${player.name} regenerates +${heal} HP!`, 'text-emerald-400');
    }
    if (enemy.regen > 0 && enemy.hp < enemy.maxHp) {
      const heal = Math.min(enemy.regen, enemy.maxHp - enemy.hp);
      enemy.hp += heal;
      appendCombatLog(`💚 ${enemy.name} regenerates +${heal} HP!`, 'text-emerald-400');
    }
    syncHealthBars();

    // Speed Priority
    const playerFirst = player.spd >= enemy.spd;
    const first = playerFirst ? player : enemy;
    const second = playerFirst ? enemy : player;
    const isPlayerFirst = playerFirst;

    executeStrike(first, second, isPlayerFirst, () => {
      syncHealthBars();
      if (second.hp <= 0) {
        clearInterval(combatInterval);
        finishCombat(first === player);
        return;
      }

      setTimeout(() => {
        executeStrike(second, first, !isPlayerFirst, () => {
          syncHealthBars();
          if (first.hp <= 0) {
            clearInterval(combatInterval);
            finishCombat(second === player);
            return;
          }
          turn++;
        });
      }, 350);
    });

  }, 950);
}

function executeStrike(attacker, defender, isPlayerAttacker, onComplete) {
  const atkCard = document.getElementById(isPlayerAttacker ? 'battleCardPlayer' : 'battleCardEnemy');
  const defCard = document.getElementById(isPlayerAttacker ? 'battleCardEnemy' : 'battleCardPlayer');

  atkCard.classList.add(isPlayerAttacker ? 'lunge-right' : 'lunge-left');
  setTimeout(() => {
    atkCard.classList.remove('lunge-right', 'lunge-left');
    defCard.classList.add('shake-impact');
    setTimeout(() => defCard.classList.remove('shake-impact'), 350);
  }, 180);

  // Damage Mitigation Formula: Atk * (100 / (100 + Def))
  const isCrit = (Math.random() * 100) < attacker.crit;
  const rawDmg = isCrit ? (attacker.dmg * 1.8) : attacker.dmg;
  const mitigatedDmg = Math.max(2, Math.round(rawDmg * (100 / (100 + defender.def))));

  defender.hp = Math.max(0, defender.hp - mitigatedDmg);

  const critText = isCrit ? ' 🔥 CRITICAL HIT!' : '';
  appendCombatLog(
    `⚔️ ${attacker.name} strikes ${defender.name} for ${mitigatedDmg} damage!${critText}`,
    isCrit ? 'text-yellow-400 font-bold' : isPlayerAttacker ? 'text-cyan-300' : 'text-red-300'
  );

  if (onComplete) onComplete();
}

function appendCombatLog(msg, colorClass) {
  const log = document.getElementById('combatLog');
  const line = document.createElement('div');
  line.className = colorClass || 'text-slate-300';
  line.innerHTML = msg;
  log.appendChild(line);
  log.scrollTop = log.scrollHeight;
}

function finishCombat(playerWon) {
  gameState.pve.isBattling = false;
  const overlay = document.getElementById('combatResultOverlay');
  const title = document.getElementById('combatResultTitle');
  const sub = document.getElementById('combatResultSub');
  const reward = document.getElementById('combatRewardBox');

  overlay.classList.remove('hidden');

  if (playerWon) {
    title.className = "text-xl font-black text-emerald-400";
    title.innerHTML = `<i class="fa-solid fa-trophy"></i> VICTORY ACHIEVED!`;
    sub.textContent = `${gameState.pve.currentMonster.name} was successfully defeated!`;

    const dropRate = ZONE_DROP_RATES[gameState.pve.selectedZone];
    const statDropWon = Math.random() < dropRate;

    if (statDropWon) {
      gameState.player.earnedPoints += 1;
      saveState();
      updateUI();
      reward.innerHTML = `
        <div class="p-3 bg-gradient-to-r from-purple-950 to-fuchsia-950 border border-fuchsia-500 rounded-xl animate-pulse">
          🎉 ULTRA RARE DROP! You earned <span class="text-fuchsia-300 font-extrabold">+1 Permanent Stat Point</span>!
        </div>
      `;
      showToast("★ RARE DROP: +1 Stat Point Absorbed! ★", "success");
    } else {
      reward.innerHTML = `<span class="text-slate-400 text-xs">No stat point dropped this round (${(dropRate * 100)}% chance). Keep fighting!</span>`;
    }
  } else {
    title.className = "text-xl font-black text-red-500";
    title.innerHTML = `<i class="fa-solid fa-skull-crossbones"></i> DEFEATED`;
    sub.textContent = `Your battle card suffered critical damage.`;
    reward.innerHTML = `<span class="text-slate-500 text-xs">Adjust your stats distribution and return to combat!</span>`;
  }
}

function closeCombatResult() {
  cancelSearch();
}

/* =================================================================
   5. PVP BATTLE ARENA (10 QUEUES & REFRESHABLE 0-BET SEATS)
   =================================================================
   Rules:
   - ONLY Live Players have real monetary bets (> ₱0).
   - Seats with 0 bets (open/practice) are refreshed on button click.
   - Live players with active bets are preserved!
   - Match Restriction: User can duel ONLY enemies within ±5 of their total stats!
   ================================================================= */

function selectArenaTier(tierKey) {
  gameState.pvp.currentTier = tierKey;
  
  ['newbie', 'master', 'pro'].forEach(t => {
    const btn = document.getElementById(`arenaTierBtn-${t}`);
    if (t === tierKey) {
      btn.className = `cursor-pointer border-2 ${t === 'newbie' ? 'border-cyan-500' : t === 'master' ? 'border-purple-500' : 'border-amber-500'} bg-slate-900/90 rounded-2xl p-4 transition shadow-lg`;
    } else {
      btn.className = "cursor-pointer border border-slate-800 bg-slate-900/60 rounded-2xl p-4 transition shadow-lg hover:border-slate-700";
    }
  });

  renderArenaSeats();
}

function initArenaQueues() {
  ['newbie', 'master', 'pro'].forEach(tier => {
    gameState.pvp.queues[tier] = [];
    for (let i = 1; i <= 10; i++) {
      gameState.pvp.queues[tier].push(createZeroBetSeat(i, tier));
    }
  });
}

function createZeroBetSeat(seatNum, tier) {
  const myTotalStats = getTotalAllocatedPoints();
  const practiceNames = ["Sparring Gladiator", "Training Duelist", "Open Challenger", "Practice Fighter"];
  const isOccupied = seatNum <= 4;
  const name = isOccupied ? practiceNames[(seatNum - 1) % practiceNames.length] : "Open Seat";
  
  // Generate stats nearby player stats (some within +-5, some slightly higher)
  const statVariance = (seatNum % 2 === 0) ? (seatNum - 2) : -(seatNum - 1);
  let seatStats = Math.max(15, myTotalStats + statVariance);
  if (tier === 'master' && seatStats > 500) seatStats = 490;
  if (tier === 'newbie' && seatStats > 100) seatStats = 95;

  return {
    seatNumber: seatNum,
    occupied: isOccupied,
    isSelf: false,
    isLivePlayer: false, // NO live player, bet is 0
    playerName: name,
    statsTotal: isOccupied ? seatStats : 0,
    bet: 0, // STRICTLY 0 BETS FOR PRACTICE/OPEN SEATS
    tax: TIER_RULES[tier].tax
  };
}

function renderArenaSeats() {
  const grid = document.getElementById('arenaSeatsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  
  const tier = gameState.pvp.currentTier;
  const queue = gameState.pvp.queues[tier] || [];
  const playerStats = getTotalAllocatedPoints();

  queue.forEach(seat => {
    const card = document.createElement('div');

    if (seat.occupied) {
      const isLive = seat.bet > 0 || seat.isSelf;
      const statDiff = Math.abs(playerStats - seat.statsTotal);
      const isEligibleMatch = statDiff <= 5;

      card.className = `bg-slate-950 border ${isLive ? 'border-emerald-500/80 shadow-lg shadow-emerald-950/40' : 'border-slate-800'} rounded-xl p-3 flex flex-col justify-between transition relative overflow-hidden group`;
      
      card.innerHTML = `
        <div class="flex items-center justify-between text-[11px] mb-2">
          <span class="text-slate-400 font-mono">SEAT #${seat.seatNumber}</span>
          <span class="px-1.5 py-0.2 rounded text-[10px] font-bold ${seat.isSelf ? 'bg-cyan-950 text-cyan-300 border border-cyan-700' : isLive ? 'bg-emerald-950 text-emerald-300 border border-emerald-700 animate-pulse' : 'bg-slate-800 text-slate-400'}">
            ${seat.isSelf ? 'YOU' : isLive ? 'LIVE PLAYER' : '0-BET SPAR'}
          </span>
        </div>

        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-sm ${seat.isSelf ? 'text-cyan-400' : isLive ? 'text-emerald-400' : 'text-slate-400'}">
            <i class="fa-solid ${isLive ? 'fa-user-ninja' : 'fa-robot'}"></i>
          </div>
          <div class="overflow-hidden">
            <div class="font-bold text-xs text-white truncate">${seat.playerName}</div>
            <div class="text-[10px] font-mono ${isEligibleMatch ? 'text-emerald-400 font-bold' : 'text-amber-400'}">
              Stats: ${seat.statsTotal} pts ${seat.isSelf ? '' : isEligibleMatch ? ' (±' + statDiff + ' Match)' : ' (Outside ±5)'}
            </div>
          </div>
        </div>

        <div class="border-t border-slate-900 pt-2 flex items-center justify-between text-xs">
          <span class="font-bold font-mono ${seat.bet > 0 ? 'text-emerald-400' : 'text-slate-400'}">
            ${seat.bet > 0 ? `₱${seat.bet.toFixed(2)}` : '₱0.00 (Spar)'}
          </span>
          ${seat.isSelf ? `
            <button onclick="leaveArenaSeat(${seat.seatNumber})" class="text-[10px] text-red-400 hover:underline">Leave</button>
          ` : `
            <button onclick="challengeArenaSeat(${seat.seatNumber})" class="px-2.5 py-1 ${isEligibleMatch ? 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'} rounded text-[10px] font-black uppercase tracking-wider transition">
              ${isEligibleMatch ? 'Fight' : 'Locked (±5)'}
            </button>
          `}
        </div>
      `;
    } else {
      card.className = "bg-slate-950/40 border-2 border-dashed border-slate-800 hover:border-emerald-600/60 rounded-xl p-3 flex flex-col items-center justify-center text-center cursor-pointer min-h-[110px] transition group";
      card.onclick = () => openHostSeatModal(seat.seatNumber);
      card.innerHTML = `
        <i class="fa-solid fa-chair text-slate-700 group-hover:text-emerald-400 text-xl mb-1 transition"></i>
        <span class="text-[11px] font-bold text-slate-400 group-hover:text-emerald-300">Seat #${seat.seatNumber}</span>
        <span class="text-[9px] text-slate-500 uppercase tracking-wide">Click to Sit</span>
      `;
    }
    grid.appendChild(card);
  });
}

// REFRESH ENGINE: Updates ONLY 0-bet seats; PRESERVES live player seats with real bets!
function refreshArenaQueue() {
  const tier = gameState.pvp.currentTier;
  const queue = gameState.pvp.queues[tier];

  let refreshedCount = 0;
  let preservedCount = 0;

  queue.forEach((seat, idx) => {
    if (seat.occupied && (seat.bet > 0 || seat.isSelf)) {
      preservedCount++;
    } else {
      queue[idx] = createZeroBetSeat(seat.seatNumber, tier);
      refreshedCount++;
    }
  });

  renderArenaSeats();
  showToast(`Refreshed ${refreshedCount} open (0-bet) seats (${preservedCount} live player bets preserved)!`, "success");
}

function openHostSeatModal(preferredSeatNum) {
  const tier = gameState.pvp.currentTier;
  const rule = TIER_RULES[tier];
  const playerStatTotal = getTotalAllocatedPoints();

  if (tier === 'newbie' && playerStatTotal > 100) {
    showToast("Your stats exceed 100! Please battle in Master or Pro tier.", "error");
    return;
  }
  if (tier === 'master' && playerStatTotal > 500) {
    showToast("Your stats exceed 500! Please battle in Pro tier.", "error");
    return;
  }
  if (tier === 'pro' && playerStatTotal < 500) {
    showToast("Pro Tier requires at least 500 stats to join!", "error");
    return;
  }

  document.getElementById('hostTierInput').value = `${rule.name} (Max ${rule.maxStat === Infinity ? '500+' : rule.maxStat} Stats)`;
  document.getElementById('hostWagerLimitsText').textContent = `Allowed range: ₱${rule.minBet} - ₱${rule.maxBet}`;
  document.getElementById('hostTaxText').textContent = `₱${rule.tax.toFixed(2)}`;
  document.getElementById('hostMyBalance').textContent = `₱${gameState.player.balance.toFixed(2)}`;
  
  const betInput = document.getElementById('hostBetInput');
  betInput.min = rule.minBet;
  betInput.max = rule.maxBet;
  betInput.value = rule.minBet;

  betInput.oninput = () => {
    const bet = parseFloat(betInput.value) || 0;
    const totalPot = Math.max(0, (bet * 2) - rule.tax);
    document.getElementById('hostPotText').textContent = `₱${totalPot.toFixed(2)}`;
  };
  betInput.oninput();

  window.selectedSeatForHosting = preferredSeatNum || null;
  document.getElementById('hostSeatModal').classList.remove('hidden');
}

function confirmHostSeat() {
  const tier = gameState.pvp.currentTier;
  const rule = TIER_RULES[tier];
  const bet = parseFloat(document.getElementById('hostBetInput').value) || 0;

  if (bet < rule.minBet || bet > rule.maxBet) {
    showToast(`Bet must be between ₱${rule.minBet} and ₱${rule.maxBet}`, "error");
    return;
  }

  if (gameState.player.balance < bet) {
    showToast("Insufficient GCash credits! Please deposit via Cashier.", "amber");
    return;
  }

  const queue = gameState.pvp.queues[tier];
  let seatIdx = -1;
  if (window.selectedSeatForHosting) {
    seatIdx = queue.findIndex(s => s.seatNumber === window.selectedSeatForHosting && (!s.occupied || s.bet === 0));
  }
  if (seatIdx === -1) {
    seatIdx = queue.findIndex(s => !s.occupied || s.bet === 0);
  }

  if (seatIdx === -1) {
    showToast("All seats in this tier are occupied by live players!", "amber");
    return;
  }

  gameState.player.balance -= bet;

  queue[seatIdx] = {
    seatNumber: queue[seatIdx].seatNumber,
    occupied: true,
    isSelf: true,
    isLivePlayer: true,
    playerName: gameState.player.name,
    statsTotal: getTotalAllocatedPoints(),
    bet: bet,
    tax: rule.tax
  };

  closeModal('hostSeatModal');
  saveState();
  updateUI();
  renderArenaSeats();
  showToast(`Seated at #${queue[seatIdx].seatNumber} with ₱${bet.toFixed(2)} wager!`, "success");
}

function leaveArenaSeat(seatNumber) {
  const tier = gameState.pvp.currentTier;
  const queue = gameState.pvp.queues[tier];
  const seatIdx = queue.findIndex(s => s.seatNumber === seatNumber && s.isSelf);

  if (seatIdx !== -1) {
    const seat = queue[seatIdx];
    gameState.player.balance += seat.bet; // Refund wager
    queue[seatIdx] = createZeroBetSeat(seatNumber, tier);

    saveState();
    updateUI();
    renderArenaSeats();
    showToast("Seat vacated and wager refunded.", "info");
  }
}

function challengeArenaSeat(seatNumber) {
  const tier = gameState.pvp.currentTier;
  const rule = TIER_RULES[tier];
  const opponentSeat = gameState.pvp.queues[tier].find(s => s.seatNumber === seatNumber);

  if (!opponentSeat || !opponentSeat.occupied) return;

  const playerStats = getTotalAllocatedPoints();
  const statDiff = Math.abs(playerStats - opponentSeat.statsTotal);

  // Strict Restriction: ±5 stats limit
  if (statDiff > 5) {
    showToast(`Match locked! Enemy stats (${opponentSeat.statsTotal} pts) must be within ±5 points of your total stats (${playerStats} pts).`, "error");
    return;
  }

  const bet = opponentSeat.bet;
  if (gameState.player.balance < bet) {
    showToast(`You need at least ₱${bet.toFixed(2)} balance to challenge this seat!`, "amber");
    return;
  }

  if (!confirm(`Challenge ${opponentSeat.playerName} (${opponentSeat.statsTotal} stats) for ₱${bet.toFixed(2)} wager? (Match Tax: ₱${rule.tax})`)) {
    return;
  }

  gameState.player.balance -= bet;

  // Switch to Battlefield Monitor for animated combat
  switchTab('battlefield');

  const pStats = getPlayerEffectiveStats();
  const playerFighter = {
    name: gameState.player.name,
    hp: pStats.hp,
    maxHp: pStats.hp,
    dmg: pStats.dmg,
    def: pStats.def,
    regen: pStats.regen,
    crit: pStats.crit,
    spd: pStats.speed
  };

  const oppPoints = opponentSeat.statsTotal;
  const oppFighter = {
    name: opponentSeat.playerName,
    zone: tier,
    icon: "fa-khanda",
    hp: 100 + (Math.floor(oppPoints * 0.3) * 20),
    maxHp: 100 + (Math.floor(oppPoints * 0.3) * 20),
    dmg: 10 + (Math.floor(oppPoints * 0.3) * 4),
    def: 0 + (Math.floor(oppPoints * 0.15) * 10),
    regen: 0 + (Math.floor(oppPoints * 0.1) * 3),
    crit: 5 + (Math.floor(oppPoints * 0.08) * 2),
    spd: 10 + (Math.floor(oppPoints * 0.07) * 3)
  };

  document.getElementById('pveIdleState').classList.add('hidden');
  document.getElementById('pveFoundState').classList.add('hidden');
  document.getElementById('pveCombatStage').classList.remove('hidden');
  document.getElementById('combatResultOverlay').classList.add('hidden');

  const log = document.getElementById('combatLog');
  log.innerHTML = `<div class="text-fuchsia-400 font-bold">>>> PVP ARENA DUEL: ${playerFighter.name} (${playerStats} pts) vs ${oppFighter.name} (${oppPoints} pts) | Bet: ₱${bet.toFixed(2)}</div>`;

  document.getElementById('battlePlayerName').textContent = playerFighter.name;
  document.getElementById('battleEnemyName').textContent = oppFighter.name;
  document.getElementById('battleEnemyAvatarIcon').className = "fa-solid fa-gamepad text-cyan-400";
  document.getElementById('battleEnemyTierBadge').textContent = `PVP - ${tier.toUpperCase()}`;

  runPvpCombat(playerFighter, oppFighter, bet, rule.tax, opponentSeat);
}

function runPvpCombat(player, enemy, bet, tax, opponentSeat) {
  let turn = 1;

  function sync() {
    const pPct = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    const ePct = Math.max(0, Math.min(100, (enemy.hp / enemy.maxHp) * 100));
    document.getElementById('battlePlayerHpBar').style.width = `${pPct}%`;
    document.getElementById('battlePlayerHpText').textContent = `${Math.ceil(player.hp)} / ${player.maxHp} HP`;
    document.getElementById('battleEnemyHpBar').style.width = `${ePct}%`;
    document.getElementById('battleEnemyHpText').textContent = `${Math.ceil(enemy.hp)} / ${enemy.maxHp} HP`;
  }
  sync();

  const timer = setInterval(() => {
    document.getElementById('combatTurnCounter').textContent = `PVP Round ${turn}`;

    if (player.regen > 0 && player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + player.regen);
    if (enemy.regen > 0 && enemy.hp < enemy.maxHp) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regen);
    sync();

    const playerFirst = player.spd >= enemy.spd;
    const first = playerFirst ? player : enemy;
    const second = playerFirst ? enemy : player;

    executeStrike(first, second, playerFirst, () => {
      sync();
      if (second.hp <= 0) {
        clearInterval(timer);
        finishPvpCombat(first === player, bet, tax, opponentSeat);
        return;
      }
      setTimeout(() => {
        executeStrike(second, first, !playerFirst, () => {
          sync();
          if (first.hp <= 0) {
            clearInterval(timer);
            finishPvpCombat(second === player, bet, tax, opponentSeat);
            return;
          }
          turn++;
        });
      }, 350);
    });
  }, 900);
}

function finishPvpCombat(playerWon, bet, tax, opponentSeat) {
  const overlay = document.getElementById('combatResultOverlay');
  const title = document.getElementById('combatResultTitle');
  const sub = document.getElementById('combatResultSub');
  const reward = document.getElementById('combatRewardBox');

  overlay.classList.remove('hidden');
  const winnerTakeAllPot = (bet * 2) - tax;

  if (playerWon) {
    gameState.player.balance += winnerTakeAllPot;
    title.className = "text-xl font-black text-emerald-400";
    title.innerHTML = `🏆 PVP VICTORY - WINNER TAKE ALL!`;
    sub.textContent = `You defeated ${opponentSeat.playerName} in arena combat!`;
    reward.innerHTML = `
      <div class="text-base text-emerald-300 font-extrabold">
        +₱${winnerTakeAllPot.toFixed(2)} Credits Added to Wallet!
      </div>
      <div class="text-[10px] text-slate-400">Total Pot: ₱${(bet * 2).toFixed(2)} (Platform Tax: ₱${tax.toFixed(2)})</div>
    `;
  } else {
    title.className = "text-xl font-black text-red-500";
    title.innerHTML = `💀 PVP DEFEAT`;
    sub.textContent = `${opponentSeat.playerName} won the arena match.`;
    reward.innerHTML = `<span class="text-slate-400 text-xs">Wager ₱${bet.toFixed(2)} claimed by victor. Adjust strategy and return!</span>`;
  }

  // Clear opponent seat
  const tier = gameState.pvp.currentTier;
  const queue = gameState.pvp.queues[tier];
  const idx = queue.findIndex(s => s.seatNumber === opponentSeat.seatNumber);
  if (idx !== -1) {
    queue[idx] = createZeroBetSeat(opponentSeat.seatNumber, tier);
  }

  saveState();
  updateUI();
  renderArenaSeats();
}

/* =================================================================
   6. CASHIER SYSTEM (GCASH DEPOSIT & WITHDRAWAL DEPOSIT LOCK)
   ================================================================= */
function switchCashierTab(tabKey) {
  const depBtn = document.getElementById('cashierTab-deposit');
  const withBtn = document.getElementById('cashierTab-withdraw');
  const depPane = document.getElementById('cashierPane-deposit');
  const withPane = document.getElementById('cashierPane-withdraw');

  if (tabKey === 'deposit') {
    depBtn.className = "flex-1 py-2 border-b-2 border-emerald-400 text-emerald-400 text-center";
    withBtn.className = "flex-1 py-2 border-b-2 border-transparent text-slate-400 hover:text-white text-center";
    depPane.classList.remove('hidden');
    withPane.classList.add('hidden');
  } else {
    withBtn.className = "flex-1 py-2 border-b-2 border-purple-400 text-purple-400 text-center";
    depBtn.className = "flex-1 py-2 border-b-2 border-transparent text-slate-400 hover:text-white text-center";
    withPane.classList.remove('hidden');
    depPane.classList.add('hidden');

    checkWithdrawEligibility();
  }
}

function checkWithdrawEligibility() {
  const banner = document.getElementById('withdrawEligibilityBanner');
  const totalDep = gameState.player.totalDeposited || 0;

  if (totalDep >= 20) {
    banner.className = "p-3 rounded-xl border border-emerald-500/80 bg-emerald-950/60 text-emerald-300 text-xs flex items-center gap-2";
    banner.innerHTML = `<i class="fa-solid fa-circle-check text-base"></i> <div><strong>Cashout Unlocked:</strong> Lifetime approved deposits: ₱${totalDep.toFixed(2)} (Requirement: ₱20.00 Met)</div>`;
  } else {
    banner.className = "p-3 rounded-xl border border-amber-500/80 bg-amber-950/60 text-amber-300 text-xs flex items-center gap-2";
    banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-base"></i> <div><strong>Deposit Requirement Lock:</strong> You must complete at least ₱20 total deposits before withdrawing. Current deposits: ₱${totalDep.toFixed(2)} / ₱20.00</div>`;
  }
}

function handleScreenshotUpload(event) {
  const file = event.target.files[0];
  if (file) {
    document.getElementById('screenshotFileName').innerHTML = `
      <span class="text-emerald-400 font-bold"><i class="fa-solid fa-check"></i> ${file.name}</span>
    `;
    window.selectedScreenshotName = file.name;
  }
}

function submitDepositSlip() {
  const name = document.getElementById('depositSenderNameInput').value.trim();
  const amount = parseFloat(document.getElementById('depositAmountInput').value);
  const ref = document.getElementById('depositRefInput').value.trim();

  if (!name) {
    showToast("Please enter your full sender name!", "error");
    return;
  }
  if (isNaN(amount) || amount < 10) {
    showToast("Minimum deposit amount is ₱10.00!", "error");
    return;
  }
  if (!ref) {
    showToast("Please enter GCash Reference Number!", "error");
    return;
  }

  const depositRecord = {
    id: 'DEP-' + Date.now().toString().slice(-6),
    user: name,
    avatarName: gameState.player.name,
    amount: amount,
    ref: ref,
    screenshot: window.selectedScreenshotName || "gcash_receipt_proof.png",
    dateStr: new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  };

  gameState.admin.pendingDeposits.push(depositRecord);
  saveState();

  document.getElementById('depositSenderNameInput').value = '';
  document.getElementById('depositAmountInput').value = '';
  document.getElementById('depositRefInput').value = '';
  document.getElementById('screenshotFileName').textContent = "Click to upload deposit screenshot receipt";
  window.selectedScreenshotName = null;

  closeModal('walletModal');
  showToast(`Deposit slip of ₱${amount.toFixed(2)} submitted! Pending Admin approval.`, "info");
  renderAdminDashboard();
}

function submitWithdrawRequest() {
  const totalDep = gameState.player.totalDeposited || 0;
  if (totalDep < 20) {
    showToast(`Withdrawal locked! You need at least ₱20 total deposits (Current: ₱${totalDep.toFixed(2)}).`, "error");
    return;
  }

  const amount = parseFloat(document.getElementById('withdrawAmountInput').value);
  const phone = document.getElementById('withdrawNumberInput').value.trim();
  const name = document.getElementById('withdrawNameInput').value.trim();

  if (isNaN(amount) || amount < 10) {
    showToast("Minimum withdrawal is ₱10.00!", "error");
    return;
  }
  if (amount > gameState.player.balance) {
    showToast("Withdrawal amount exceeds your current balance!", "error");
    return;
  }
  if (!phone || !name) {
    showToast("Please provide GCash mobile number & full name!", "error");
    return;
  }

  gameState.player.balance -= amount;

  const withdrawRecord = {
    id: 'WTH-' + Date.now().toString().slice(-6),
    user: gameState.player.name,
    amount: amount,
    phone: phone,
    name: name,
    dateStr: new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  };

  gameState.admin.pendingWithdrawals.push(withdrawRecord);
  saveState();
  updateUI();

  document.getElementById('withdrawAmountInput').value = '';
  document.getElementById('withdrawNumberInput').value = '';
  document.getElementById('withdrawNameInput').value = '';

  closeModal('walletModal');
  showToast(`Withdrawal of ₱${amount.toFixed(2)} queued for cashout processing!`, "success");
  renderAdminDashboard();
}

/* =================================================================
   7. ADMIN MANAGEMENT PORTAL (PASSWORD: Propetas12)
   ================================================================= */
function authenticateAdmin() {
  const pass = document.getElementById('adminPasswordInput').value;
  if (pass === 'Propetas12') { // Exact case match
    gameState.admin.unlocked = true;
    document.getElementById('adminLockScreen').classList.add('hidden');
    document.getElementById('adminDashboardScreen').classList.remove('hidden');
    renderAdminDashboard();
    showToast("Admin session authorized!", "success");
  } else {
    showToast("Invalid Admin Password Key!", "error");
  }
}

function logoutAdmin() {
  gameState.admin.unlocked = false;
  document.getElementById('adminPasswordInput').value = '';
  document.getElementById('adminDashboardScreen').classList.add('hidden');
  document.getElementById('adminLockScreen').classList.remove('hidden');
  showToast("Admin session locked.", "info");
}

function renderAdminDashboard() {
  if (!gameState.admin.unlocked) return;

  // Render Pending Deposits
  const depList = document.getElementById('adminDepositsList');
  depList.innerHTML = '';
  document.getElementById('pendingDepositsCount').textContent = `${gameState.admin.pendingDeposits.length} requests`;

  if (gameState.admin.pendingDeposits.length === 0) {
    depList.innerHTML = `<div class="text-xs text-slate-500 italic p-2">No pending deposit slips.</div>`;
  } else {
    gameState.admin.pendingDeposits.forEach((dep, idx) => {
      const item = document.createElement('div');
      item.className = "bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs";
      item.innerHTML = `
        <div class="flex items-center justify-between font-bold">
          <span class="text-white">${dep.user} (${dep.avatarName})</span>
          <span class="text-emerald-400 font-mono font-black text-sm">₱${dep.amount.toFixed(2)}</span>
        </div>
        <div class="text-[11px] text-slate-400 font-mono flex flex-wrap justify-between gap-2">
          <span>Ref: <strong class="text-amber-300">${dep.ref}</strong></span>
          <span>Date: ${dep.dateStr}</span>
        </div>
        <div class="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-900 pt-1.5 mt-1">
          <span class="text-cyan-400"><i class="fa-solid fa-paperclip"></i> Proof: ${dep.screenshot}</span>
          <div class="flex gap-1.5">
            <button onclick="approveDeposit(${idx})" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold">Approve</button>
            <button onclick="rejectDeposit(${idx})" class="px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white rounded text-[10px]">Reject</button>
          </div>
        </div>
      `;
      depList.appendChild(item);
    });
  }

  // Render Pending Withdrawals
  const withList = document.getElementById('adminWithdrawalsList');
  withList.innerHTML = '';
  document.getElementById('pendingWithdrawalsCount').textContent = `${gameState.admin.pendingWithdrawals.length} requests`;

  if (gameState.admin.pendingWithdrawals.length === 0) {
    withList.innerHTML = `<div class="text-xs text-slate-500 italic p-2">No pending withdrawals.</div>`;
  } else {
    gameState.admin.pendingWithdrawals.forEach((wth, idx) => {
      const item = document.createElement('div');
      item.className = "bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs";
      item.innerHTML = `
        <div>
          <div class="font-bold text-white">${wth.user} - <span class="text-purple-400 font-mono">₱${wth.amount.toFixed(2)}</span></div>
          <div class="text-[10px] text-slate-400 font-mono">${wth.phone} (${wth.name}) • ${wth.dateStr}</div>
        </div>
        <div class="flex gap-1.5">
          <button onclick="approveWithdrawal(${idx})" class="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold">Payout</button>
          <button onclick="rejectWithdrawal(${idx})" class="px-2.5 py-1 bg-red-800 hover:bg-red-700 text-white rounded text-[10px]">Decline</button>
        </div>
      `;
      withList.appendChild(item);
    });
  }
}

function approveDeposit(index) {
  const item = gameState.admin.pendingDeposits[index];
  if (item) {
    gameState.player.balance += item.amount;
    gameState.player.totalDeposited = (gameState.player.totalDeposited || 0) + item.amount;
    
    gameState.admin.pendingDeposits.splice(index, 1);
    saveState();
    updateUI();
    renderAdminDashboard();
    showToast(`Approved deposit of ₱${item.amount.toFixed(2)} for ${item.user}! Total deposited updated to ₱${gameState.player.totalDeposited.toFixed(2)}.`, "success");
  }
}

function rejectDeposit(index) {
  const item = gameState.admin.pendingDeposits.splice(index, 1)[0];
  saveState();
  renderAdminDashboard();
  showToast(`Rejected deposit slip ${item.id}.`, "info");
}

function approveWithdrawal(index) {
  const item = gameState.admin.pendingWithdrawals.splice(index, 1)[0];
  saveState();
  renderAdminDashboard();
  showToast(`Payout of ₱${item.amount.toFixed(2)} marked as sent to GCash ${item.phone}!`, "success");
}

function rejectWithdrawal(index) {
  const item = gameState.admin.pendingWithdrawals.splice(index, 1)[0];
  gameState.player.balance += item.amount; // Refund balance
  saveState();
  updateUI();
  renderAdminDashboard();
  showToast(`Withdrawal declined. ₱${item.amount.toFixed(2)} returned to player wallet.`, "amber");
}

/* =================================================================
   8. UI SYNC & TOAST HELPERS
   ================================================================= */
function updateUI() {
  const st = gameState.player.stats;
  const totalAllocated = getTotalAllocatedPoints();
  const maxPool = getMaxPoolPoints();
  const unallocated = maxPool - totalAllocated;
  const effective = getPlayerEffectiveStats();

  document.getElementById('navBalance').textContent = `₱${gameState.player.balance.toFixed(2)}`;
  document.getElementById('navTotalStats').textContent = `${totalAllocated} pts`;

  document.getElementById('playerAvatarName').textContent = gameState.player.name;
  document.getElementById('cardPlayerStatsSum').textContent = `Allocated: ${totalAllocated} / ${maxPool}`;
  document.getElementById('cardPlayerSpeedDisp').textContent = `${effective.speed.toFixed(1)}% SPD`;
  document.getElementById('playerCardLvl').textContent = Math.max(1, Math.floor(totalAllocated / 10));

  const tierBadge = document.getElementById('playerRankBadge');
  if (totalAllocated <= 100) {
    tierBadge.className = "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider";
    tierBadge.textContent = "NEWBIE TIER";
  } else if (totalAllocated <= 500) {
    tierBadge.className = "bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider";
    tierBadge.textContent = "MASTER TIER";
  } else {
    tierBadge.className = "bg-gradient-to-r from-amber-400 to-red-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded tracking-wider";
    tierBadge.textContent = "PRO CHAMPION";
  }

  document.getElementById('cardHp').textContent = `${effective.hp} HP`;
  document.getElementById('cardDmg').textContent = `${effective.dmg} DMG`;
  document.getElementById('cardDef').textContent = `${effective.def} DEF`;
  document.getElementById('cardRegen').textContent = `${effective.regen} / Turn`;
  document.getElementById('cardCrit').textContent = `${effective.crit.toFixed(1)}%`;
  document.getElementById('cardSpeed').textContent = `${effective.speed.toFixed(1)}%`;

  document.getElementById('unallocatedDisplay').textContent = unallocated;

  ['health', 'damage', 'speed', 'critical', 'defence', 'regeneration'].forEach(k => {
    const pts = st[k] || 0;
    document.getElementById(`statPoints-${k}`).textContent = pts;
  });

  document.getElementById('calcHpTotal').textContent = `${effective.hp} HP`;
  document.getElementById('calcHpFormula').textContent = `Base 100 + (${st.health} × 20)`;

  document.getElementById('calcDmgTotal').textContent = `${effective.dmg} DMG`;
  document.getElementById('calcDmgFormula').textContent = `Base 10 + (${st.damage} × 4)`;

  document.getElementById('calcSpeedTotal').textContent = `${effective.speed.toFixed(1)}%`;
  document.getElementById('calcSpeedFormula').textContent = `Base 10% + (${st.speed} × 3%)`;

  document.getElementById('calcCritTotal').textContent = `${effective.crit.toFixed(1)}%`;
  document.getElementById('calcCritFormula').textContent = `Base 5% + (${st.critical} × 2%)`;

  document.getElementById('calcDefTotal').textContent = `${effective.def} DEF`;
  document.getElementById('calcDefFormula').textContent = `Base 0 + (${st.defence} × 10)`;

  document.getElementById('calcRegenTotal').textContent = `${effective.regen} / turn`;
  document.getElementById('calcRegenFormula').textContent = `Base 0 + (${st.regeneration} × 3)`;

  document.getElementById('modalWalletBalance').textContent = `₱${gameState.player.balance.toFixed(2)}`;
  document.getElementById('modalLifetimeDeposits').textContent = `₱${(gameState.player.totalDeposited || 0).toFixed(2)}`;
}

function switchTab(tabKey) {
  ['profile', 'battlefield', 'arena'].forEach(tab => {
    const content = document.getElementById(`tab-${tab}`);
    const btn = document.getElementById(`tabBtn-${tab}`);
    if (tab === tabKey) {
      content.classList.remove('hidden');
      btn.className = "tab-btn px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-lg shadow-fuchsia-950";
    } else {
      content.classList.add('hidden');
      btn.className = "tab-btn px-4 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition";
    }
  });

  if (tabKey === 'arena') {
    renderArenaSeats();
  }
}

function openWalletModal() {
  document.getElementById('walletModal').classList.remove('hidden');
  checkWithdrawEligibility();
}

function openAdminModal() {
  document.getElementById('adminModal').classList.remove('hidden');
  if (gameState.admin.unlocked) {
    document.getElementById('adminLockScreen').classList.add('hidden');
    document.getElementById('adminDashboardScreen').classList.remove('hidden');
    renderAdminDashboard();
  } else {
    document.getElementById('adminLockScreen').classList.remove('hidden');
    document.getElementById('adminDashboardScreen').classList.add('hidden');
  }
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  
  const colors = {
    success: 'border-emerald-500 bg-slate-900 text-emerald-300',
    error: 'border-red-500 bg-slate-900 text-red-300',
    amber: 'border-amber-500 bg-slate-900 text-amber-300',
    info: 'border-cyan-500 bg-slate-900 text-cyan-300'
  };

  toast.className = `p-3 rounded-xl border text-xs font-semibold shadow-2xl transition transform duration-300 flex items-center gap-2 pointer-events-auto ${colors[type] || colors.info}`;
  toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${message}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}
