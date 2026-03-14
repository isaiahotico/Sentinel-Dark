
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram?.WebApp;

// --- Initialize User ---
let username = "Guest_" + Math.floor(Math.random() * 9999);
if (tg?.initDataUnsafe?.user?.username) {
    username = tg.initDataUnsafe.user.username;
}
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
    document.getElementById('wallet-balance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('quota-info').innerText = `Free: FB(${3-userData.counts.fb}) WEB(${3-userData.counts.web})`;
});

// --- Navigation ---
window.switchTab = (tab) => {
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden-section'));
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active', 'text-yellow-500');
        b.classList.add('text-gray-500');
    });
    document.getElementById('section-' + tab).classList.remove('hidden-section');
    document.getElementById('btn-' + tab).classList.add('active', 'text-yellow-500');
};

window.checkAdminAccess = () => {
    const pw = prompt("Enter Admin Secret:");
    if (pw === "Propetas12") switchTab('admin');
    else alert("Incorrect Access Code");
};

// --- Task Engine ---
let activeTimer;
let timeLeft = 0;
let currentTask = null;
let reloads = 0;
let isTabFocused = true;

document.addEventListener("visibilitychange", () => {
    isFocused = !document.hidden;
    const status = document.getElementById('social-status');
    if (status) {
        status.innerText = isFocused ? "TASK IN PROGRESS..." : "PAUSED - RETURN TO APP";
        status.className = isFocused ? "text-yellow-500 font-bold" : "text-red-500 font-bold";
    }
});

window.startTask = (id, type, url, reward, isAdmin) => {
    // 2-Hour Cooldown for Admin Posts
    if (isAdmin && userData.history[id]) {
        if (Date.now() - userData.history[id] < 7200000) {
            return alert("Cooldown Active! Please return in 2 hours.");
        }
    }

    currentTask = { id, type, reward, isAdmin };
    timeLeft = 15;

    if (type === 'web_visit' || isAdmin) {
        openWebCard(url);
    } else {
        openSocialModal(url);
    }
};

// --- Website logic (Reload site 3x) ---
function openWebCard(url) {
    reloads = 0;
    const modal = document.getElementById('web-modal');
    const frame = document.getElementById('web-frame');
    const timerBox = document.getElementById('web-timer');
    const status = document.getElementById('load-status');
    const overlay = document.getElementById('web-overlay');

    modal.classList.remove('hidden');
    frame.src = url;
    overlay.classList.remove('hidden');
    timerBox.innerText = "TIMER LOCKED";
    status.innerText = "RELOADS: 0/3";
}

window.reloadWebCard = () => {
    reloads++;
    const frame = document.getElementById('web-frame');
    const timerBox = document.getElementById('web-timer');
    const status = document.getElementById('load-status');
    const overlay = document.getElementById('web-overlay');

    frame.src = frame.src; // Force Iframe reload
    status.innerText = `RELOADS: ${reloads}/3`;

    if (reloads >= 3) {
        overlay.classList.add('hidden');
        activeTimer = setInterval(() => {
            timeLeft--;
            timerBox.innerText = timeLeft + "s";
            if (timeLeft <= 0) {
                clearInterval(activeTimer);
                completeCurrentTask('web-modal');
            }
        }, 1000);
    }
};

// --- Social Tasks Logic ---
function openSocialModal(url) {
    const modal = document.getElementById('social-modal');
    const timerEl = document.getElementById('social-timer');
    modal.classList.remove('hidden');
    window.open(url, '_blank');

    activeTimer = setInterval(() => {
        if (isTabFocused) {
            timeLeft--;
            timerEl.innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(activeTimer);
                completeCurrentTask('social-modal');
            }
        }
    }, 1000);
}

async function completeCurrentTask(modalId) {
    const { id, reward } = currentTask;
    document.getElementById(modalId).classList.add('hidden');
    
    const updates = {};
    updates[`users/${username}/balance`] = userData.balance + reward;
    updates[`users/${username}/history/${id}`] = Date.now();
    
    if (!currentTask.isAdmin) {
        const snap = await get(ref(db, `links/${id}`));
        if (snap.exists()) updates[`links/${id}/clicks`] = (snap.val().clicks || 0) + 1;
    }

    await update(ref(db), updates);
    alert(`Success! ₱${reward} added.`);
    currentTask = null;
}

