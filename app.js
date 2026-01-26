
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

// Real-time Telegram Data
let user = tg.initDataUnsafe?.user || { id: "local_dev", first_name: "Developer", username: "dev_user" };
let myUid = user.id.toString();
let userData = null;
let currentReward = { amt: 0, key: '', ads: 0, msg: '' };

// Fast Simulation & Auth
setTimeout(() => document.getElementById('splash').style.display = 'none', 1600);

firebase.auth().signInAnonymously().then(() => {
    initRealtime();
});

function initRealtime() {
    // Immediate username sync
    const username = (user.username || 'user_' + myUid).toLowerCase();
    document.getElementById('my-username-display').innerText = `@${username}`;
    document.getElementById('ref-code-display').innerText = `@${username}`;
    if(user.photo_url) document.getElementById('my-avatar').src = user.photo_url;

    db.ref('users/' + myUid).on('value', (snap) => {
        userData = snap.val();
        if (!userData) {
            userData = {
                username: username,
                balance: 0, totalEarned: 0, refEarned: 0,
                adsTotal: 0, adsDaily: 0,
                lastPremium: 0, lastSurprise: 0, lastChat: 0,
                referredBy: ""
            };
            db.ref('users/' + myUid).set(userData);
            db.ref('usernames/' + username).set(myUid);
        }
        document.getElementById('main-bal').innerText = userData.balance.toFixed(4);
        if(userData.referredBy) {
            document.getElementById('ref-input-area').classList.add('hidden');
            document.getElementById('ref-status').classList.remove('hidden');
        }
    });

    listenToWithdrawals();
    listenToPresence();
    startCooldowns();
}

// ADS LOGIC WITH CLAIM BUTTON
async function watchPremiumAd() {
    try {
        tg.MainButton.setText("WATCHING AD 1/2...").show();
        await show_10276123();
        tg.MainButton.setText("WATCHING AD 2/2...");
        await show_10276123();
        tg.MainButton.hide();
        openClaim(0.0100, 'lastPremium', 2);
    } catch(e) { alert("Ad failed."); tg.MainButton.hide(); }
}

async function watchSurpriseAd() {
    show_10276123().then(() => openClaim(0.0102, 'lastSurprise', 1));
}

async function watchChatAds() {
    const msg = document.getElementById('chat-input').value;
    if(!msg) return;
    const now = Date.now();
    if(now - (userData.lastChat || 0) < 5*60*1000) return alert("Chat Cooldown!");

    try {
        tg.MainButton.setText("UNLOCKING CHAT (3 ADS)...").show();
        await show_10276123();
        await show_10276123();
        await show_10276123();
        tg.MainButton.hide();
        openClaim(0.0201, 'lastChat', 3, msg);
        document.getElementById('chat-input').value = '';
    } catch(e) { tg.MainButton.hide(); alert("Sequence error."); }
}

function openClaim(amt, key, ads, msg = '') {
    currentReward = { amt, key, ads, msg };
    document.getElementById('claim-val').innerText = amt.toFixed(4);
    document.getElementById('claim-overlay').style.display = 'flex';
}

function executeClaim() {
    document.getElementById('claim-overlay').style.display = 'none';
    const r = currentReward;

    db.ref('users/' + myUid).transaction((u) => {
        if(u) {
            u.balance = (u.balance || 0) + r.amt;
            u.totalEarned = (u.totalEarned || 0) + r.amt;
            u.adsTotal = (u.adsTotal || 0) + r.ads;
            u.adsDaily = (u.adsDaily || 0) + r.ads;
            u[r.key] = Date.now();
        }
        return u;
    });

    if(r.msg) db.ref('chat').push({ username: userData.username, text: r.msg, time: Date.now() });

    // 8% Auto-credit referral
    if(userData.referredBy) {
        const com = r.amt * 0.08;
        db.ref('users/' + userData.referredBy).transaction((ref) => {
            if(ref) {
                ref.balance = (ref.balance || 0) + com;
                ref.refEarned = (ref.refEarned || 0) + com;
                ref.totalEarned = (ref.totalEarned || 0) + com;
            }
            return ref;
        });
    }
    tg.HapticFeedback.notificationOccurred('success');
}

// REFERRAL BY USERNAME
function bindReferrer() {
    const code = document.getElementById('ref-input').value.toLowerCase().replace('@','');
    if(code === userData.username) return alert("Can't refer self.");
    
    db.ref('usernames/' + code).once('value', s => {
        if(s.exists()) {
            db.ref('users/' + myUid).update({ referredBy: s.val() });
            alert("Referral Applied!");
        } else alert("Username not found!");
    });
}

// WITHDRAWAL
function payout() {
    const num = document.getElementById('gcash-num').value;
    if(num.length < 10) return alert("Invalid GCash.");
    if(userData.balance < 0.02) return alert("Min. ₱0.02 required.");

    db.ref('withdrawals').push({
        uid: myUid, username: userData.username, gcash: num,
        amount: userData.balance, status: 'pending', time: Date.now()
    });
    db.ref('users/' + myUid + '/balance').set(0);
    tg.HapticFeedback.impactOccurred('heavy');
}

function listenToWithdrawals() {
    db.ref('withdrawals').orderByChild('uid').equalTo(myUid).on('value', s => {
        const list = document.getElementById('withdraw-list');
        list.innerHTML = '';
        s.forEach(c => {
            const w = c.val();
            list.innerHTML += `<div class="flex justify-between text-[9px] bg-slate-900/50 p-2 rounded"><span>₱${w.amount.toFixed(2)}</span><span class="${w.status=='paid'?'text-green-500':'text-yellow-500'} font-black">${w.status.toUpperCase()}</span></div>`;
        });
    });
}

