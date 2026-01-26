
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

let user = tg.initDataUnsafe?.user || { id: "12345", username: "Local_Dev", first_name: "Developer" };
let uid = user.id.toString();
let myData = null;

// Initialization
firebase.auth().signInAnonymously().then(() => {
    document.getElementById('tg-username').innerText = `@${user.username || 'User'}`;
    if(user.photo_url) document.getElementById('user-photo').src = user.photo_url;
    
    initUser();
    updatePresence();
    syncHistory();
});

function initUser() {
    db.ref('users/' + uid).on('value', (snap) => {
        myData = snap.val();
        if (!myData) {
            myData = {
                username: user.username || "Anonymous",
                fullName: `${user.first_name || ''} ${user.last_name || ''}`,
                balance: 0,
                totalEarned: 0,
                refEarnings: 0,
                adsTotal: 0,
                adsDaily: 0,
                referredBy: "",
                lastPremium: 0,
                lastSurprise: 0,
                lastChat: 0
            };
            db.ref('users/' + uid).set(myData);
        }
        document.getElementById('bal').innerText = myData.balance.toFixed(4);
        document.getElementById('ref-earn').innerText = myData.refEarnings.toFixed(4);
        updateTimers();
    });
}

// ADS LOGIC
async function watchPremiumAd() {
    // 2 High CPM Interstitials combined
    try {
        await show_10276123(); // First ad
        await show_10276123(); // Second ad
        rewardUser(0.0100, 'lastPremium', 1);
        alert("Premium Reward Credited!");
    } catch(e) { alert("Ad failed. Try again."); }
}

async function watchSurpriseAd() {
    show_10276123('pop').then(() => {
        rewardUser(0.0102, 'lastSurprise', 1);
    });
}

async function sendChatMessage() {
    const now = Date.now();
    const cooldown = 5 * 60 * 1000;
    if (now - (myData.lastChat || 0) < cooldown) return alert("Chat cooldown active!");

    const msg = document.getElementById('chat-msg').value;
    if (!msg) return;

    // Trigger 3 Ads Combined
    try {
        await show_10276123();
        await show_10276123();
        await show_10276123();
        
        db.ref('chat').push({ username: myData.username, text: msg, time: now });
        rewardUser(0.0201, 'lastChat', 3);
        document.getElementById('chat-msg').value = '';
    } catch(e) { alert("Please watch ads to chat!"); }
}

function rewardUser(amt, cooldownKey, adsCount) {
    const update = {};
    update['balance'] = (myData.balance || 0) + amt;
    update['totalEarned'] = (myData.totalEarned || 0) + amt;
    update['adsTotal'] = (myData.adsTotal || 0) + adsCount;
    update['adsDaily'] = (myData.adsDaily || 0) + adsCount;
    update[cooldownKey] = Date.now();
    
    db.ref('users/' + uid).update(update);

    // 8% Referral Logic
    if (myData.referredBy) {
        const refReward = amt * 0.08;
        db.ref('users/' + myData.referredBy).transaction((u) => {
            if (u) {
                u.balance = (u.balance || 0) + refReward;
                u.refEarnings = (u.refEarnings || 0) + refReward;
            }
            return u;
        });
    }
}

// NAVIGATION & TAB SYSTEMS
function nav(id) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden-sec'));
    document.getElementById('sec-' + id).classList.remove('hidden-sec');
    if(id === 'social') loadSocial();
    if(id === 'chat') loadChat();
}

function submitReferral() {
    const code = document.getElementById('ref-input').value.replace('@', '');
    if (code === myData.username) return alert("Can't refer yourself!");
    
    db.ref('users').orderByChild('username').equalTo(code).once('value', snap => {
        if (snap.exists()) {
            const refUid = Object.keys(snap.val())[0];
            db.ref('users/' + uid).update({ referredBy: refUid });
            alert("Referral confirmed! You are now earning for " + code);
        } else {
            alert("User not found!");
        }
    });
}

function withdraw() {
    const num = document.getElementById('gcash-num').value;
    if (num.length < 10) return alert("Enter valid GCash");
    if (myData.balance < 0.02) return alert("Min 0.02 required");

    const request = {
        uid: uid,
        username: myData.username,
        amount: myData.balance,
        gcash: num,
        status: 'pending',
        time: Date.now()
    };

    db.ref('withdrawals').push(request);
    db.ref('users/' + uid).update({ balance: 0 });
    alert("Withdrawal submitted!");
}

