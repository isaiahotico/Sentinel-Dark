
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

let user = tg.initDataUnsafe?.user || { id: "0000", first_name: "Guest", username: "guest_user" };
let uid = user.id.toString();
let userData = null;

// Initial Connection
firebase.auth().signInAnonymously().then(() => {
    initApp();
});

function initApp() {
    // Real-time Username & Profile Setup
    document.getElementById('display-name').innerText = user.first_name;
    document.getElementById('display-username').innerText = `@${user.username || 'user'}`;
    if (user.photo_url) document.getElementById('user-avatar').src = user.photo_url;

    const userRef = db.ref('users/' + uid);
    userRef.on('value', (snap) => {
        userData = snap.val();
        if (!userData) {
            userData = {
                username: (user.username || 'user_' + uid).toLowerCase(),
                name: user.first_name,
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
            userRef.set(userData);
            // Map username for referral lookup
            db.ref('usernames/' + userData.username).set(uid);
        }
        updateRealtimeUI();
    });

    syncHistory();
    updatePresence();
}

function updateRealtimeUI() {
    document.getElementById('bal').innerText = userData.balance.toFixed(4);
    document.getElementById('ref-earned-text').innerText = (userData.refEarnings || 0).toFixed(4);
    
    if (userData.referredBy) {
        document.getElementById('ref-input-group').classList.add('hidden');
        document.getElementById('ref-status').classList.remove('hidden');
        document.getElementById('ref-status').innerText = "✓ Referral Active";
    }

    startTimers();
}

// AD SEQUENCES
async function watchPremiumAd() {
    try {
        await show_10276123(); // Interstitial 1
        await show_10276123(); // Interstitial 2
        processReward(0.0100, 'lastPremium', 2);
        tg.HapticFeedback.notificationOccurred('success');
    } catch(e) { alert("Ad sequence interrupted."); }
}

async function watchSurpriseAd() {
    show_10276123().then(() => {
        processReward(0.0102, 'lastSurprise', 1);
    });
}

async function sendChat() {
    const now = Date.now();
    if (now - (userData.lastChat || 0) < 5 * 60 * 1000) return alert("Chat cooldown!");
    
    const msg = document.getElementById('chat-input').value;
    if (!msg) return;

    // 3 Random Interstitial Ads Sequence (No Popups)
    try {
        tg.MainButton.setText("WATCHING ADS (1/3)").show();
        await show_10276123();
        tg.MainButton.setText("WATCHING ADS (2/3)");
        await show_10276123();
        tg.MainButton.setText("WATCHING ADS (3/3)");
        await show_10276123();
        tg.MainButton.hide();

        db.ref('chat').push({
            uid: uid,
            username: userData.username,
            text: msg,
            time: now
        });
        processReward(0.0201, 'lastChat', 3);
        document.getElementById('chat-input').value = '';
    } catch(e) { 
        tg.MainButton.hide();
        alert("Ad failed. Reward not granted."); 
    }
}

// REWARD SYSTEM (AUTO-CREDIT & 8% REFERRAL)
function processReward(amount, cooldownKey, adsAdded) {
    db.ref('users/' + uid).transaction((curr) => {
        if (curr) {
            curr.balance = (curr.balance || 0) + amount;
            curr.totalEarned = (curr.totalEarned || 0) + amount;
            curr.adsTotal = (curr.adsTotal || 0) + adsAdded;
            curr.adsDaily = (curr.adsDaily || 0) + adsAdded;
            curr[cooldownKey] = Date.now();
        }
        return curr;
    });

    // Handle Referral Commission (8%)
    if (userData.referredBy) {
        const commission = amount * 0.08;
        db.ref('users/' + userData.referredBy).transaction((refUser) => {
            if (refUser) {
                refUser.balance = (refUser.balance || 0) + commission;
                refUser.refEarnings = (refUser.refEarnings || 0) + commission;
            }
            return refUser;
        });
    }
}

// REFERRAL LOGIC
function applyReferral() {
    const code = document.getElementById('ref-code-input').value.toLowerCase().replace('@', '');
    if (code === userData.username) return alert("Invalid Code");

    db.ref('usernames/' + code).once('value', (snap) => {
        if (snap.exists()) {
            const referrerUid = snap.val();
            db.ref('users/' + uid + '/referredBy').set(referrerUid);
            tg.HapticFeedback.impactOccurred('medium');
            alert("Referral Applied Successfully!");
        } else {
            alert("Username not found!");
        }
    });
}

// WITHDRAWAL
function requestPayout() {
    const gcash = document.getElementById('gcash-num').value;
    if (gcash.length < 10) return alert("Invalid GCash Number");
    if (userData.balance < 0.02) return alert("Min. Withdrawal ₱0.02");

    const amount = userData.balance;
    const payoutRef = db.ref('withdrawals').push();
    
    payoutRef.set({
        uid: uid,
        username: userData.username,
        amount: amount,
        gcash: gcash,
        status: 'pending',
        timestamp: Date.now()
    }).then(() => {
        db.ref('users/' + uid + '/balance').set(0);
        tg.HapticFeedback.notificationOccurred('success');
        alert("Payout Requested!");
    });
}

// NAVIGATION
function nav(id) {
    document.querySelectorAll('main > div, main > section').forEach(s => s.classList.add('hidden-sec'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.replace('text-yellow-500', 'text-slate-400'));
    
    const target = document.getElementById('sec-' + id) || document.getElementById(id + '-section');
    if(target) target.classList.remove('hidden-sec');
    
    if (id === 'social') loadSocial();
    if (id === 'chat') loadChat();
}

// HELPERS
function loadSocial() {
    db.ref('users').orderByChild('totalEarned').limitToLast(10).on('value', snap => {
        const list = document.getElementById('leader-list');
        list.innerHTML = '';
        let items = [];
        snap.forEach(c => { items.push({key: c.key, ...c.val()}) });
        items.reverse().forEach((u, i) => {
            list.innerHTML += `
            <div class="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-white/5" onclick="viewUser('${u.key}')">
                <span class="text-xs font-bold">${i+1}. @${u.username}</span>
                <span class="text-yellow-500 font-black">₱${u.totalEarned.toFixed(2)}</span>
            </div>`;
        });
    });

    db.ref('presence').on('value', snap => {
        const list = document.getElementById('online-list');
        list.innerHTML = '';
        snap.forEach(c => {
            const o = c.val();
            list.innerHTML += `<div class="bg-green-500/10 text-green-400 p-2 rounded-lg text-[10px] text-center border border-green-500/20">● ${o.username}</div>`;
        });
    });
}

function loadChat() {
    db.ref('chat').limitToLast(25).on('value', snap => {
        const box = document.getElementById('chat-logs');
        box.innerHTML = '';
        snap.forEach(c => {
            const m = c.val();
            box.innerHTML += `<div class="animate-fade-in"><span class="text-yellow-500 font-bold" onclick="viewUser('${m.uid}')">@${m.username}:</span> ${m.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function syncHistory() {
    db.ref('withdrawals').orderByChild('uid').equalTo(uid).on('value', snap => {
        const box = document.getElementById('user-withdraw-history');
        box.innerHTML = '';
        snap.forEach(c => {
            const w = c.val();
            box.innerHTML += `
            <div class="flex justify-between text-[10px] bg-slate-900 p-2 rounded">
                <span>₱${w.amount.toFixed(2)}</span>
                <span class="${w.status === 'pending' ? 'text-yellow-500' : 'text-green-500'} uppercase font-bold">${w.status}</span>
            </div>`;
        });
    });
}

function viewUser(targetUid) {
    db.ref('users/' + targetUid).once('value', snap => {
        const u = snap.val();
        document.getElementById('profile-content').innerHTML = `
            <h2 class="text-xl font-black text-yellow-500">@${u.username}</h2>
            <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
                <div class="bg-slate-800 p-3 rounded-2xl">
                    <p class="text-slate-400 text-[10px]">Total Ads</p>
                    <p class="font-bold">${u.adsTotal || 0}</p>
                </div>
                <div class="bg-slate-800 p-3 rounded-2xl">
                    <p class="text-slate-400 text-[10px]">Today</p>
                    <p class="font-bold text-yellow-500">${u.adsDaily || 0}</p>
                </div>
            </div>
            <p class="mt-4 text-[10px] text-slate-500">Total Earned: ₱${u.totalEarned.toFixed(2)}</p>
        `;
        document.getElementById('profile-modal').classList.remove('hidden');
    });
}

function viewMyStats() { viewUser(uid); }
function closeProfile() { document.getElementById('profile-modal').classList.add('hidden'); }

// TIMERS
function startTimers() {
    setInterval(() => {
        const now = Date.now();
        updateBtn('premium', now - (userData.lastPremium || 0), 30 * 60 * 1000);
        updateBtn('surprise', now - (userData.lastSurprise || 0), 3 * 60 * 1000);
        
        const cDiff = (5 * 60 * 1000) - (now - (userData.lastChat || 0));
        document.getElementById('chat-cooldown-text').innerText = cDiff > 0 ? 
            `Ad cooldown: ${Math.ceil(cDiff/1000)}s` : "Ads ready to unlock chat";
    }, 1000);
}

function updateBtn(id, diff, cooldown) {
    const btn = document.getElementById('btn-' + id);
    const timer = document.getElementById('timer-' + id);
    if (diff < cooldown) {
        btn.classList.add('cooldown');
        const rem = Math.ceil((cooldown - diff) / 1000);
        timer.innerText = `${Math.floor(rem/60)}m ${rem%60}s`;
    } else {
        btn.classList.remove('cooldown');
        timer.innerText = "READY";
    }
}

function updatePresence() {
    const pRef = db.ref('presence/' + uid);
    pRef.set({ username: userData?.username || user.first_name, earnings: userData?.totalEarned || 0 });
    pRef.onDisconnect().remove();
}

// ADMIN PANEL
function doAdminLogin() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login-ui').classList.add('hidden-sec');
        document.getElementById('admin-panel').classList.remove('hidden-sec');
        loadAdminPanel();
    } else alert("Wrong Pin");
}

function loadAdminPanel() {
    db.ref('withdrawals').on('value', snap => {
        const pending = document.getElementById('admin-pending');
        const history = document.getElementById('admin-payout-history');
        pending.innerHTML = ''; history.innerHTML = '';
        snap.forEach(c => {
            const w = c.val();
            const ui = `
                <div class="glass p-3 rounded-xl border border-white/5">
                    <p><b>@${w.username}</b> | GCash: <b>${w.gcash}</b></p>
                    <p class="text-green-400 font-bold">₱${w.amount.toFixed(4)}</p>
                    ${w.status === 'pending' ? `<button onclick="approvePayout('${c.key}')" class="bg-green-600 w-full mt-2 p-1 rounded font-bold">APPROVE PAID</button>` : '<p class="text-[10px] text-slate-500 mt-1">COMPLETED</p>'}
                </div>`;
            if(w.status === 'pending') pending.innerHTML += ui;
            else history.innerHTML += ui;
        });
    });
}

function approvePayout(key) {
    db.ref('withdrawals/' + key).update({ status: 'paid' });
    tg.HapticFeedback.notificationOccurred('success');
}