// CORE UI
function switchTab(id) {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden-sec'));
    document.getElementById('tab-' + id).classList.remove('hidden-sec');
    document.querySelectorAll('.nav-item').forEach(b => b.classList.replace('text-yellow-500', 'text-slate-500'));
    event.currentTarget.classList.replace('text-slate-500', 'text-yellow-500');
    if(id === 'social') loadLeaders();
    if(id === 'chat') loadChat();
}

function loadLeaders() {
    db.ref('users').orderByChild('totalEarned').limitToLast(10).on('value', snap => {
        const l = document.getElementById('leader-list');
        l.innerHTML = '';
        let items = [];
        snap.forEach(c => items.push({key: c.key, ...c.val()}));
        items.reverse().forEach((u, i) => {
            l.innerHTML += `<div class="flex justify-between p-3 glass rounded-2xl text-xs" onclick="openProfile('${u.key}')"><span>${i+1}. @${u.username}</span><span class="text-yellow-500 font-black">₱${u.totalEarned.toFixed(2)}</span></div>`;
        });
    });
}

function openProfile(uidToFetch) {
    db.ref('users/' + uidToFetch).once('value', s => {
        const u = s.val();
        document.getElementById('user-modal-data').innerHTML = `
            <h2 class="text-xl font-black text-yellow-500">@${u.username}</h2>
            <div class="grid grid-cols-2 gap-3 mt-6">
                <div class="bg-slate-900 p-3 rounded-2xl"><p class="text-[9px] text-slate-500 uppercase">Total Ads</p><p class="text-lg font-black">${u.adsTotal}</p></div>
                <div class="bg-slate-900 p-3 rounded-2xl"><p class="text-[9px] text-slate-500 uppercase">Daily Ads</p><p class="text-lg font-black text-yellow-500">${u.adsDaily}</p></div>
            </div>
            <p class="text-[10px] text-slate-500 font-bold mt-4">LIFETIME: ₱${u.totalEarned.toFixed(4)}</p>
        `;
        document.getElementById('user-modal').classList.remove('hidden');
    });
}

function loadChat() {
    db.ref('chat').limitToLast(30).on('value', s => {
        const box = document.getElementById('chat-logs');
        box.innerHTML = '';
        s.forEach(c => {
            const m = c.val();
            box.innerHTML += `<div><span class="text-yellow-500 font-bold">@${m.username}:</span> ${m.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// ADMIN PANEL
function checkAdmin() {
    if(document.getElementById('admin-pin').value === "Propetas12") {
        document.getElementById('admin-gate').classList.add('hidden-sec');
        document.getElementById('admin-body').classList.remove('hidden-sec');
        initAdminPanel();
    } else alert("Wrong Password");
}

function initAdminPanel() {
    db.ref('withdrawals').on('value', s => {
        const p = document.getElementById('adm-pending');
        const d = document.getElementById('adm-done');
        p.innerHTML = ''; d.innerHTML = '';
        s.forEach(c => {
            const w = c.val();
            const ui = `<div class="glass p-3 rounded-xl">@${w.username} | GCash: ${w.gcash}<br><b>₱${w.amount.toFixed(4)}</b> ${w.status=='pending'?`<button onclick="approvePayout('${c.key}')" class="bg-green-600 px-2 rounded ml-4">APPROVE</button>`:''}</div>`;
            if(w.status === 'pending') p.innerHTML += ui; else d.innerHTML += ui;
        });
    });
}

function approvePayout(key) { db.ref('withdrawals/' + key).update({ status: 'paid' }); }

// UTILS
function startCooldowns() {
    setInterval(() => {
        const now = Date.now();
        updateT('premium', now - (userData?.lastPremium || 0), 30*60*1000);
        updateT('surprise', now - (userData?.lastSurprise || 0), 3*60*1000);
        const cd = (5*60*1000) - (now - (userData?.lastChat || 0));
        document.getElementById('chat-tm').innerText = cd > 0 ? `Ad Cooldown: ${Math.ceil(cd/1000)}s` : "Ads ready to unlock chat";
    }, 1000);
}

function updateT(id, diff, cd) {
    const b = document.getElementById('btn-' + id);
    const t = document.getElementById('tm-' + id);
    if(diff < cd) {
        b.classList.add('cooldown');
        const rem = Math.ceil((cd - diff)/1000);
        t.innerText = `${Math.floor(rem/60)}m ${rem%60}s`;
        t.className = "text-[10px] font-black bg-slate-700 text-slate-400 px-3 py-1 rounded-full";
    } else {
        b.classList.remove('cooldown');
        t.innerText = "READY";
        t.className = `text-[10px] font-black ${id=='premium'?'bg-yellow-500':'bg-purple-500'} text-white px-3 py-1 rounded-full`;
    }
}

function listenToPresence() {
    const pRef = db.ref('presence/' + myUid);
    pRef.set({ username: user.username || 'user', total: userData?.totalEarned || 0 });
    pRef.onDisconnect().remove();
    db.ref('presence').on('value', s => {
        const l = document.getElementById('online-list');
        l.innerHTML = '';
        s.forEach(c => l.innerHTML += `<div class="bg-slate-900 p-2 rounded-lg border border-white/5 truncate">● @${c.val().username}</div>`);
    });
}
