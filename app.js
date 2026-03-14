
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

// --- Initialization ---
let username = "User_" + Math.floor(Math.random() * 9999);
if (tg?.initDataUnsafe?.user?.username) username = tg.initDataUnsafe.user.username;
document.getElementById('tg-username').innerText = "@" + username;

let userData = { balance: 0, counts: { fb:0, web:0, yt:0 }, history: {} };
const userRef = ref(db, 'users/' + username);

onValue(userRef, (snap) => {
    if (snap.exists()) {
        userData = snap.val();
        if (!userData.counts) userData.counts = { fb:0, web:0, yt:0 };
        if (!userData.history) userData.history = {};
    } else {
        set(userRef, userData);
    }
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(3);
    document.getElementById('wallet-bal').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('quota-msg').innerText = `Free: FB(${3-userData.counts.fb}) WEB(${3-userData.counts.web}) YT(${5-userData.counts.yt})`;
});

// --- Navigation ---
window.showTab = (tab) => {
    document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.add('hidden-section'));
    document.getElementById('tab-' + tab).classList.remove('hidden-section');
    document.querySelectorAll('nav button, div.flex button').forEach(b => b.classList.remove('bg-gray-700', 'text-yellow-500'));
};

window.promptAdmin = () => {
    const pw = prompt("Admin Password:");
    if (pw === "Propetas12") showTab('admin');
    else alert("Incorrect Password");
};

// --- Task Engine ---
let timer;
let activeTask = null;
let webClicks = 0;
let isFocused = true;

window.startTask = (id, type, url, reward, definition, isAdmin) => {
    if (isAdmin && userData.history[id]) {
        if (Date.now() - userData.history[id] < 7200000) return alert("Cooldown: Wait 2 hours");
    }

    activeTask = { id, type, reward, isAdmin };
    if (type === 'web_visit' || isAdmin) openWeb(url, definition);
    else openSocial(url);
};

// --- Web Task (3-Click Interaction) ---
function openWeb(url, def) {
    const modal = document.getElementById('web-modal');
    const frame = document.getElementById('web-frame');
    const shield = document.getElementById('click-shield');
    const status = document.getElementById('web-status');
    const timerEl = document.getElementById('web-timer');
    
    webClicks = 0;
    modal.classList.remove('hidden');
    frame.src = url;
    status.innerText = `INTERACT TO START (0/3)`;
    timerEl.innerText = "15s";

    shield.onclick = () => {
        webClicks++;
        status.innerText = `INTERACT TO START (${webClicks}/3)`;
        if (webClicks >= 3) {
            shield.classList.add('hidden');
            status.innerText = "TIMER RUNNING";
            let sec = 15;
            timer = setInterval(() => {
                sec--;
                timerEl.innerText = sec + "s";
                if (sec <= 0) {
                    clearInterval(timer);
                    modal.classList.add('hidden');
                    frame.src = "";
                    shield.classList.remove('hidden');
                    finishTask();
                }
            }, 1000);
        }
    };
}

// --- Social Task (Auto-Pause) ---
function openSocial(url) {
    const modal = document.getElementById('social-modal');
    const timerEl = document.getElementById('social-timer');
    let sec = (activeTask.type === 'yt_watch' || activeTask.type === 'yt_sub') ? 30 : 15;
    
    modal.classList.remove('hidden');
    window.open(url, '_blank');

    timer = setInterval(() => {
        if (isFocused) {
            sec--;
            timerEl.innerText = sec;
            if (sec <= 0) {
                clearInterval(timer);
                modal.classList.add('hidden');
                finishTask();
            }
        }
    }, 1000);
}

document.addEventListener("visibilitychange", () => {
    isFocused = !document.hidden;
    const status = document.getElementById('social-status');
    if (status) {
        status.innerText = isFocused ? "TASK RUNNING..." : "PAUSED - RETURN TO APP";
        status.style.color = isFocused ? "#fbbf24" : "#ef4444";
    }
});

async function finishTask() {
    const { id, reward } = activeTask;
    const updates = {};
    updates[`users/${username}/balance`] = userData.balance + reward;
    updates[`users/${username}/history/${id}`] = Date.now();
    
    if (!activeTask.isAdmin) {
        const snap = await get(ref(db, `links/${id}`));
        if (snap.exists()) updates[`links/${id}/clicks`] = snap.val().clicks + 1;
    }

    await update(ref(db), updates);
    alert("Success! Reward: ₱" + reward);
    activeTask = null;
}