function syncHistory() {
    db.ref('withdrawals').orderByChild('uid').equalTo(uid).on('value', snap => {
        const tbody = document.getElementById('withdraw-history');
        tbody.innerHTML = '';
        snap.forEach(child => {
            const w = child.val();
            tbody.innerHTML += `<tr><td>${w.amount.toFixed(2)}</td><td>${w.gcash}</td><td class="${w.status=='pending'?'text-yellow-500':'text-green-500'}">${w.status}</td></tr>`;
        });
    });
}

// SOCIAL FEATURES
function loadSocial() {
    // Leaderboard
    db.ref('users').orderByChild('totalEarned').limitToLast(10).on('value', snap => {
        const list = document.getElementById('leader-list');
        list.innerHTML = '';
        snap.forEach(child => {
            const u = child.val();
            list.innerHTML += `<div class="flex justify-between p-2 bg-slate-800 rounded-lg text-xs" onclick="showUserStats('${child.key}')">
                <span>@${u.username}</span><span class="text-yellow-500 font-bold">₱${u.totalEarned.toFixed(2)}</span>
            </div>`;
        });
    });

    // Online Users
    db.ref('presence').limitToLast(20).on('value', snap => {
        const list = document.getElementById('online-list');
        list.innerHTML = '';
        snap.forEach(child => {
            const u = child.val();
            list.innerHTML += `<div class="bg-slate-800 p-2 rounded-lg text-[10px] truncate">🟢 ${u.name}</div>`;
        });
    });
}

function showUserStats(userId = uid) {
    db.ref('users/' + userId).once('value', snap => {
        const u = snap.val();
        document.getElementById('stats-name').innerText = "@" + u.username;
        document.getElementById('stats-total').innerText = u.adsTotal || 0;
        document.getElementById('stats-daily').innerText = u.adsDaily || 0;
        document.getElementById('modal-stats').classList.remove('hidden');
    });
}

// ADMIN FUNCTIONS
function verifyAdmin() {
    if (document.getElementById('admin-pw').value === "Propetas12") {
        document.getElementById('admin-auth').classList.add('hidden-sec');
        document.getElementById('admin-core').classList.remove('hidden-sec');
        loadAdminData();
    }
}

function loadAdminData() {
    db.ref('withdrawals').on('value', snap => {
        const pend = document.getElementById('admin-pending-list');
        const hist = document.getElementById('admin-history-list');
        pend.innerHTML = ''; hist.innerHTML = '';
        snap.forEach(child => {
            const w = child.val();
            const html = `<div class="glass p-3 rounded text-[10px]">
                @${w.username} | ${w.gcash} | <span class="text-green-400 font-bold">₱${w.amount.toFixed(4)}</span><br>
                ${w.status === 'pending' ? `<button onclick="approve('${child.key}')" class="bg-green-600 mt-2 p-1 rounded">Approve Paid</button>` : 'COMPLETED'}
            </div>`;
            if(w.status === 'pending') pend.innerHTML += html;
            else hist.innerHTML += html;
        });
    });
}

function approve(key) { db.ref('withdrawals/' + key).update({ status: 'paid' }); }

// TIMERS & COOLDOWNS
function updateTimers() {
    setInterval(() => {
        const now = Date.now();
        updateBtnTimer('premium', now - (myData.lastPremium || 0), 30 * 60 * 1000);
        updateBtnTimer('surprise', now - (myData.lastSurprise || 0), 3 * 60 * 1000);
        
        const chatDiff = 5 * 60 * 1000 - (now - (myData.lastChat || 0));
        document.getElementById('timer-chat').innerText = chatDiff > 0 ? `Ad Cooldown: ${Math.ceil(chatDiff/1000)}s` : "Ads Ready for Chat";
    }, 1000);
}

function updateBtnTimer(id, diff, cooldown) {
    const el = document.getElementById('timer-' + id);
    const btn = document.getElementById('btn-' + id);
    if (diff < cooldown) {
        const rem = Math.ceil((cooldown - diff) / 1000);
        el.innerText = `${Math.floor(rem/60)}m ${rem%60}s`;
        btn.classList.add('cooldown');
    } else {
        el.innerText = "READY";
        btn.classList.remove('cooldown');
    }
}

function updatePresence() {
    const presRef = db.ref('presence/' + uid);
    presRef.set({ name: user.username || "Guest", time: Date.now() });
    presRef.onDisconnect().remove();
}

function loadChat() {
    db.ref('chat').limitToLast(30).on('value', snap => {
        const box = document.getElementById('chat-content');
        box.innerHTML = '';
        snap.forEach(child => {
            const c = child.val();
            box.innerHTML += `<div><span class="text-yellow-500 font-bold">@${c.username}:</span> ${c.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}
