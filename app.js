
// Firebase Config
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

const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? (tgUser.username || tgUser.first_name) : "User_" + Math.floor(Math.random() * 9999);
const userId = tgUser ? tgUser.id : "ID_" + username;

document.getElementById('top-user').innerText = "👤 User: @" + username;
document.getElementById('my-code').innerText = username;

let localData = { balance: 0, referralBonus: 0, referrer: "", refCount: 0 };

// Background Change
function changeBg() {
    const colors = ['#0a0a0a', '#1a0d00', '#0d1a00', '#000d1a', '#1a001a', '#0d0d0d'];
    document.body.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
}

// Nav
function nav(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// User Sync
db.ref('users/' + userId).on('value', snap => {
    let data = snap.val();
    if (!data) {
        data = { username, balance: 0, referralBonus: 0, refCount: 0, lastSeen: Date.now() };
        db.ref('users/' + userId).set(data);
    }
    localData = data;
    document.getElementById('user-balance').innerText = data.balance.toFixed(4);
    document.getElementById('ref-bonus-amt').innerText = (data.referralBonus || 0).toFixed(2);
    document.getElementById('ref-count').innerText = data.refCount || 0;
});

// Auto Ads (High CPM In-App)
function triggerAutoAds() {
    const zones = ['10337853', '10276123', '10337795'];
    const randomZone = zones[Math.floor(Math.random() * zones.length)];
    const showFn = window['show_' + randomZone];
    
    if (typeof showFn === 'function') {
        showFn({
            type: 'inApp',
            inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
        });
    }
}

// Initial trigger + every 3 minutes
window.onload = () => {
    triggerAutoAds();
    setInterval(triggerAutoAds, 180000); 
};

// Reward System
const cooldowns = {};
function rewardAd(label, zone, amt, cd) {
    if (Date.now() < (cooldowns[label] || 0)) return alert("Ad on cooldown!");
    alert("Loading Ad...");
    setTimeout(() => {
        addMoney(amt);
        startCd(label, cd);
    }, 2000);
}

function rewardRewarded(label, zone, amt, cd) {
    if (Date.now() < (cooldowns[label] || 0)) return alert("Ad on cooldown!");
    const fn = window['show_' + zone];
    if (typeof fn === 'function') {
        fn('pop').then(() => { addMoney(amt); startCd(label, cd); });
    }
}

function rewardCombined(label, amt, cd) {
    if (Date.now() < (cooldowns[label] || 0)) return alert("Ad on cooldown!");
    alert("Showing VIP Ads sequence...");
    addMoney(amt); startCd(label, cd);
}

function rewardInterstitial(label, amt, cd) {
    if (Date.now() < (cooldowns[label] || 0)) return alert("Ad on cooldown!");
    alert("Loading Premium Interstitial...");
    addMoney(amt); startCd(label, cd);
}

function addMoney(amt) {
    db.ref('users/' + userId + '/balance').set(firebase.database.ServerValue.increment(amt));
    if (localData.referrer) {
        db.ref('users').orderByChild('username').equalTo(localData.referrer).once('value', s => {
            s.forEach(c => db.ref('users/' + c.key + '/referralBonus').set(firebase.database.ServerValue.increment(amt * 0.08)));
        });
    }
    tg.HapticFeedback.notificationOccurred('success');
}

function startCd(label, sec) {
    cooldowns[label] = Date.now() + (sec * 1000);
    const el = document.getElementById('cd-' + label);
    const timer = setInterval(() => {
        let rem = Math.ceil((cooldowns[label] - Date.now()) / 1000);
        if (rem <= 0) { el.innerText = "Ready"; clearInterval(timer); }
        else { el.innerText = Math.floor(rem/60) + "m " + (rem%60) + "s"; }
    }, 1000);
}

// Withdrawal Logic
function submitWithdraw() {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const name = document.getElementById('wd-name').value;
    const num = document.getElementById('wd-number').value;

    if (amt < 1 || isNaN(amt)) return alert("Min 1 PHP");
    if (amt > localData.balance) return alert("Insufficient Balance");
    if (!name || num.length < 10) return alert("Check GCash details");

    const request = {
        userId, username, name, number: num, amount: amt, 
        status: 'Pending', timestamp: Date.now(), date: new Date().toLocaleString()
    };

    db.ref('withdrawals').push(request);
    db.ref('users/' + userId + '/balance').set(firebase.database.ServerValue.increment(-amt));
    alert("Request Sent!");
}

db.ref('withdrawals').orderByChild('userId').equalTo(userId).on('value', snap => {
    const list = snap.val();
    let html = '';
    for (let id in list) {
        html += `<tr><td>${list[id].date}</td><td>₱${list[id].amount}</td><td class="status-${list[id].status}">${list[id].status}</td></tr>`;
    }
    document.getElementById('user-history').innerHTML = html;
});

// Referrals
function applyRef() {
    const code = document.getElementById('ref-input').value;
    if (code === username) return alert("Invalid Code");
    if (localData.referrer) return alert("Already referred");
    db.ref('users').orderByChild('username').equalTo(code).once('value', snap => {
        if (snap.exists()) {
            db.ref('users/' + userId + '/referrer').set(code);
            snap.forEach(c => db.ref('users/' + c.key + '/refCount').set(firebase.database.ServerValue.increment(1)));
            alert("Referrer Linked!");
        } else alert("User not found");
    });
}

function claimRef() {
    const amt = localData.referralBonus || 0;
    if (amt <= 0) return;
    db.ref('users/' + userId + '/balance').set(firebase.database.ServerValue.increment(amt));
    db.ref('users/' + userId + '/referralBonus').set(0);
    alert(`Claimed ₱${amt.toFixed(2)}`);
}

// Chat
function sendChat() {
    const msg = document.getElementById('chat-msg').value;
    if (!msg) return;
    db.ref('chats').push({ user: username, msg, time: Date.now() });
    document.getElementById('chat-msg').value = '';
}
db.ref('chats').limitToLast(15).on('child_added', s => {
    const data = s.val();
    document.getElementById('chat-box').innerHTML += `<div class="msg"><b>${data.user}:</b> ${data.msg}</div>`;
    document.getElementById('chat-box').scrollTop = 9999;
});

// Admin Logic
function loginAdmin() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        loadAdmin();
    } else alert("Wrong Password");
}

