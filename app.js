
// --- FIREBASE SETUP ---
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
tg?.expand();

const userId = tg?.initDataUnsafe?.user?.id || "DEV_MODE";
const fullName = tg?.initDataUnsafe?.user?.first_name || "Guest";
const username = tg?.initDataUnsafe?.user?.username || fullName;
let userBalance = 0;
let userRefBonus = 0;

// --- INITIALIZE USER ---
db.ref('users/' + userId).on('value', snap => {
    const data = snap.val();
    if (!data) {
        db.ref('users/' + userId).set({
            username: username,
            balance: 0,
            refBonus: 0,
            referredBy: "",
            lastG1: 0, lastG2: 0, lastG3: 0, lastP: 0
        });
    } else {
        userBalance = data.balance || 0;
        userRefBonus = data.refBonus || 0;
        document.getElementById('balance').innerText = userBalance.toFixed(3);
        document.getElementById('claimable-amt').innerText = userRefBonus.toFixed(3);
        updateTimers(data);
    }
});

document.getElementById('userBar').innerText = `👤 User: @${username}`;
document.getElementById('my-ref-code').innerText = username;

// --- NAVIGATION ---
function showSec(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active-section'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
    document.getElementById('sec-' + id).classList.add('active-section');
    document.getElementById('nav-' + id).classList.add('nav-active');
}

// --- DYNAMIC DESIGN ---
function handleBgChange(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    const colors = ['#1a0000', '#001a00', '#00001a', '#1a1a00', '#1a001a', '#000000', '#2b1d0e'];
    document.body.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
}

// --- AD LOGIC (REWARDED) ---
async function handleAd(type) {
    const snap = await db.ref('users/' + userId).get();
    const data = snap.val();
    const now = Date.now();

    const config = {
        gift1: { id: '10276123', reward: 0.075, cooldown: 900000, last: data.lastG1, key: 'lastG1' },
        gift2: { id: '10337795', reward: 0.075, cooldown: 900000, last: data.lastG2, key: 'lastG2' },
        gift3: { id: '10337853', reward: 0.075, cooldown: 900000, last: data.lastG3, key: 'lastG3' },
        premium: { reward: 0.022, cooldown: 300000, last: data.lastP, key: 'lastP' }
    };

    const target = config[type];
    if (now - (target.last || 0) < target.cooldown) return alert("Still on cooldown!");

    try {
        if (type === 'premium') {
            await show_10276123(); await show_10337795(); await show_10337853();
            grantReward(target.reward, target.key);
        } else {
            window[`show_${target.id}`]('pop').then(() => grantReward(target.reward, target.key));
        }
    } catch (err) { alert("Ad blocked or failed."); }
}

function grantReward(amt, key) {
    db.ref('users/' + userId + '/balance').transaction(b => (b || 0) + amt);
    const up = {}; up[key] = Date.now();
    db.ref('users/' + userId).update(up);
    
    // Referral 8% Logic
    db.ref('users/' + userId).once('value', s => {
        const boss = s.val().referredBy;
        if (boss) {
            db.ref('users').orderByChild('username').equalTo(boss).once('value', bossSnap => {
                bossSnap.forEach(b => {
                    db.ref('users/' + b.key + '/refBonus').transaction(val => (val || 0) + (amt * 0.08));
                });
            });
        }
    });
    tg.HapticFeedback.notificationOccurred('success');
}

// --- BACKGROUND IN-APP ADS (EVERY 3 MINS) ---
function autoShowAds() {
    const ids = ['10337853', '10276123', '10337795'];
    const randomId = ids[Math.floor(Math.random() * ids.length)];
    const adConfig = { type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } };
    window[`show_${randomId}`](adConfig);
}
setInterval(autoShowAds, 180000); 
setTimeout(autoShowAds, 5000); // Initial show

// --- REFERRALS ---
async function applyReferral() {
    const code = document.getElementById('input-ref').value.trim();
    if (code === username) return alert("Cant refer self");
    const user = await db.ref('users/' + userId).get();
    if (user.val().referredBy) return alert("Already referred");

    db.ref('users').orderByChild('username').equalTo(code).once('value', s => {
        if (s.exists()) {
            db.ref('users/' + userId).update({ referredBy: code });
            alert("Success!");
        } else alert("Invalid code");
    });
}

function claimRef() {
    if (userRefBonus <= 0) return;
    db.ref('users/' + userId).update({
        balance: userBalance + userRefBonus,
        refBonus: 0
    });
}

