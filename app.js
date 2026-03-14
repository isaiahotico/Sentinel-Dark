
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

// --- User Logic ---
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
    document.getElementById('wallet-balance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('promo-info').innerText = `Free Ads: FB(${3-userData.counts.fb}) WEB(${3-userData.counts.web})`;
});

// --- UI Navigation ---
window.switchTab = (tab) => {
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden-section'));
    document.querySelectorAll('button[id^="btn-"]').forEach(b => {
        b.classList.remove('bg-gray-700', 'text-yellow-500');
        b.classList.add('text-gray-500');
    });
    document.getElementById('section-' + tab).classList.remove('hidden-section');
    document.getElementById('btn-' + tab).classList.add('bg-gray-700', 'text-yellow-500');
};

window.authAdmin = () => {
    const pw = prompt("Admin Key:");
    if (pw === "Propetas12") switchTab('admin');
    else alert("Access Denied");
};

// --- Task Processing ---
let activeTimer;
let timeLeft = 0;
let currentTask = null;
let clickCount = 0;
let isTabFocused = true;

document.addEventListener("visibilitychange", () => {
    isTabFocused = !document.hidden;
    const status = document.getElementById('social-status');
    if (status) {
        status.innerText = isTabFocused ? "FOLLOWING TASK..." : "TIMER PAUSED - RETURN TO APP";
        status.className = isTabFocused ? "text-yellow-500 font-bold" : "text-red-500 font-bold";
    }
});

window.startTask = (id, type, url, reward, isAdmin) => {
    if (isAdmin && userData.history[id]) {
        if (Date.now() - userData.history[id] < 7200000) return alert("Cooldown: Return in 2 hours.");
    }
    currentTask = { id, type, reward, isAdmin };
    timeLeft = 15;
    if (type === 'web_visit' || isAdmin) openWebCard(url);
    else openSocialModal(url);
};

// --- Website logic (Shield + 3 Clicks) ---
function openWebCard(url) {
    clickCount = 0;
    const modal = document.getElementById('web-modal');
    const frame = document.getElementById('web-frame');
    const shield = document.getElementById('click-shield');
    const status = document.getElementById('load-status');
    const timerBox = document.getElementById('web-timer');

    modal.classList.remove('hidden');
    frame.src = url;
    shield.classList.remove('hidden');
    status.innerText = "CLICK THE SITE TO RELOAD (0/3)";
    timerBox.innerText = "LOCKED";
}

window.handleSiteClick = () => {
    clickCount++;
    const frame = document.getElementById('web-frame');
    const status = document.getElementById('load-status');
    const shield = document.getElementById('click-shield');
    const timerBox = document.getElementById('web-timer');

    frame.src = frame.src; // Reload
    status.innerText = `CLICK THE SITE TO RELOAD (${clickCount}/3)`;

    if (clickCount >= 3) {
        shield.classList.add('hidden');
        status.innerText = "TIMER RUNNING...";
        activeTimer = setInterval(() => {
            timeLeft--;
            timerBox.innerText = timeLeft + "s";
            if (timeLeft <= 0) {
                clearInterval(activeTimer);
                finalizeTask('web-modal');
            }
        }, 1000);
    }
};

function openSocialModal(url) {
    const modal = document.getElementById('social-modal');
    const display = document.getElementById('social-timer');
    modal.classList.remove('hidden');
    window.open(url, '_blank');
    activeTimer = setInterval(() => {
        if (isTabFocused) {
            timeLeft--;
            display.innerText = timeLeft;
            if (timeLeft <= 0) {
                clearInterval(activeTimer);
                finalizeTask('social-modal');
            }
        }
    }, 1000);
}

async function finalizeTask(modalId) {
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
    alert(`₱${reward} credited!`);
    currentTask = null;
}

// --- Promo and Withdrawals ---
window.publishPromo = async () => {
    const type = document.getElementById('promo-type').value;
    const url = document.getElementById('promo-url').value;
    const def = document.getElementById('promo-def').value;
    if (!url || !def) return alert("Fill all fields");
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
    alert("Sent for approval!");
};

// --- Admin hub ---
window.adminPost = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    if (!url || !def) return;
    const key = push(ref(db, 'links')).key;
    await set(ref(db, `links/${key}`), { url, definition: def, isAdmin: true, reward: 0.021, maxClicks: 100000, clicks: 0, type: 'SPONSOR' });
    alert("Global Sponsor Posted!");
};

onValue(ref(db, 'withdrawals'), (snap) => {
    const list = document.getElementById('admin-wd-list');
    list.innerHTML = "";
    if (!snap.exists()) return;
    Object.keys(snap.val()).forEach(id => {
        const w = snap.val()[id];
        if (w.status !== 'pending') return;
        const div = document.createElement('div');
        div.className = "bg-black p-2 rounded text-[10px] flex justify-between items-center";
        div.innerHTML = `<span>@${w.username} - ₱${w.amount} (${w.method})</span><div class="flex gap-2">
            <button onclick="procWD('${id}', true)" class="bg-green-600 px-1 rounded">✔</button>
            <button onclick="procWD('${id}', false)" class="bg-red-600 px-1 rounded">✖</button></div>`;
        list.appendChild(div);
    });
});

window.procWD = async (id, appv) => {
    const snap = await get(ref(db, `withdrawals/${id}`));
    const w = snap.val();
    if (!appv) await update(ref(db, `users/${w.username}`), { balance: (userData.balance + w.amount) });
    await update(ref(db, `withdrawals/${id}`), { status: appv ? 'approved' : 'rejected' });
};

// --- Rendering ---
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
        card.className = `bg-gray-800 p-4 rounded-xl flex justify-between items-center border border-gray-700 ${l.isAdmin ? 'admin-glow' : ''}`;
        card.innerHTML = `<div class="flex-1 pr-3"><p class="text-[9px] font-bold text-blue-400 uppercase">${l.type.replace('_',' ')}</p>
            <p class="text-xs font-medium leading-snug line-clamp-1">${l.definition}</p></div>
            <button onclick="startTask('${id}', '${l.type}', '${l.url}', ${l.reward}, ${l.isAdmin || false})" class="bg-blue-600 px-4 py-2 rounded-lg font-black text-xs">₱${l.reward}</button>`;
        if (l.isAdmin) admC.appendChild(card); else usrC.appendChild(card);
    });
});
