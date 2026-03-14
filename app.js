
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
    updateBalanceDisplay();
});

function updateBalanceDisplay() {
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(3);
    document.getElementById('wallet-bal').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('quota-msg').innerText = `Free: FB(${3-userData.counts.fb}) WEB(${3-userData.counts.web}) YT(${5-userData.counts.yt})`;
}

// --- Navigation ---
window.showTab = (tab) => {
    document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.add('hidden-section'));
    document.getElementById('tab-' + tab).classList.remove('hidden-section');
    
    document.querySelectorAll('div.flex button').forEach(b => {
        b.classList.remove('bg-gray-700', 'text-yellow-500');
    });
    const activeBtn = document.getElementById('btn-' + tab);
    if(activeBtn) activeBtn.classList.add('bg-gray-700', 'text-yellow-500');
};

window.promptAdmin = () => {
    const pw = prompt("Enter Admin Access Code:");
    if (pw === "Propetas12") showTab('admin');
    else alert("Access Denied");
};

// --- Task Processing ---
let timer;
let activeTask = null;
let interactionCount = 0;
let isTabFocused = true;

window.startTask = (id, type, url, reward, definition, isAdmin) => {
    // 2-Hour Cooldown for Admin links
    if (isAdmin && userData.history[id]) {
        if (Date.now() - userData.history[id] < 7200000) {
            return alert("Cooldown active. Return in 2 hours.");
        }
    }

    activeTask = { id, type, reward, isAdmin };
    if (type === 'web_visit' || isAdmin) openWebCard(url);
    else openSocialTask(url);
};

// --- Web Visit (3-Interaction Verification) ---
function openWebCard(url) {
    const modal = document.getElementById('web-modal');
    const frame = document.getElementById('web-frame');
    const shield = document.getElementById('click-shield');
    const status = document.getElementById('web-status');
    const timerEl = document.getElementById('web-timer');
    const clickHint = document.getElementById('click-count');
    
    interactionCount = 0;
    modal.classList.remove('hidden');
    frame.src = url;
    shield.classList.remove('hidden');
    status.innerText = "CLICK SITE 3 TIMES TO START";
    clickHint.innerText = "Remaining: 3";
    timerEl.innerText = "15s";

    shield.onclick = () => {
        interactionCount++;
        clickHint.innerText = `Remaining: ${3 - interactionCount}`;
        if (interactionCount >= 3) {
            shield.classList.add('hidden');
            status.innerText = "TIMER RUNNING...";
            startTimer(15, timerEl, () => {
                modal.classList.add('hidden');
                frame.src = "";
                finishTask();
            });
        }
    };
}

// --- Social Tasks (Auto-Pause Detection) ---
function openSocialTask(url) {
    const modal = document.getElementById('social-modal');
    const timerEl = document.getElementById('social-timer');
    let seconds = (activeTask.type.startsWith('yt')) ? 30 : 15;
    
    modal.classList.remove('hidden');
    window.open(url, '_blank');

    startTimer(seconds, timerEl, () => {
        modal.classList.add('hidden');
        finishTask();
    });
}

function startTimer(seconds, display, callback) {
    timer = setInterval(() => {
        if (isTabFocused) {
            seconds--;
            display.innerText = seconds + (display.id === 'web-timer' ? 's' : '');
            if (seconds <= 0) {
                clearInterval(timer);
                callback();
            }
        }
    }, 1000);
}

document.addEventListener("visibilitychange", () => {
    isTabFocused = !document.hidden;
    const status = document.getElementById('social-status');
    if (status) {
        status.innerText = isTabFocused ? "TASK RUNNING..." : "TIMER PAUSED - RETURN TO APP";
        status.className = isTabFocused ? "text-yellow-500 font-bold" : "text-red-500 font-bold";
    }
});

async function finishTask() {
    const { id, reward } = activeTask;
    const updates = {};
    updates[`users/${username}/balance`] = userData.balance + reward;
    updates[`users/${username}/history/${id}`] = Date.now();
    
    if (!activeTask.isAdmin) {
        const snap = await get(ref(db, `links/${id}`));
        if (snap.exists()) updates[`links/${id}/clicks`] = (snap.val().clicks || 0) + 1;
    }

    await update(ref(db), updates);
    alert(`Reward: ₱${reward} credited!`);
    activeTask = null;
}

