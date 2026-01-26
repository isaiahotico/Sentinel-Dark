
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const tg = window.Telegram.WebApp;
tg.expand();

let user = tg.initDataUnsafe?.user || { id: "0000", first_name: "DevUser", username: "dev_user" };
let uid = user.id.toString();
let myData = null;
let rewardQueue = { amount: 0, key: '', ads: 0, msg: '' };

// 1. FAST LOADING & LOGIN
setTimeout(() => {
    document.getElementById('splash-screen').style.display = 'none';
}, 1500);

firebase.auth().signInAnonymously().then(() => {
    document.getElementById('u-name').innerText = `@${user.username || 'user'}`;
    document.getElementById('my-ref-code').innerText = `@${user.username || 'user'}`;
    if(user.photo_url) document.getElementById('u-photo').src = user.photo_url;
    
    initUser();
});

function initUser() {
    db.ref('users/' + uid).on('value', (snap) => {
        myData = snap.val();
        if (!myData) {
            myData = {
                username: (user.username || 'user' + uid).toLowerCase(),
                balance: 0, totalEarned: 0, adsTotal: 0, adsDaily: 0,
                lastPremium: 0, lastSurprise: 0, lastChat: 0, referredBy: ""
            };
            db.ref('users/' + uid).set(myData);
            db.ref('usernames/' + myData.username).set(uid);
        }
        document.getElementById('bal').innerText = myData.balance.toFixed(4);
        if(myData.referredBy) document.getElementById('ref-input-box').classList.add('hidden');
        renderHistory();
    });
    updatePresence();
}

// 2. AD SEQUENCES WITH CLAIM BUTTON
async function runPremiumSequence() {
    try {
        await show_10276123(); 
        await show_10276123();
        triggerClaim(0.0100, 'lastPremium', 2);
    } catch(e) { alert("Ad failed."); }
}

async function runSurpriseSequence() {
    show_10276123().then(() => triggerClaim(0.0102, 'lastSurprise', 1));
}

async function runChatSequence() {
    const now = Date.now();
    if(now - (myData.lastChat || 0) < 5*60*1000) return alert("Chat Cooldown!");
    const msg = document.getElementById('chat-msg').value;
    if(!msg) return;

    try {
        await show_10276123(); await show_10276123(); await show_10276123();
        triggerClaim(0.0201, 'lastChat', 3, msg);
        document.getElementById('chat-msg').value = '';
    } catch(e) { alert("Error in sequence."); }
}

// 3. CLAIM LOGIC
function triggerClaim(amt, key, ads, msg = '') {
    rewardQueue = { amount: amt, key: key, ads: ads, msg: msg };
    document.getElementById('pending-amt').innerText = amt.toFixed(4);
    document.getElementById('claim-area').style.display = 'block';
}

function claimRewardNow() {
    const q = rewardQueue;
    document.getElementById('claim-area').style.display = 'none';

    db.ref('users/' + uid).transaction((curr) => {
        if (curr) {
            curr.balance = (curr.balance || 0) + q.amount;
            curr.totalEarned = (curr.totalEarned || 0) + q.amount;
            curr.adsTotal = (curr.adsTotal || 0) + q.ads;
            curr.adsDaily = (curr.adsDaily || 0) + q.ads;
            curr[q.key] = Date.now();
        }
        return curr;
    });

    // Chat handling
    if(q.msg) {
        db.ref('chat').push({ username: myData.username, text: q.msg, time: Date.now() });
    }

    // Referral 8% Commission
    if(myData.referredBy) {
        const commission = q.amount * 0.08;
        db.ref('users/' + myData.referredBy).transaction((ref) => {
            if(ref) {
                ref.balance = (ref.balance || 0) + commission;
                ref.totalEarned = (ref.totalEarned || 0) + commission;
            }
            return ref;
        });
    }
    
    tg.HapticFeedback.notificationOccurred('success');
}

// 4. CORE FEATURES
function applyRef() {
    const code = document.getElementById('ref-input').value.toLowerCase().replace('@', '');
    if(code === myData.username) return alert("Cannot refer yourself");
    db.ref('usernames/' + code).once('value', (s) => {
        if(s.exists()) {
            db.ref('users/' + uid).update({ referredBy: s.val() });
            alert("Referral confirmed!");
        } else alert("User not found");
    });
}

