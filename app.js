
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

// --- DATABASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "facebook-follow-to-follow.firebaseapp.com",
    databaseURL: "https://facebook-follow-to-follow-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facebook-follow-to-follow",
    storageBucket: "facebook-follow-to-follow.firebasestorage.app",
    messagingSenderId: "589427984313",
    appId: "1:589427984313:web:a17b8cc851efde6dd79868"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram?.WebApp;

// --- Initialize User ---
let username = "User_" + Math.floor(Math.random() * 9999);
if (tg?.initDataUnsafe?.user?.username) username = tg.initDataUnsafe.user.username;
document.getElementById('tg-username').innerText = "@" + username;

let userData = { balance: 0, counts: { fb: 0, web: 0, yt: 0 }, history: {} };
const userRef = ref(db, 'users/' + username);

onValue(userRef, (snap) => {
    if (snap.exists()) {
        userData = snap.val();
        if (!userData.counts) userData.counts = { fb: 0, web: 0, yt: 0 };
        if (!userData.history) userData.history = {};
    } else {
        set(userRef, userData);
    }
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(3);
    document.getElementById('wallet-bal').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('promo-quota').innerText = `Free Ads: FB(${3-userData.counts.fb}) WEB(${3-userData.counts.web})`;
});

// --- Tab Navigation ---
window.switchTab = (tab) => {
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden-section'));
    document.querySelectorAll('button[id^="btn-"]').forEach(b => {
        b.classList.remove('bg-gray-700', 'text-yellow-500');
        b.classList.add('text-gray-500');
    });
    document.getElementById('section-' + tab).classList.remove('hidden-section');
    document.getElementById('btn-' + tab).classList.add('bg-gray-700', 'text-yellow-500');
};

window.openAdmin = () => {
    const pw = prompt("Enter Admin Code:");
    if (pw === "Propetas12") switchTab('admin');
    else alert("Unauthorized Access");
};

// --- Execution Core ---
let taskTimer;
let timeLeft = 0;
let currentActive = null;
let reloadCounter = 0;
let isTabFocused = true;

document.addEventListener("visibilitychange", () => {
    isTabFocused = !document.hidden;
    const status = document.getElementById('social-status');
    if (status) {
        status.innerText = isTabFocused ? "TASK VERIFICATION..." : "PAUSED - RETURN TO APP";
        status.className = isTabFocused ? "text-yellow-500 font-bold" : "text-red-500 font-bold";
    }
});

window.startTask = (id, type, url, reward, isAdmin) => {
    // 2-Hour Admin Cooldown Check
    if (isAdmin && userData.history[id]) {
        if (Date.now() - userData.history[id] < 7200000) {
            return alert("Cooldown active! This sponsored site re-opens in 2 hours.");
        }
    }
    
    currentActive = { id, type, reward, isAdmin };
    timeLeft = 15;

    if (type === 'web_visit' || isAdmin) {
        openWebModal(url);
    } else {
        openSocialModal(url);
    }
};

// --- Website logic (Reload on Click x3) ---
function openWebModal(url) {
    reloadCounter = 0;
    const modal = document.getElementById('web-modal');
    const frame = document.getElementById('web-frame');
    const sensor = document.getElementById('interaction-sensor');
    const label = document.getElementById('load-label');
    const timerBox = document.getElementById('web-timer');

    modal.classList.remove('hidden');
    frame.src = url;
    sensor.classList.remove('hidden');
    frame.classList.add('pointer-events-none');
    label.innerText = "Click Site to Reload (0/3)";
    timerBox.innerText = "LOCKED";
}

window.handleReloadClick = () => {
    reloadCounter++;
    const frame = document.getElementById('web-frame');
    const sensor = document.getElementById('interaction-sensor');
    const label = document.getElementById('load-label');
    const timerBox = document.getElementById('web-timer');

    // Manually reload the site
    frame.src = frame.src;
    label.innerText = `Click Site to Reload (${reloadCounter}/3)`;

    if (reloadCounter >= 3) {
        sensor.classList.add('hidden');
        frame.classList.remove('pointer-events-none');
        label.innerText = "SENSORS ACTIVE - RUNNING";
        
        taskTimer = setInterval(() => {
            timeLeft--;
            timerBox.innerText = timeLeft + "s";
            if (timeLeft <= 0) {
                clearInterval(taskTimer);
                finishTask('web-modal');
            }
        }, 1000);
    }
};

function openSocialModal(url) {
    const modal = document.getElementById('social-modal');
    const timerEl = document.getElementById('social-timer');
    modal.classList.remove('hidden');
    window.open(url, '_blank');
    
    taskTimer = setInterval(() => {
        if (isTabFocused) {
            timeLeft--;
            timerEl.innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(taskTimer);
                finishTask('social-modal');
            }
        }
    }, 1000);
}

async function finishTask(modalId) {
    const { id, reward } = currentActive;
    document.getElementById(modalId).classList.add('hidden');
    
    const updates = {};
    updates[`users/${username}/balance`] = userData.balance + reward;
    updates[`users/${username}/history/${id}`] = Date.now();
    
    if (!currentActive.isAdmin) {
        const snap = await get(ref(db, `links/${id}`));
        if (snap.exists()) updates[`links/${id}/clicks`] = (snap.val().clicks || 0) + 1;
    }

    await update(ref(db), updates);
    alert(`₱${reward} credited! returning to home...`);
    switchTab('earn');
    currentActive = null;
}