// --- List Rendering ---
onValue(ref(db, 'links'), (snap) => {
    const adminDiv = document.getElementById('admin-links');
    const userDiv = document.getElementById('user-links');
    adminDiv.innerHTML = ""; userDiv.innerHTML = "";
    
    if (!snap.exists()) return;
    const data = snap.val();
    
    Object.keys(data).forEach(id => {
        const l = data[id];
        // Rules for visibility
        if (!l.isAdmin && (l.clicks >= l.maxClicks || (userData.history && userData.history[id]))) return;
        if (l.isAdmin && userData.history && userData.history[id] && (Date.now() - userData.history[id] < 7200000)) return;

        const card = document.createElement('div');
        card.className = `bg-gray-800 p-4 rounded-xl flex justify-between items-center border border-gray-700 transition-transform active:scale-95 ${l.isAdmin ? 'admin-glow' : ''}`;
        card.innerHTML = `
            <div class="flex-1 pr-3">
                <p class="text-[9px] font-black text-blue-400 uppercase tracking-widest">${l.isAdmin ? '🔥 Sponsored' : l.type.replace('_',' ')}</p>
                <p class="text-xs font-semibold line-clamp-1">${l.definition}</p>
            </div>
            <button onclick="startTask('${id}', '${l.type}', '${l.url}', ${l.reward}, '${l.definition}', ${l.isAdmin || false})" 
                class="bg-blue-600 px-4 py-2 rounded-lg font-black text-xs shrink-0 shadow-lg shadow-blue-900/30">
                ₱${l.reward}
            </button>
        `;
        if (l.isAdmin) adminDiv.appendChild(card);
        else userDiv.appendChild(card);
    });
});

// --- Promote / Submit ---
window.submitLink = async () => {
    const type = document.getElementById('link-type').value;
    const url = document.getElementById('link-url').value;
    const def = document.getElementById('link-def').value;
    if (!url || !def) return alert("Please fill all fields");

    let isFree = false;
    const counts = userData.counts;
    if (type === 'fb_follow' && counts.fb < 3) isFree = true;
    if (type === 'web_visit' && counts.web < 3) isFree = true;
    if (type.startsWith('yt') && counts.yt < 5) isFree = true;

    if (!isFree && userData.balance < 1) return alert("Minimum ₱1.00 balance required for paid links.");

    const newLink = { type, url, definition: def, reward: 0.02, maxClicks: 100, clicks: 0, creator: username };
    if (type === 'yt_watch') { newLink.reward = 0.01; newLink.maxClicks = isFree ? 100 : 120; }
    if (type === 'yt_sub') { newLink.reward = 0.03; newLink.maxClicks = isFree ? 50 : 65; }

    const key = push(ref(db, 'links')).key;
    const updates = {};
    updates[`links/${key}`] = newLink;
    if (!isFree) updates[`users/${username}/balance`] = userData.balance - 1;
    
    const countKey = type === 'fb_follow' ? 'fb' : type === 'web_visit' ? 'web' : 'yt';
    updates[`users/${username}/counts/${countKey}`] = (counts[countKey] || 0) + 1;

    await update(ref(db), updates);
    alert("Campaign Live!");
    showTab('earn');
};

// --- Admin Features ---
window.createAdminLink = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    if (!url || !def) return alert("Fill admin details");
    const key = push(ref(db, 'links')).key;
    await set(ref(db, `links/${key}`), { 
        url, definition: def, type: 'SPONSOR', reward: 0.021, 
        maxClicks: 100000, clicks: 0, isAdmin: true 
    });
    alert("Sponsored link added globally!");
};

// --- Withdrawal System ---
window.requestWD = async () => {
    const method = document.getElementById('wd-method').value;
    const account = document.getElementById('wd-acc').value;
    const amount = parseFloat(document.getElementById('wd-amt').value);

    if (amount < 1 || amount > userData.balance) return alert("Invalid amount. Min ₱1.");
    if (!account) return alert("Enter account details");

    const key = push(ref(db, 'withdrawals')).key;
    const updates = {};
    updates[`withdrawals/${key}`] = { username, method, account, amount, status: 'pending', time: serverTimestamp() };
    updates[`users/${username}/balance`] = userData.balance - amount;
    
    await update(ref(db), updates);
    alert("Request sent for approval!");
};

onValue(ref(db, 'withdrawals'), (snap) => {
    const list = document.getElementById('admin-wd-list');
    list.innerHTML = "";
    if (!snap.exists()) return;
    Object.keys(snap.val()).forEach(id => {
        const w = snap.val()[id];
        if (w.status !== 'pending') return;
        const div = document.createElement('div');
        div.className = "bg-black/40 p-3 rounded-xl text-[10px] flex justify-between items-center border border-gray-700";
        div.innerHTML = `
            <div class="leading-tight">
                <p class="font-bold text-blue-400">@${w.username}</p>
                <p class="text-gray-400">${w.method}: ${w.account}</p>
                <p class="text-green-500 font-bold">₱${w.amount.toFixed(2)}</p>
            </div>
            <div class="flex gap-2">
                <button onclick="processWD('${id}', true)" class="bg-green-600 p-2 rounded-lg">✔</button>
                <button onclick="processWD('${id}', false)" class="bg-red-600 p-2 rounded-lg">✖</button>
            </div>
        `;
        list.appendChild(div);
    });
});

window.processWD = async (id, approve) => {
    const snap = await get(ref(db, `withdrawals/${id}`));
    const w = snap.val();
    const updates = {};
    updates[`withdrawals/${id}/status`] = approve ? 'approved' : 'rejected';
    if (!approve) {
        const userSnap = await get(ref(db, `users/${w.username}`));
        updates[`users/${w.username}/balance`] = (userSnap.val().balance || 0) + w.amount;
    }
    await update(ref(db), updates);
};