// --- List Logic ---
onValue(ref(db, 'links'), (snap) => {
    const adminDiv = document.getElementById('admin-links');
    const userDiv = document.getElementById('user-links');
    adminDiv.innerHTML = ""; userDiv.innerHTML = "";
    
    if (!snap.exists()) return;
    Object.keys(snap.val()).forEach(id => {
        const l = snap.val()[id];
        if (!l.isAdmin && (l.clicks >= l.maxClicks || userData.history[id])) return;
        if (l.isAdmin && userData.history[id] && (Date.now() - userData.history[id] < 7200000)) return;

        const card = document.createElement('div');
        card.className = `bg-gray-800 p-4 rounded-xl flex justify-between items-center border border-gray-700 ${l.isAdmin ? 'admin-glow' : ''}`;
        card.innerHTML = `
            <div class="flex-1 pr-3">
                <p class="text-[9px] font-bold text-blue-400 uppercase">${l.type}</p>
                <p class="text-xs font-medium">${l.definition}</p>
            </div>
            <button onclick="startTask('${id}', '${l.type}', '${l.url}', ${l.reward}, '${l.definition}', ${l.isAdmin || false})" class="bg-blue-600 px-4 py-2 rounded-lg font-bold text-xs shrink-0">₱${l.reward}</button>
        `;
        if (l.isAdmin) adminDiv.appendChild(card);
        else userDiv.appendChild(card);
    });
});

// --- Create Link ---
window.submitLink = async () => {
    const type = document.getElementById('link-type').value;
    const url = document.getElementById('link-url').value;
    const def = document.getElementById('link-def').value;
    if (!url || !def) return alert("Fill all fields");

    let isFree = false;
    if (type === 'fb_follow' && userData.counts.fb < 3) isFree = true;
    if (type === 'web_visit' && userData.counts.web < 3) isFree = true;
    if (type.startsWith('yt') && userData.counts.yt < 5) isFree = true;

    if (!isFree && userData.balance < 1) return alert("Need ₱1.00 balance");

    const newLink = { type, url, definition: def, reward: 0.02, maxClicks: 100, clicks: 0, creator: username };
    if (type === 'yt_watch') { newLink.reward = 0.01; newLink.maxClicks = isFree ? 100 : 120; }
    if (type === 'yt_sub') { newLink.reward = 0.03; newLink.maxClicks = isFree ? 50 : 65; }

    const key = push(ref(db, 'links')).key;
    const updates = {};
    updates[`links/${key}`] = newLink;
    if (!isFree) updates[`users/${username}/balance`] = userData.balance - 1;
    
    const countKey = type === 'fb_follow' ? 'fb' : type === 'web_visit' ? 'web' : 'yt';
    updates[`users/${username}/counts/${countKey}`] = userData.counts[countKey] + 1;

    await update(ref(db), updates);
    alert("Published!");
};

// --- Admin Section ---
window.createAdminLink = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    if (!url || !def) return;
    const key = push(ref(db, 'links')).key;
    await set(ref(db, `links/${key}`), { url, definition: def, type: 'SPONSOR', reward: 0.021, maxClicks: 100000, clicks: 0, isAdmin: true });
    alert("Global Sponsor Posted");
};

// --- Withdrawals ---
window.requestWD = async () => {
    const method = document.getElementById('wd-method').value;
    const account = document.getElementById('wd-acc').value;
    const amount = parseFloat(document.getElementById('wd-amt').value);

    if (amount < 1 || amount > userData.balance) return alert("Invalid amount");
    const key = push(ref(db, 'withdrawals')).key;
    await update(ref(db), {
        [`withdrawals/${key}`]: { username, method, account, amount, status: 'pending' },
        [`users/${username}/balance`]: userData.balance - amount
    });
    alert("Request Sent!");
};

onValue(ref(db, 'withdrawals'), (snap) => {
    const list = document.getElementById('admin-wd-list');
    list.innerHTML = "";
    if (!snap.exists()) return;
    Object.keys(snap.val()).forEach(id => {
        const w = snap.val()[id];
        if (w.status !== 'pending') return;
        const div = document.createElement('div');
        div.className = "bg-gray-700 p-2 rounded text-[10px] flex justify-between items-center";
        div.innerHTML = `
            <span>${w.username}: ₱${w.amount} (${w.method})</span>
            <div class="flex gap-1">
                <button onclick="approveWD('${id}', true)" class="bg-green-600 px-2 py-1 rounded">✔</button>
                <button onclick="approveWD('${id}', false)" class="bg-red-600 px-2 py-1 rounded">✖</button>
            </div>
        `;
        list.appendChild(div);
    });
});

window.approveWD = async (id, approved) => {
    if (!approved) {
        const snap = await get(ref(db, `withdrawals/${id}`));
        const w = snap.val();
        await update(ref(db, `users/${w.username}`), { balance: userData.balance + w.amount });
    }
    await update(ref(db, `withdrawals/${id}`), { status: approved ? 'approved' : 'rejected' });
};
