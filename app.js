
// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast } 
from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// User Session Logic
let userId = localStorage.getItem('paperhouse_uid');
if (!userId) {
    userId = 'User_' + Math.floor(Math.random() * 1000000); // More unique ID
    localStorage.setItem('paperhouse_uid', userId);
}
document.getElementById('display-id').innerText = userId;

// Data Refs
const userRef = ref(db, 'users/' + userId);

// 1. Update Balance UI Real-time
// Initialize user data if it doesn't exist
get(userRef).then((snapshot) => {
    if (!snapshot.exists()) {
        set(userRef, { balance: 0, totalAds: 0, id: userId });
    }
});
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        document.getElementById('user-balance').innerText = (data.balance || 0).toFixed(2);
    }
});

// 2. Watch Ad Function
window.watchAd = function() {
    // Show Rewarded Popup ad
    show_10337795('pop').then(() => {
        // Ad watched successfully, reward the user
        get(userRef).then((snapshot) => {
            let current = snapshot.val() || { balance: 0, totalAds: 0 };
            update(userRef, {
                balance: (current.balance || 0) + 0.01,
                totalAds: (current.totalAds || 0) + 1
            });
            alert('Congratulations! ₱0.01 has been added to your balance.');
        });
    }).catch(e => {
        // User closed ad or an error occurred
        console.error("Monetag ad error:", e);
        alert('Ad could not be loaded or was closed. Please try again.');
    });
};

// 3. Chat Logic
window.sendMessage = function() {
    const input = document.getElementById('chat-input');
    if (input.value.trim() === "") return;
    const chatRef = ref(db, 'chat');
    push(chatRef, {
        user: userId,
        text: input.value,
        timestamp: Date.now()
    });
    input.value = "";
};

// Listen for new chat messages
onValue(query(ref(db, 'chat'), orderByChild('timestamp'), limitToLast(20)), (snapshot) => {
    const chatBox = document.getElementById('chat-messages');
    chatBox.innerHTML = "";
    snapshot.forEach(child => {
        const val = child.val();
        chatBox.innerHTML += `<div class="msg"><span class="msg-user">${val.user}:</span> ${val.text}</div>`;
    });
    chatBox.scrollTop = chatBox.scrollHeight; // Scroll to bottom
});

// 4. Leaderboard Logic
window.loadLeaderboard = function() {
    const leadRef = query(ref(db, 'users'), orderByChild('totalAds'), limitToLast(10));
    onValue(leadRef, (snapshot) => {
        const list = document.getElementById('leader-list');
        list.innerHTML = "";
        let leaders = [];
        snapshot.forEach(child => { leaders.push(child.val()); });
        leaders.sort((a, b) => (b.totalAds || 0) - (a.totalAds || 0)).forEach((u, index) => { // Ensure sorting is correct
            list.innerHTML += `
                <div class="leader-item">
                    <span>#${index+1} ${u.id}</span>
                    <span style="color:var(--primary)">${u.totalAds || 0} Ads Watched</span>
                </div>`;
        });
    });
};

// 5. Withdrawal Logic
window.requestWithdraw = function() {
    const gcashNumInput = document.getElementById('gcash-num');
    const num = gcashNumInput.value.trim();

    if (!/^(09|\+639)\d{9}$/.test(num)) { // Basic GCash number validation
        return alert('Please enter a valid Philippine mobile number (e.g., 09123456789).');
    }
    
    get(userRef).then(snap => {
        const bal = (snap.val() && snap.val().balance) || 0;
        if (bal < 0.02) {
            return alert('Minimum withdrawal is ₱0.02. You currently have ₱' + bal.toFixed(2));
        }
        
        const reqRef = ref(db, 'withdrawals');
        push(reqRef, { 
            userId, 
            amount: bal, 
            gcash: num, 
            status: 'pending', 
            timestamp: Date.now() 
        });
        update(userRef, { balance: 0 }); // Reset balance after withdrawal request
        alert('Withdrawal request for ₱' + bal.toFixed(2) + ' to ' + num + ' has been sent! Please wait for admin approval.');
        gcashNumInput.value = ''; // Clear input
    });
};

// 6. Admin Logic
window.checkAdmin = function() {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-content').style.display = 'block';
        loadAdminData();
    } else {
        alert('Access Denied: Incorrect Password');
    }
};

function loadAdminData() {
    onValue(query(ref(db, 'withdrawals'), orderByChild('timestamp')), (snapshot) => {
        const list = document.getElementById('request-list');
        list.innerHTML = "";
        let pendingRequests = [];
        snapshot.forEach(child => {
            const val = child.val();
            // You might want to filter only pending requests or add a "mark as paid" button
            pendingRequests.push({ key: child.key, ...val });
        });

        // Display in reverse chronological order
        pendingRequests.reverse().forEach(req => {
            const date = new Date(req.timestamp).toLocaleString();
            list.innerHTML += `
                <div class="admin-request">
                    <b>Request ID:</b> ${req.key}<br>
                    <b>User:</b> ${req.userId}<br>
                    <b>GCash:</b> ${req.gcash}<br>
                    <b>Amount:</b> ₱${req.amount.toFixed(2)}<br>
                    <b>Status:</b> ${req.status}<br>
                    <b>Date:</b> ${date}
                </div>`;
        });
        if (pendingRequests.length === 0) {
            list.innerHTML = "<p>No withdrawal requests at the moment.</p>";
        }
    });
}

// 7. Navigation Control
window.showView = function(viewId, btn) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active');

    // Load specific data when a view is activated
    if(viewId === 'leaderboard') loadLeaderboard();
};

// 8. Fun Feature: Background Color Change
window.changeBgColor = function() {
    const colors = ['#0f0f0f', '#1a0f0f', '#0f1a0f', '#0f0f1a', '#1a1a00', '#0a1d2e', '#2e0a1d']; // More varied colors
    const currentBg = document.body.style.backgroundColor;
    let newColor;
    do {
        newColor = colors[Math.floor(Math.random() * colors.length)];
    } while (newColor === currentBg); // Ensure a different color is picked
    document.body.style.backgroundColor = newColor;
};

// Monetag In-App Interstitial (optional, runs automatically based on settings)
// This will run when app.js loads. You might want to trigger it on specific actions or page loads if needed.
show_10337795({
  type: 'inApp',
  inAppSettings: { 
    frequency: 2, // show automatically 2 ads
    capping: 0.1, // within 0.1 hours (6 minutes)
    interval: 30, // with a 30-second interval between them
    timeout: 5, // and a 5-second delay before the first one is shown.
    everyPage: false // 0 means session will be saved when you navigate between pages
  }
});