function submitWithdraw() {
    const num = document.getElementById('gcash-num').value;
    if(num.length < 10) return alert("Invalid GCash");
    if(myData.balance < 0.02) return alert("Min 0.02 required");

    db.ref('withdrawals').push({
        uid: uid, username: myData.username, gcash: num,
        amount: myData.balance, status: 'pending', time: Date.now()
    });
    db.ref('users/' + uid + '/balance').set(0);
    alert("Withdrawal submitted!");
}

function tab(id) {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden-sec'));
    document.getElementById('sec-' + id).classList.remove('hidden-sec');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.replace('text-yellow-500', 'text-slate-500'));
    event.currentTarget.classList.replace('text-slate-500', 'text-yellow-500');
    if(id === 'social') loadSocial();
    if(id === 'chat') loadChat();
}

function loadSocial() {
    db.ref('users').orderByChild('totalEarned').limitToLast(10).on('value', snap => {
        const list = document.getElementById('leader-list');
        list.innerHTML = '';
        let arr = [];
        snap.forEach(c => arr.push(c.val()));
        arr.reverse().forEach((u, i) => {
            list.innerHTML += `<div class="flex justify-between text-xs bg-slate-800/50 p-2 rounded"><span>${i+1}. @${u.username}</span><span class="text-yellow-500">₱${u.totalEarned.toFixed(2)}</span></div>`;
        });
    });
}

function loadChat() {
    db.ref('chat').limitToLast(20).on('value', s => {
        const box = document.getElementById('chat-box');
        box.innerHTML = '';
        s.forEach(c => {
            const m = c.val();
            box.innerHTML += `<div><span class="text-yellow-500 font-bold">@${m.username}:</span> ${m.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// 5. ADMIN LOGIC
function adminAuth() {
    if(document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden-sec');
        document.getElementById('admin-panel').classList.remove('hidden-sec');
        loadAdmin();
    } else alert("Wrong PIN");
}

function loadAdmin() {
    db.ref('withdrawals').on('value', s => {
        const p = document.getElementById('adm-pending');
        const h = document.getElementById('adm-history');
        p.innerHTML = ''; h.innerHTML = '';
        s.forEach(c => {
            const w = c.val();
            const ui = `<div class="glass p-2 rounded border border-white/5">@${w.username} | ${w.gcash} | ₱${w.amount.toFixed(3)} ${w.status === 'pending' ? `<button onclick="approve('${c.key}')" class="bg-green-600 px-2 rounded ml-2">PAY</button>` : ''}</div>`;
            if(w.status === 'pending') p.innerHTML += ui; else h.innerHTML += ui;
        });
    });
}

function approve(key) { db.ref('withdrawals/' + key).update({ status: 'paid' }); }

// TIMERS
setInterval(() => {
    const now = Date.now();
    updateT('premium', now - (myData?.lastPremium || 0), 30*60*1000);
    updateT('surprise', now - (myData?.lastSurprise || 0), 3*60*1000);
    const cD = (5*60*1000) - (now - (myData?.lastChat || 0));
    document.getElementById('chat-timer').innerText = cD > 0 ? `Chat Unlock in ${Math.ceil(cD/1000)}s` : "Ads ready to unlock Chat";
}, 1000);

function updateT(id, diff, cd) {
    const b = document.getElementById('btn-' + id);
    const t = document.getElementById('timer-' + id);
    if(diff < cd) {
        b.classList.add('cooldown');
        const rem = Math.ceil((cd - diff)/1000);
        t.innerText = `${Math.floor(rem/60)}m ${rem%60}s`;
    } else { b.classList.remove('cooldown'); t.innerText = "READY"; }
}

function renderHistory() {
    db.ref('withdrawals').orderByChild('uid').equalTo(uid).limitToLast(5).on('value', s => {
        const list = document.getElementById('hist-list');
        list.innerHTML = '';
        s.forEach(c => {
            const w = c.val();
            list.innerHTML += `<div class="flex justify-between bg-slate-900 p-2 rounded"><span>₱${w.amount.toFixed(2)}</span><span class="${w.status === 'paid' ? 'text-green-500' : 'text-yellow-500'} font-bold">${w.status.toUpperCase()}</span></div>`;
        });
    });
}

function updatePresence() {
    const ref = db.ref('presence/' + uid);
    ref.set({ username: user.username || user.first_name });
    ref.onDisconnect().remove();
    db.ref('presence').on('value', s => {
        const l = document.getElementById('online-list');
        l.innerHTML = '';
        s.forEach(c => l.innerHTML += `<div class="bg-green-500/10 p-1 rounded">● @${c.val().username}</div>`);
    });
}
