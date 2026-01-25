
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

let currentUser = null;
let userData = { balance: 0, totalEarned: 0 };

// Auto-Login (Anonymous for Telegram)
auth.signInAnonymously().catch(e => console.error(e));

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        setupUser();
        initApp();
    }
});

function setupUser() {
    const userRef = db.ref('users/' + currentUser.uid);
    userRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            userData = snapshot.val();
        } else {
            userData = {
                balance: 0,
                totalEarned: 0,
                username: "User_" + currentUser.uid.substr(0, 5)
            };
            userRef.set(userData);
        }
        updateUI();
    });
}

function updateUI() {
    document.getElementById('user-balance').innerText = userData.balance.toFixed(2);
    document.getElementById('user-total').innerText = userData.totalEarned.toFixed(2);
}

// ADS LOGIC
function watchInterstitial() {
    show_10276123().then(() => {
        rewardUser(0.01);
        alert("Success! ₱ 0.01 added.");
    }).catch(e => alert("Ad failed to load. Try again."));
}

function watchPopup() {
    show_10276123('pop').then(() => {
        rewardUser(0.005); // Smaller reward for popups
    });
}

// In-App Ad auto-trigger
show_10276123({
    type: 'inApp',
    inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
});

function rewardUser(amount) {
    const userRef = db.ref('users/' + currentUser.uid);
    userRef.transaction((currentData) => {
        if (currentData) {
            currentData.balance = (currentData.balance || 0) + amount;
            currentData.totalEarned = (currentData.totalEarned || 0) + amount;
        }
        return currentData;
    });
}

// WITHDRAWAL
function requestWithdrawal() {
    const gcash = document.getElementById('gcash-num').value;
    if (gcash.length < 10) return alert("Enter valid GCash number");
    if (userData.balance < 0.02) return alert("Minimum withdrawal is ₱ 0.02");

    const amount = userData.balance;
    const withdrawRef = db.ref('withdrawals').push();
    
    withdrawRef.set({
        uid: currentUser.uid,
        gcash: gcash,
        amount: amount,
        status: 'pending',
        timestamp: Date.now()
    }).then(() => {
        db.ref('users/' + currentUser.uid + '/balance').set(0);
        alert("Withdrawal Requested! Processing takes 24h.");
    });
}

// NAVIGATION
function showSec(secId) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden-section'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('sec-' + secId).classList.remove('hidden-section');
    document.getElementById('btn-' + secId).classList.add('active');
    
    if(secId === 'chat') loadChat();
    if(secId === 'leaders') loadLeaders();
}

// CHAT SYSTEM
function sendMessage() {
    const msg = document.getElementById('chat-input').value;
    if (!msg) return;
    db.ref('chat').push({
        user: userData.username,
        text: msg,
        time: Date.now()
    });
    document.getElementById('chat-input').value = '';
}

function loadChat() {
    db.ref('chat').limitToLast(20).on('value', (snap) => {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = '';
        snap.forEach(child => {
            const data = child.val();
            chatBox.innerHTML += `<div><span class="text-yellow-500 font-bold">${data.user}:</span> ${data.text}</div>`;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

// LEADERBOARD
function loadLeaders() {
    db.ref('users').orderByChild('totalEarned').limitToLast(10).on('value', (snap) => {
        const list = document.getElementById('leader-list');
        list.innerHTML = '';
        let rank = 1;
        let arr = [];
        snap.forEach(c => { arr.push(c.val()); });
        arr.reverse().forEach(user => {
            list.innerHTML += `
                <div class="flex justify-between items-center border-b border-slate-700 pb-2">
                    <span>${rank++}. ${user.username}</span>
                    <span class="text-green-400 font-bold">₱ ${user.totalEarned.toFixed(2)}</span>
                </div>`;
        });
    });
}

// ADMIN PANEL
function loginAdmin() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-panel').style.display = 'block';
        loadAdminData();
    } else {
        alert("Wrong Password");
    }
}

function loadAdminData() {
    db.ref('withdrawals').on('value', (snap) => {
        const div = document.getElementById('admin-withdrawals');
        div.innerHTML = '';
        snap.forEach(child => {
            const w = child.val();
            if(w.status === 'pending') {
                div.innerHTML += `
                <div class="p-3 bg-slate-800 rounded text-xs flex justify-between items-center">
                    <div>GCash: ${w.gcash}<br>Amount: ₱ ${w.amount.toFixed(2)}</div>
                    <button onclick="approveWithdrawal('${child.key}')" class="bg-green-600 px-2 py-1 rounded">Paid</button>
                </div>`;
            }
        });
    });
}

function approveWithdrawal(key) {
    db.ref('withdrawals/' + key).update({ status: 'completed' });
}
