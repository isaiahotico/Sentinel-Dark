
// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- TELEGRAM INIT ---
const tg = window.Telegram.WebApp;
tg.expand();
const user = tg.initDataUnsafe?.user || { id: 12345, username: "Guest_User" };
const userId = user.id.toString();

document.getElementById('user-display').innerText = `@${user.username}`;

let currentBalance = 0;
let lastVipTime = 0;
let lastPremiumTime = 0;

// --- CORE FUNCTIONS ---

// Real-time Sync
db.collection("users").doc(userId).onSnapshot((doc) => {
    if (doc.exists) {
        currentBalance = doc.data().balance || 0;
        lastVipTime = doc.data().lastVip || 0;
        lastPremiumTime = doc.data().lastPremium || 0;
        document.getElementById('user-balance').innerText = `₱ ${currentBalance.toFixed(4)}`;
        updateCooldowns();
    } else {
        db.collection("users").doc(userId).set({ balance: 0, username: user.username });
    }
});

// Sync History
db.collection("withdrawals")
    .where("userId", "==", userId)
    .orderBy("timestamp", "desc")
    .onSnapshot(snapshot => {
        let html = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <div class="history-item">
                    <b>₱${data.amount}</b> - ${data.status} <br>
                    <small>${new Date(data.timestamp).toLocaleString()}</small>
                </div>`;
        });
        document.getElementById('history-list').innerHTML = html;
    });

// --- AD LOGIC ---

function updateCooldowns() {
    const now = Date.now();
    
    // VIP Cooldown (1 min)
    const vipDiff = now - lastVipTime;
    const vipBtn = document.getElementById('vip-btn');
    if (vipDiff < 60000) {
        vipBtn.disabled = true;
        vipBtn.innerText = `Wait ${Math.ceil((60000 - vipDiff)/1000)}s`;
    } else {
        vipBtn.disabled = false;
        vipBtn.innerHTML = `🎖🎉VIP ADS🎉🎖 <br> <small>Reward: ₱0.0102 (1m CD)</small>`;
    }

    // Premium Cooldown (2 mins)
    const premDiff = now - lastPremiumTime;
    const premBtn = document.getElementById('premium-btn');
    if (premDiff < 120000) {
        premBtn.disabled = true;
        premBtn.innerText = `Wait ${Math.ceil((120000 - premDiff)/1000)}s`;
    } else {
        premBtn.disabled = false;
        premBtn.innerHTML = `🎖PREMIUM🎉ADS🎖 <br> <small>Reward: ₱0.0185 (2m CD)</small>`;
    }
}

setInterval(updateCooldowns, 1000);

async function showVipAd() {
    const adIds = ['10276123', '10337795', '10337853'];
    const randomId = adIds[Math.floor(Math.random() * adIds.length)];
    
    // Using the Monetag function provided
    window[`show_${randomId}`]('pop').then(() => {
        rewardUser(0.0102, "lastVip");
        alert("Success! Reward Added.");
    }).catch(e => {
        alert("Ad failed to load. Check internet or Adblock.");
    });
}

async function showPremiumAd() {
    // Chain 3 ads as requested
    try {
        await show_10276123();
        await show_1033795();
        await show_10337853();
        
        rewardUser(0.0185, "lastPremium");
        alert("Premium Reward Added!");
    } catch(e) {
        alert("Ads failed to load.");
    }
}

function rewardUser(amount, type) {
    db.collection("users").doc(userId).update({
        balance: firebase.firestore.FieldValue.increment(amount),
        [type]: Date.now()
    });
}

// --- WITHDRAWAL SYSTEM ---

function requestWithdrawal() {
    const num = document.getElementById('gcash-num').value;
    const amt = parseFloat(document.getElementById('wd-amount').value);

    if (amt < 1) return alert("Minimum withdrawal is ₱1");
    if (amt > currentBalance) return alert("Insufficient balance");
    if (!num) return alert("Enter GCash number");

    db.collection("withdrawals").add({
        userId: userId,
        username: user.username,
        gcashNumber: num,
        amount: amt,
        status: "Pending",
        timestamp: Date.now()
    }).then(() => {
        db.collection("users").doc(userId).update({
            balance: firebase.firestore.FieldValue.increment(-amt)
        });
        alert("Withdrawal Request Sent!");
    });
}

// --- ADMIN DASHBOARD ---

function openAdminPrompt() {
    const pw = prompt("Enter Admin Password:");
    if (pw === "Propetas12") {
        document.getElementById('app').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        loadAdminData();
    } else {
        alert("Wrong Password");
    }
}

function closeAdmin() {
    document.getElementById('app').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
}

function loadAdminData() {
    db.collection("withdrawals")
        .where("status", "==", "Pending")
        .onSnapshot(snapshot => {
            let html = "<h3>Pending Requests</h3>";
            snapshot.forEach(doc => {
                const data = doc.data();
                html += `
                    <div class="history-item" style="border-left-color: #00ff00">
                        <b>User:</b> @${data.username}<br>
                        <b>Amount:</b> ₱${data.amount}<br>
                        <b>GCash:</b> ${data.gcashNumber}<br>
                        <button class="btn-gold" style="padding:5px 10px; margin-top:5px" 
                                onclick="approveWithdrawal('${doc.id}')">APPROVE</button>
                    </div>`;
            });
            document.getElementById('pending-withdrawals').innerHTML = html;
        });
}

function approveWithdrawal(docId) {
    db.collection("withdrawals").doc(docId).update({
        status: "Approved"
    }).then(() => alert("Request Approved and moved to History"));
}
