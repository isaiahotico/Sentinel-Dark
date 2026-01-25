
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

const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? (tgUser.username || tgUser.first_name) : "User_" + Math.floor(Math.random()*999);
const userId = tgUser ? tgUser.id : "ID_" + username;

let localData = null;

// Background Color Shift
function changeBg() {
    const colors = ['#0a0a0a', '#1a0d00', '#0d1a00', '#000d1a', '#111'];
    document.body.style.backgroundColor = colors[Math.floor(Math.random()*colors.length)];
}

function nav(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// User Initialization & Registration
db.ref('users/' + userId).on('value', snap => {
    const data = snap.val();
    if (!data || !data.gcash) {
        document.getElementById('reg-overlay').style.display = 'flex';
    } else {
        document.getElementById('reg-overlay').style.display = 'none';
        localData = data;
        updateUI();
    }
});

function registerUser() {
    const name = document.getElementById('reg-name').value;
    const gcash = document.getElementById('reg-gcash').value;
    if (!name || gcash.length < 10) return alert("Valid Name & GCash Required");

    db.ref('users/' + userId).update({
        username: username,
        realName: name,
        gcash: gcash,
        balance: 0,
        referralBonus: 0,
        lastSeen: Date.now()
    });
}

function updateUI() {
    document.getElementById('user-balance').innerText = localData.balance.toFixed(4);
    document.getElementById('top-user').innerText = "👤 @" + username;
    document.getElementById('top-gcash').innerText = "📱 GCash: " + localData.gcash;
    document.getElementById('my-code').innerText = username;
    document.getElementById('ref-bonus').innerText = (localData.referralBonus || 0).toFixed(2);
}

// --- MONETAG ADS LOGIC ---
const cooldowns = {};

function startCd(label, sec) {
    cooldowns[label] = Date.now() + (sec * 1000);
    const el = document.getElementById('cd-' + label);
    const inv = setInterval(() => {
        let rem = Math.ceil((cooldowns[label] - Date.now())/1000);
        if(rem <= 0) { el.innerText="Ready"; clearInterval(inv); }
        else el.innerText = Math.floor(rem/60) + "m " + (rem%60) + "s";
    }, 1000);
}

function rewardAd(label, zone, amt, cd) {
    if (Date.now() < (cooldowns[label] || 0)) return alert("Cooldown active!");
    // Trigger Monetag
    try {
        window['show_' + zone]().then(() => {
            credit(amt); startCd(label, cd);
        }).catch(() => {
            // Fallback reward if ad failed but attempt made
            credit(amt); startCd(label, cd); 
        });
    } catch(e) {
        credit(amt); startCd(label, cd);
    }
}

function rewardRewarded(label, zone, amt, cd) {
    if (Date.now() < (cooldowns[label] || 0)) return alert("Cooldown!");
    const fn = window['show_' + zone];
    if (typeof fn === 'function') {
        fn('pop').then(() => { credit(amt); startCd(label, cd); });
    }
}

function credit(amt) {
    db.ref('users/' + userId + '/balance').set(firebase.database.ServerValue.increment(amt));
    if (localData.referrer) {
        db.ref('users').orderByChild('username').equalTo(localData.referrer).once('value', s => {
            s.forEach(c => db.ref('users/' + c.key + '/referralBonus').set(firebase.database.ServerValue.increment(amt * 0.08)));
        });
    }
    tg?.HapticFeedback?.notificationOccurred('success');
}

// Auto Ads (Every 3 mins)
setInterval(() => {
    const zones = ['10337853', '10276123'];
    const z = zones[Math.floor(Math.random()*zones.length)];
    if(window['show_'+z]) window['show_'+z]({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5 } });
}, 180000);

// --- WITHDRAWALS ---
function submitWd() {
    const amt = parseFloat(document.getElementById('wd-amt').value);
    if (amt < 1 || amt > localData.balance) return alert("Invalid amount");
    
    const req = {
        userId, username, amount: amt, gcash: localData.gcash, name: localData.realName,
        status: 'Pending', date: new Date().toLocaleString()
    };
    db.ref('withdrawals').push(req);
    db.ref('users/' + userId + '/balance').set(firebase.database.ServerValue.increment(-amt));
    alert("Request Sent!");
}

db.ref('withdrawals').orderByChild('userId').equalTo(userId).on('value', snap => {
    let html = '';
    snap.forEach(c => {
        const w = c.val();
        html += `<tr><td>${w.date}</td><td>₱${w.amount}</td><td style="color:${w.status=='Approved'?'lime':'orange'}">${w.status}</td></tr>`;
    });
    document.getElementById('user-history').innerHTML = html;
});

// --- ADMIN ---
function loginAdmin() {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').style.display='none';
        document.getElementById('admin-panel').style.display='block';
        loadAdmin();
    }
}

function loadAdmin() {
    db.ref('withdrawals').on('value', snap => {
        let pend = '<tr><th>User</th><th>Amt</th><th>Action</th></tr>';
        let appr = '<tr><th>User</th><th>GCash</th><th>Amt</th><th>Date</th></tr>';
        snap.forEach(c => {
            const w = c.val();
            if (w.status === 'Pending') {
                pend += `<tr><td>${w.username}</td><td>₱${w.amount}</td><td><button onclick="approveWd('${c.key}')">✔</button></td></tr>`;
            } else if (w.status === 'Approved') {
                appr += `<tr><td>${w.username}</td><td>${w.gcash}</td><td>₱${w.amount}</td><td>${w.date}</td></tr>`;
            }
        });
        document.getElementById('admin-pending').innerHTML = pend;
        document.getElementById('admin-approved').innerHTML = appr;
    });
}

function approveWd(key) {
    db.ref('withdrawals/' + key + '/status').set('Approved');
    alert("Approved!");
}

// --- REFERRALS ---
function bindRef() {
    const code = document.getElementById('ref-input').value;
    if (code === username || localData.referrer) return alert("Invalid or already bound");
    db.ref('users').orderByChild('username').equalTo(code).once('value', s => {
        if (s.exists()) {
            db.ref('users/' + userId + '/referrer').set(code);
            s.forEach(c => db.ref('users/' + c.key + '/refCount').set(firebase.database.ServerValue.increment(1)));
            alert("Referrer bound!");
        }
    });
}

function claimRef() {
    const b = localData.referralBonus || 0;
    if (b <= 0) return;
    db.ref('users/' + userId + '/balance').set(firebase.database.ServerValue.increment(b));
    db.ref('users/' + userId + '/referralBonus').set(0);
}
