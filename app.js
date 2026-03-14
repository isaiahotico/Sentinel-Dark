
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
    document.getElementById('balance').innerText = (userData.balance || 0).toFixed(3);
    document.getElementById('wallet-bal').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('promo-limit').innerText = `Free: FB(${3-userData.counts.fb}) WEB(${3-userData.counts.web})`;
});

// --- Tab System ---
window.showTab = (tab) => {
    document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.add('hidden-section'));
    document.querySelectorAll('nav button, .flex button').forEach(b => b.classList.remove('bg-gray-700', 'text-yellow-500'));
    
    document.getElementById('tab-' + tab).classList.remove('hidden-section');
    const btn = document.getElementById(`tab-${tab}-btn`);
    if(btn) btn.classList.add('bg-gray-700', 'text-yellow-500');
};

window.openAdmin = () => {
    const pw = prompt("Admin Password:");
    if (pw === "Propetas12") showTab('admin');
    else alert("Wrong password");
};

// --- Execution Core ---
let taskTimer;
let timeLeft = 0;
let currentActiveTask = null;
let reloadCount = 0;
let isFocused = true;

document.addEventListener("visibilitychange", () => {
    isFocused = !document.hidden;
    const status = document.getElementById('social-status');
    if(status) {
        status.innerText = isFocused ? "TASK IN PROGRESS..." : "PAUSED - RETURN TO APP";
        status.style.color = isFocused ? "#fbbf24" : "#ef4444";
    }
});

window.startTask = (id, type, url, reward, isAdmin) => {
    // 2-Hour Cooldown Logic for Admin Tasks
    if (isAdmin && userData.history[id]) {
        if (Date.now() - userData.history[id] < 7200000) return alert("Cooldown: You can visit this again in 2 hours.");
    }

    currentActiveTask = { id, type, reward, isAdmin };
    timeLeft = 15;

    if (type === 'web_visit' || isAdmin) {
        openWebCard(url);
    } else {
        openSocialTask(url);
    }
};

// --- Website logic (Refresh 3x) ---
function openWebCard(url) {
    reloadCount = 0;
    const modal = document.getElementById('web-modal');
    const frame = document.getElementById('web-frame');
    modal.classList.remove('hidden');
    frame.src = url;
    document.getElementById('web-lock').classList.remove('hidden');
    document.getElementById('refresh-trigger').classList.remove('hidden');
    document.getElementById('ref-count').innerText = "0";
    document.getElementById('web-timer').innerText = "15s";
}

window.reloadWeb = () => {
    reloadCount++;
    const frame = document.getElementById('web-frame');
    frame.src = frame.src; // Reload
    document.getElementById('ref-count').innerText = reloadCount;

    if (reloadCount >= 3) {
        document.getElementById('web-lock').classList.add('hidden');
        document.getElementById('refresh-trigger').classList.add('hidden');
        
        taskTimer = setInterval(() => {
            timeLeft--;
            document.getElementById('web-timer').innerText = timeLeft + "s";
            if (timeLeft <= 0) {
                clearInterval(taskTimer);
                completeTask('web-modal');
            }
        }, 1000);
    }
};

// --- Social Logic (Auto-Pause) ---
function openSocialTask(url) {
    const modal = document.getElementById('social-modal');
    const timerText = document.getElementById('social-timer-text');
    const progress = document.getElementById('social-progress');
    
    modal.classList.remove('hidden');
    window.open(url, '_blank');

    taskTimer = setInterval(() => {
        if (isFocused) {
            timeLeft--;
            timerText.innerText = timeLeft;
            const offset = 276 - ((15 - timeLeft) / 15 * 276);
            progress.style.strokeDashoffset = offset;

            if (timeLeft <= 0) {
                clearInterval(taskTimer);
                completeTask('social-modal');
            }
        }
    }, 1000);
}

async function completeTask(modalId) {
    const { id, reward } = currentActiveTask;
    document.getElementById(modalId).classList.add('hidden');
    
    const updates = {};
    updates[`users/${username}/balance`] = (userData.balance || 0) + reward;
    updates[`users/${username}/history/${id}`] = Date.now();
    
    if (!currentActiveTask.isAdmin) {
        const snap = await get(ref(db, `links/${id}`));
        if (snap.exists()) updates[`links/${id}/clicks`] = (snap.val().clicks || 0) + 1;
    }

    await update(ref(db), updates);
    alert(`₱${reward} credited to your account!`);
    currentActiveTask = null;
}