function loadAdmin() {
    db.ref('withdrawals').on('value', snap => {
        const all = snap.val();
        let pending = '<tr><th>User</th><th>GCash</th><th>Amt</th><th>Action</th></tr>';
        let history = '<tr><th>User</th><th>Amt</th><th>Status</th></tr>';
        for (let id in all) {
            if (all[id].status === 'Pending') {
                pending += `<tr><td>${all[id].username}</td><td>${all[id].number}</td><td>₱${all[id].amount}</td>
                <td><button onclick="approve('${id}', 'Approved')">✔</button> <button onclick="approve('${id}', 'Denied')">✖</button></td></tr>`;
            } else {
                history += `<tr><td>${all[id].username}</td><td>₱${all[id].amount}</td><td class="status-${all[id].status}">${all[id].status}</td></tr>`;
            }
        }
        document.getElementById('admin-pending-table').innerHTML = pending;
        document.getElementById('admin-history-table').innerHTML = history;
    });
}

function approve(id, status) {
    db.ref('withdrawals/' + id + '/status').set(status);
    if (status === 'Denied') {
        db.ref('withdrawals/' + id).once('value', s => {
            db.ref('users/' + s.val().userId + '/balance').set(firebase.database.ServerValue.increment(s.val().amount));
        });
    }
}

// Leaderboard & Online
setInterval(() => {
    db.ref('users').orderByChild('balance').limitToLast(10).once('value', s => {
        let html = ''; let count = 1; let leaders = [];
        s.forEach(c => { leaders.push(c.val()); });
        leaders.reverse().forEach(u => {
            html += `<tr><td>${count++}</td><td>${u.username}</td><td>₱${u.balance.toFixed(2)}</td></tr>`;
        });
        document.getElementById('leader-body').innerHTML = html;
    });
}, 5000);