// --- Admin Section ---
window.adminPublish = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    if (!url || !def) return;
    const key = push(ref(db, 'links')).key;
    await set(ref(db, `links/${key}`), { 
        url, definition: def, isAdmin: true, reward: 0.021, maxClicks: 100000, clicks: 0, type: 'SPONSOR' 
    });
    alert("Global Sponsored Site Live!");
};

onValue(ref(db, 'withdrawals'), (snap) => {
    const list = document.getElementById('admin-withdrawals');
    list.innerHTML = "";
    if (!snap.exists()) return;
    Object.keys(snap.val()).forEach(id => {
        const w = snap.val()[id];
        if (w.status !== 'pending') return;
        const div = document.createElement('div');
        div.className = "bg-black/40 p-3 rounded-xl flex justify-between items-center text-[10px] border border-gray-700";
        div.innerHTML = `
            <span>@${w.username} - ₱${w.amount} (${w.method})</span>
            <div class="flex gap-2">
                <button onclick="approveWD('${id}', true)" class="bg-green-600 px-2 py-1 rounded">✔</button>
                <button onclick="approveWD('${id}', false)" class="bg-red-600 px-2 py-1 rounded">✖</button>
            </div>
        `;
        list.appendChild(div);
    });
});

window.approveWD = async (id, approve) => {
    const snap = await get(ref(db, `withdrawals/${id}`));
    const w = snap.val();
    const updates = {};
    updates[`withdrawals/${id}/status`] = approve ? 'approved' : 'rejected';
    if (!approve) {
        const uSnap = await get(ref(db, `users/${w.username}`));
        updates[`users/${w.username}/balance`] = (uSnap.val().balance || 0) + w.amount;
    }
    await update(ref(db), updates);
};

// --- Withdrawals ---
window.requestCashout = async () => {
    const method = document.getElementById('wd-method').value;
    const acc = document.getElementById('wd-acc').value;
    const amt = parseFloat(document.getElementById('wd-amt').value);
    if (amt < 1 || amt > userData.balance) return alert("Min: ₱1.00");
    const key = push(ref(db, 'withdrawals')).key;
    await update(ref(db), {
        [`withdrawals/${key}`]: { username, method, account: acc, amount: amt, status: 'pending', time: serverTimestamp() },
        [`users/${username}/balance`]: userData.balance - amt
    });
    alert("Request submitted for manual review.");
};

// --- Promotion ---
window.createCampaign = async () => {
    const type = document.getElementById('promo-type').value;
    const url = document.getElementById('promo-url').value;
    const def = document.getElementById('promo-def').value;
    if (!url || !def) return alert("Fill all details");
    let isFree = (type === 'fb_follow' && userData.counts.fb < 3) || (type === 'web_visit' && userData.counts.web < 3);
    if (!isFree && userData.balance < 1) return alert("₱1.00 balance required");

    const key = push(ref(db, 'links')).key;
    const updates = {};
    updates[`links/${key}`] = { type, url, definition: def, reward: 0.02, maxClicks: 100, clicks: 0, creator: username };
    if (!isFree) updates[`users/${username}/balance`] = userData.balance - 1;
    updates[`users/${username}/counts/${type === 'fb_follow' ? 'fb' : 'web'}`] = (userData.counts[type === 'fb_follow' ? 'fb' : 'web'] || 0) + 1;
    await update(ref(db), updates);
    alert("Campaign Active!");
    switchTab('earn');
};

// --- Feed Rendering ---
onValue(ref(db, 'links'), (snap) => {
    const admC = document.getElementById('admin-links');
    const usrC = document.getElementById('user-links');
    admC.innerHTML = ""; usrC.innerHTML = "";
    if (!snap.exists()) return;
    Object.keys(snap.val()).forEach(id => {
        const l = snap.val()[id];
        if (!l.isAdmin && (l.clicks >= l.maxClicks || userData.history[id])) return;
        if (l.isAdmin && userData.history[id] && (Date.now() - userData.history[id] < 7200000)) return;
        
        const card = document.createElement('div');
        card.className = `bg-gray-800 p-4 rounded-2xl flex justify-between items-center border border-gray-700 ${l.isAdmin ? 'admin-glow' : ''}`;
        card.innerHTML = `
            <div class="flex-1 pr-3">
                <p class="text-[9px] font-black text-blue-400 uppercase tracking-widest">${l.type.replace('_',' ')}</p>
                <p class="text-xs font-semibold leading-snug line-clamp-1">${l.definition}</p>
            </div>
            <button onclick="startTask('${id}', '${l.type}', '${l.url}', ${l.reward}, ${l.isAdmin || false})" class="bg-blue-600 px-5 py-2.5 rounded-xl font-black text-xs">₱${l.reward}</button>
        `;
        if (l.isAdmin) admC.appendChild(card); else usrC.appendChild(card);
    });
});