// --- Promotion ---
window.publishCampaign = async () => {
    const type = document.getElementById('promo-type').value;
    const url = document.getElementById('promo-url').value;
    const def = document.getElementById('promo-def').value;

    if (!url || !def) return alert("Fill all fields");

    let isFree = false;
    if (type === 'fb_follow' && userData.counts.fb < 3) isFree = true;
    if (type === 'web_visit' && userData.counts.web < 3) isFree = true;

    if (!isFree && userData.balance < 1) return alert("₱1.00 balance required");

    const newLink = { type, url, definition: def, clicks: 0, reward: 0.02, maxClicks: 100, creator: username };
    const key = push(ref(db, 'links')).key;
    const updates = {};
    updates[`links/${key}`] = newLink;
    if (!isFree) updates[`users/${username}/balance`] = userData.balance - 1;
    
    const countKey = type === 'fb_follow' ? 'fb' : 'web';
    updates[`users/${username}/counts/${countKey}`] = userData.counts[countKey] + 1;

    await update(ref(db), updates);
    alert("Campaign Active!");
    switchTab('earn');
};

// --- Admin Section ---
window.postAdminSponsor = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    if (!url || !def) return;
    const key = push(ref(db, 'links')).key;
    await set(ref(db, `links/${key}`), { 
        url, definition: def, isAdmin: true, reward: 0.021, maxClicks: 100000, clicks: 0, type: 'AD_SPONSOR' 
    });
    alert("Admin Sponsor Active!");
};

// --- Withdrawals ---
window.submitWithdraw = async () => {
    const method = document.getElementById('wd-method').value;
    const acc = document.getElementById('wd-acc').value;
    const amt = parseFloat(document.getElementById('wd-amt').value);

    if (amt < 1 || amt > userData.balance) return alert("Min withdrawal ₱1.00");
    const key = push(ref(db, 'withdrawals')).key;
    await update(ref(db), {
        [`withdrawals/${key}`]: { username, method, account: acc, amount: amt, status: 'pending', time: serverTimestamp() },
        [`users/${username}/balance`]: userData.balance - amt
    });
    alert("Sent for approval!");
};

onValue(ref(db, 'withdrawals'), (snap) => {
    const list = document.getElementById('admin-wd-list');
    list.innerHTML = "";
    if (!snap.exists()) return;
    Object.keys(snap.val()).forEach(id => {
        const w = snap.val()[id];
        if (w.status !== 'pending') return;
        const div = document.createElement('div');
        div.className = "bg-black p-3 rounded-lg flex justify-between items-center text-[10px]";
        div.innerHTML = `
            <span>@${w.username} - ₱${w.amount} (${w.method})</span>
            <div class="flex gap-2">
                <button onclick="processWD('${id}', true)" class="bg-green-600 px-2 py-1 rounded">Approve</button>
                <button onclick="processWD('${id}', false)" class="bg-red-600 px-2 py-1 rounded">Reject</button>
            </div>
        `;
        list.appendChild(div);
    });
});

window.processWD = async (id, approve) => {
    const snap = await get(ref(db, `withdrawals/${id}`));
    const w = snap.val();
    if (!approve) await update(ref(db, `users/${w.username}`), { balance: userData.balance + w.amount });
    await update(ref(db, `withdrawals/${id}`), { status: approve ? 'approved' : 'rejected' });
};

// --- Earn Rendering ---
onValue(ref(db, 'links'), (snap) => {
    const adminCont = document.getElementById('admin-links');
    const userCont = document.getElementById('user-links');
    adminCont.innerHTML = ""; userCont.innerHTML = "";
    
    if (!snap.exists()) return;
    Object.keys(snap.val()).forEach(id => {
        const l = snap.val()[id];
        if (!l.isAdmin && (l.clicks >= l.maxClicks || userData.history[id])) return;
        if (l.isAdmin && userData.history[id] && (Date.now() - userData.history[id] < 7200000)) return;

        const card = document.createElement('div');
        card.className = `bg-gray-800 p-4 rounded-xl flex justify-between items-center border border-gray-700 ${l.isAdmin ? 'admin-glow' : ''}`;
        card.innerHTML = `
            <div class="flex-1 pr-3">
                <p class="text-[9px] font-bold text-blue-400 uppercase">${l.type.replace('_',' ')}</p>
                <p class="text-xs font-medium leading-snug line-clamp-1">${l.definition}</p>
            </div>
            <button onclick="startTask('${id}', '${l.type}', '${l.url}', ${l.reward}, ${l.isAdmin || false})" class="bg-blue-600 px-4 py-2 rounded-lg font-black text-xs">₱${l.reward}</button>
        `;
        if (l.isAdmin) adminCont.appendChild(card);
        else userCont.appendChild(card);
    });
});