// --- Promotion Logic ---
window.createPromotion = async () => {
    const type = document.getElementById('promo-type').value;
    const url = document.getElementById('promo-url').value;
    const def = document.getElementById('promo-def').value;

    if (!url || !def) return alert("Fill all fields");

    let isFree = false;
    if (type === 'fb_follow' && userData.counts.fb < 3) isFree = true;
    if (type === 'web_visit' && userData.counts.web < 3) isFree = true;

    if (!isFree && userData.balance < 1) return alert("Insufficient balance (₱1.00 required)");

    const newLink = { 
        type, url, definition: def, reward: 0.02, maxClicks: 100, clicks: 0, 
        creator: username, createdAt: serverTimestamp() 
    };

    const key = push(ref(db, 'links')).key;
    const updates = {};
    updates[`links/${key}`] = newLink;
    if (!isFree) updates[`users/${username}/balance`] = userData.balance - 1;
    
    const countKey = type === 'fb_follow' ? 'fb' : 'web';
    updates[`users/${username}/counts/${countKey}`] = (userData.counts[countKey] || 0) + 1;

    await update(ref(db), updates);
    alert("Campaign published!");
    showTab('earn');
};

// --- Withdrawal System ---
window.submitWithdraw = async () => {
    const method = document.getElementById('wd-method').value;
    const acc = document.getElementById('wd-account').value;
    const amt = parseFloat(document.getElementById('wd-amount').value);

    if (amt < 1 || amt > userData.balance) return alert("Invalid amount (Min ₱1)");
    if (!acc) return alert("Enter account info");

    const key = push(ref(db, 'withdrawals')).key;
    const updates = {};
    updates[`withdrawals/${key}`] = { username, method, account: acc, amount: amt, status: 'pending', date: serverTimestamp() };
    updates[`users/${username}/balance`] = userData.balance - amt;

    await update(ref(db), updates);
    alert("Request sent for manual approval.");
};

// --- Admin Section ---
window.adminPostSponsor = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    if(!url || !def) return;

    const key = push(ref(db, 'links')).key;
    await set(ref(db, `links/${key}`), { 
        url, definition: def, isAdmin: true, reward: 0.021, maxClicks: 100000, clicks: 0, type: 'SPONSOR' 
    });
    alert("Admin Sponsor Active!");
};

onValue(ref(db, 'withdrawals'), (snap) => {
    const list = document.getElementById('admin-withdrawals');
    list.innerHTML = `<p class="text-[10px] font-bold text-gray-400">PENDING WITHDRAWALS</p>`;
    if (!snap.exists()) return;
    Object.keys(snap.val()).forEach(id => {
        const w = snap.val()[id];
        if (w.status !== 'pending') return;
        const div = document.createElement('div');
        div.className = "bg-black/50 p-3 rounded-lg flex justify-between items-center text-[10px]";
        div.innerHTML = `
            <div>
                <p class="font-bold text-blue-400">@${w.username}</p>
                <p>₱${w.amount} via ${w.method} (${w.account})</p>
            </div>
            <div class="flex gap-2">
                <button onclick="processWD('${id}', true)" class="bg-green-600 px-2 py-1 rounded">✔</button>
                <button onclick="processWD('${id}', false)" class="bg-red-600 px-2 py-1 rounded">✖</button>
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
        // Refund if rejected
        const uSnap = await get(ref(db, `users/${w.username}`));
        updates[`users/${w.username}/balance`] = uSnap.val().balance + w.amount;
    }
    await update(ref(db), updates);
};

// --- Realtime Earn List ---
onValue(ref(db, 'links'), (snap) => {
    const adminCont = document.getElementById('admin-links');
    const userCont = document.getElementById('user-links');
    adminCont.innerHTML = ""; userCont.innerHTML = "";
    
    if (!snap.exists()) return;
    const data = snap.val();
    Object.keys(data).forEach(id => {
        const l = data[id];
        // Visibility rules
        if (!l.isAdmin && (l.clicks >= l.maxClicks || (userData.history && userData.history[id]))) return;
        if (l.isAdmin && userData.history && userData.history[id] && (Date.now() - userData.history[id] < 7200000)) return;

        const card = document.createElement('div');
        card.className = `bg-gray-800 p-4 rounded-xl flex justify-between items-center border border-gray-700 ${l.isAdmin ? 'admin-task' : ''}`;
        card.innerHTML = `
            <div class="flex-1 pr-3">
                <p class="text-[9px] font-bold text-blue-400 uppercase">${l.type.replace('_',' ')}</p>
                <p class="text-xs font-medium leading-snug line-clamp-1">${l.definition}</p>
            </div>
            <button onclick="startTask('${id}', '${l.type}', '${l.url}', ${l.reward}, ${l.isAdmin || false})" class="bg-blue-600 px-4 py-2 rounded-lg font-black text-xs shrink-0">₱${l.reward}</button>
        `;
        if (l.isAdmin) adminCont.appendChild(card);
        else userCont.appendChild(card);
    });
});