// --- WITHDRAWALS ---
function submitWithdraw() {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const gcash = document.getElementById('wd-gcash').value;
    if (amt < 1 || amt > userBalance) return alert("Check balance/min amount");

    const req = {
        uid: userId, name: fullName, gcash: gcash, amt: amt,
        status: 'PENDING', date: new Date().toLocaleString(), timestamp: Date.now()
    };
    db.ref('withdrawals/pending').push(req);
    db.ref('users/' + userId + '/balance').transaction(b => b - amt);
    alert("Request Sent!");
}

// User History
db.ref('withdrawals/history').orderByChild('uid').equalTo(userId).on('value', snap => {
    const list = document.getElementById('user-history-list');
    list.innerHTML = "";
    snap.forEach(d => {
        const w = d.val();
        list.innerHTML += `<tr><td>${w.date}</td><td>₱${w.amt}</td><td class="${w.status=='APPROVED'?'text-green-500':'text-red-500'}">${w.status}</td></tr>`;
    });
});

// --- ADMIN ---
function checkAdmin() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-dash').classList.remove('hidden');
        loadAdmin();
    }
}

function loadAdmin() {
    db.ref('withdrawals/pending').on('value', snap => {
        const container = document.getElementById('admin-pending-list');
        container.innerHTML = "";
        snap.forEach(d => {
            const w = d.val();
            container.innerHTML += `
                <div class="gold-card p-3 text-xs">
                    <p>User: ${w.name} | Amt: ₱${w.amt}</p>
                    <p>GCash: ${w.gcash}</p>
                    <div class="flex gap-2 mt-2">
                        <button onclick="processW('${d.key}', 'APPROVED')" class="bg-green-600 flex-1 py-1 rounded">APPROVE</button>
                        <button onclick="processW('${d.key}', 'DENIED')" class="bg-red-600 flex-1 py-1 rounded">DENY</button>
                    </div>
                </div>`;
        });
    });

    db.ref('withdrawals/history').limitToLast(20).on('value', snap => {
        const list = document.getElementById('admin-history-list');
        list.innerHTML = "";
        snap.forEach(d => {
            const w = d.val();
            list.innerHTML += `<tr><td>${w.name}</td><td>${w.gcash}</td><td>₱${w.amt}</td><td>${w.status}</td></tr>`;
        });
    });
}

function processW(key, status) {
    db.ref('withdrawals/pending/' + key).once('value', snap => {
        const data = snap.val();
        data.status = status;
        if (status === 'DENIED') {
            db.ref('users/' + data.uid + '/balance').transaction(b => (b || 0) + data.amt);
        }
        db.ref('withdrawals/history').push(data);
        db.ref('withdrawals/pending/' + key).remove();
    });
}

// --- CHAT & LEADERBOARD ---
function sendMsg() {
    const m = document.getElementById('chat-input').value;
    if(!m) return;
    db.ref('chat').push({ u: username, m: m });
    document.getElementById('chat-input').value = "";
}

db.ref('chat').limitToLast(15).on('value', snap => {
    const div = document.getElementById('chat-msgs');
    div.innerHTML = "";
    snap.forEach(d => {
        div.innerHTML += `<div><span class="gold-text font-bold">${d.val().u}:</span> ${d.val().m}</div>`;
    });
    div.scrollTop = div.scrollHeight;
});

setInterval(() => {
    db.ref('users').orderByChild('balance').limitToLast(5).once('value', snap => {
        const div = document.getElementById('leaderboard-list');
        div.innerHTML = "";
        let arr = []; snap.forEach(d => arr.push(d.val()));
        arr.reverse().forEach((p, i) => {
            div.innerHTML += `<div class="flex justify-between border-b border-white/5"><span>#${i+1} ${p.username}</span><span class="gold-text">₱${p.balance.toFixed(2)}</span></div>`;
        });
    });
}, 3000);

function updateTimers(data) {
    const now = Date.now();
    const map = { 'btn-gift1': [data.lastG1, 900000], 'btn-gift2': [data.lastG2, 900000], 'btn-gift3': [data.lastG3, 900000], 'btn-premium': [data.lastP, 300000] };
    for (const [id, [last, dur]] of Object.entries(map)) {
        const btn = document.getElementById(id);
        const rem = (last || 0) + dur - now;
        if (rem > 0) { btn.disabled = true; btn.style.filter = "grayscale(1)"; }
        else { btn.disabled = false; btn.style.filter = "none"; }
    }
}
