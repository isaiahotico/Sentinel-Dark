
// --- INITIALIZATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const tg = window.Telegram?.WebApp;
tg?.ready();

// Telegram Data
const tgUser = tg?.initDataUnsafe?.user;
const userId = tgUser?.id || "DEBUG_" + Math.floor(Math.random() * 1000);
const username = tgUser?.username || tgUser?.first_name || "Guest";
let currentBalance = 0;
let referralBonus = 0;

// Update UI Immediately
document.getElementById("userBar").innerText = "👤 User: @" + username;
document.getElementById("my-code").innerText = username;

// --- DYNAMIC BACKGROUND ---
function changeBgColor(e) {
    if(e.target.tagName === 'BUTTON' || e.target.tagName === 'A' || e.target.tagName === 'INPUT') return;
    const colors = ['#1a1a1a', '#2d1b4d', '#4d1b1b', '#1b4d32', '#4d3a1b', '#1b3a4d', '#4d1b45', '#000000'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    document.body.style.backgroundColor = randomColor;
}

// --- NAVIGATION ---
function showSection(id) {
    document.querySelectorAll('main > div').forEach(div => div.classList.add('section-hidden'));
    document.getElementById('sec-' + id).classList.remove('section-hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('nav-active'));
    event.currentTarget.classList.add('nav-active');
}

// --- USER SYNC ---
db.ref('users/' + userId).on('value', (snap) => {
    const data = snap.val();
    if (!data) {
        db.ref('users/' + userId).set({
            username: username,
            balance: 0,
            refBonus: 0,
            referredBy: "",
            lastGift1: 0, lastGift2: 0, lastGift3: 0, lastPremium: 0,
            online: true
        });
    } else {
        currentBalance = data.balance || 0;
        referralBonus = data.refBonus || 0;
        document.getElementById('balance').innerText = currentBalance.toFixed(3);
        document.getElementById('ref-bonus').innerText = referralBonus.toFixed(3);
        checkCooldowns(data);
    }
});

// Presence System
const presenceRef = db.ref('presence/' + userId);
presenceRef.set({ username: username, lastSeen: Date.now() });
presenceRef.onDisconnect().remove();

// --- ADS LOGIC ---
async function handleAd(type) {
    const now = Date.now();
    const snap = await db.ref('users/' + userId).get();
    const data = snap.val();

    const config = {
        gift1: { duration: 900000, reward: 0.075, last: data.lastGift1, key: 'lastGift1', adFunc: () => show_10276123('pop') },
        gift2: { duration: 900000, reward: 0.075, last: data.lastGift2, key: 'lastGift2', adFunc: () => show_10337795('pop') },
        gift3: { duration: 900000, reward: 0.075, last: data.lastGift3, key: 'lastGift3', adFunc: () => show_10337853('pop') },
        premium: { duration: 300000, reward: 0.022, last: data.lastPremium, key: 'lastPremium', adFunc: null }
    };

    const target = config[type];
    if (now - (target.last || 0) < target.duration) return alert("Still on cooldown!");

    try {
        if (type === 'premium') {
            await show_10276123();
            await show_10337795();
            await show_10337853();
            processReward(target.reward, target.key);
        } else {
            target.adFunc().then(() => processReward(target.reward, target.key));
        }
    } catch (e) { alert("Ad Failed. Try again."); }
}

function processReward(amt, key) {
    const updates = {};
    updates['balance'] = firebase.database.ServerValue.increment(amt);
    updates[key] = Date.now();
    db.ref('users/' + userId).update(updates);
    
    // Referral Commission (8%)
    db.ref('users/' + userId).once('value', s => {
        const refOwner = s.val().referredBy;
        if(refOwner) {
            db.ref('users').orderByChild('username').equalTo(refOwner).once('value', usersSnap => {
                usersSnap.forEach(u => {
                    db.ref('users/' + u.key + '/refBonus').transaction(b => (b || 0) + (amt * 0.08));
                });
            });
        }
    });
    tg.HapticFeedback.notificationOccurred('success');
}

function checkCooldowns(data) {
    const now = Date.now();
    updateBtn('btn-gift1', data.lastGift1, 900000, "GIFT1");
    updateBtn('btn-gift2', data.lastGift2, 900000, "GIFT2");
    updateBtn('btn-gift3', data.lastGift3, 900000, "GIFT3");
    updateBtn('btn-premium', data.lastPremium, 300000, "PREMIUM");
}

function updateBtn(id, last, dur, label) {
    const btn = document.getElementById(id);
    const diff = (last || 0) + dur - Date.now();
    if (diff > 0) {
        btn.disabled = true;
        btn.innerHTML = `WAIT ${Math.ceil(diff/60000)}m`;
        btn.style.opacity = "0.5";
    } else {
        btn.disabled = false;
        btn.style.opacity = "1";
    }
}

// --- REFERRAL SYSTEM ---
async function submitReferral() {
    const code = document.getElementById('refer-input').value.trim();
    if (code === username) return alert("You cannot refer yourself!");
    
    const userSnap = await db.ref('users/' + userId).get();
    if (userSnap.val().referredBy) return alert("Already referred!");

    const refCheck = await db.ref('users').orderByChild('username').equalTo(code).get();
    if (refCheck.exists()) {
        db.ref('users/' + userId).update({ referredBy: code });
        alert("Referral linked!");
    } else {
        alert("Invalid Username Code!");
    }
}

function claimRefBonus() {
    if (referralBonus <= 0) return alert("Nothing to claim.");
    db.ref('users/' + userId).update({
        balance: firebase.database.ServerValue.increment(referralBonus),
        refBonus: 0
    });
    alert("Bonus claimed!");
}

// --- CHAT ROOM ---
function sendChat() {
    const msg = document.getElementById('chat-input').value;
    if (!msg) return;
    db.ref('chat').push({ user: username, msg: msg, time: Date.now() });
    document.getElementById('chat-input').value = "";
}

db.ref('chat').limitToLast(20).on('value', snap => {
    const box = document.getElementById('chat-box');
    box.innerHTML = "";
    snap.forEach(c => {
        const data = c.val();
        box.innerHTML += `<p class="text-[10px] mb-1"><b class="gold-text">${data.user}:</b> ${data.msg}</p>`;
    });
    box.scrollTop = box.scrollHeight;
});

// --- LEADERBOARD & ONLINE ---
setInterval(() => {
    // Leaderboard
    db.ref('users').orderByChild('balance').limitToLast(10).once('value', snap => {
        const list = document.getElementById('leader-list');
        list.innerHTML = "";
        let players = [];
        snap.forEach(u => players.push(u.val()));
        players.reverse().forEach((p, i) => {
            list.innerHTML += `<div class="flex justify-between border-b border-yellow-900/30 pb-1">
                <span>#${i+1} ${p.username}</span>
                <span class="gold-text font-bold">₱${p.balance.toFixed(2)}</span>
            </div>`;
        });
    });

    // Online Users
    db.ref('presence').limitToLast(20).once('value', snap => {
        const oList = document.getElementById('online-list');
        oList.innerHTML = "";
        snap.forEach(u => {
            oList.innerHTML += `<div class="text-green-400">● ${u.val().username}</div>`;
        });
    });
}, 2000);

// --- WITHDRAWAL & ADMIN ---
function requestWithdraw() {
    const amt = parseFloat(document.getElementById('withdraw-amt').value);
    const gcash = document.getElementById('gcash-num').value;
    if (amt < 1 || amt > currentBalance) return alert("Invalid amount!");
    
    const req = { uid: userId, user: username, amt: amt, gcash: gcash, status: "PENDING", time: Date.now() };
    db.ref('withdrawals/pending').push(req);
    db.ref('users/' + userId + '/balance').transaction(b => b - amt);
    alert("Requested!");
}

function loginAdmin() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-gate').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('section-hidden');
        loadAdminDash();
    }
}

function loadAdminDash() {
    db.ref('withdrawals/pending').on('value', snap => {
        const div = document.getElementById('admin-pending');
        div.innerHTML = "";
        snap.forEach(d => {
            const data = d.val();
            div.innerHTML += `<div class="gold-card p-2 text-[10px]">
                <p>${data.user} - ₱${data.amt}</p>
                <p>GCash: ${data.gcash}</p>
                <button onclick="approve('${d.key}')" class="bg-green-600 px-2 py-1 rounded mt-1">APPROVE</button>
            </div>`;
        });
    });
    
    db.ref('withdrawals/approved').limitToLast(10).on('value', snap => {
        const div = document.getElementById('admin-history');
        div.innerHTML = "";
        snap.forEach(d => {
            div.innerHTML += `<p>PAID: ${d.val().user} - ₱${d.val().amt}</p>`;
        });
    });
}

function approve(key) {
    db.ref('withdrawals/pending/' + key).once('value', snap => {
        const data = snap.val();
        data.status = "APPROVED";
        db.ref('withdrawals/approved').push(data);
        db.ref('withdrawals/pending/' + key).remove();
    });
}
