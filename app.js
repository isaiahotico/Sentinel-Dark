
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, push, update, increment, query, orderByChild, limitToLast, startAt, endAt } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { get, child } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram.WebApp;
tg.expand();

const userId = tg.initDataUnsafe?.user?.id || "test_user_" + Math.floor(Math.random() * 1000);
const userName = tg.initDataUnsafe?.user?.first_name || "Guest User";

let currentBalance = 0;
let currentChatPoints = 0;

// Cooldown Timers
let earnAdCooldown = 0;
let turboAdCooldown = 0;
let chatPointsCooldown = 0;

const userRef = ref(db, 'users/' + userId);
const chatRef = ref(db, 'chat');
const withdrawalsRef = ref(db, 'withdrawals');
const withdrawalHistoryRef = ref(db, 'withdrawal_history');
const totalApprovedRef = ref(db, 'admin/total_approved');

// Initialize User & Load Data
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        currentBalance = data.balance || 0;
        currentChatPoints = data.chatPoints || 0;
        document.getElementById('user-balance').innerText = currentBalance.toFixed(2);
        document.getElementById('user-chat-points').innerText = currentChatPoints;
        
        // Update cooldowns based on stored timestamps
        const now = Date.now();
        if (data.lastEarnTimestamp) {
            const timeElapsed = (now - data.lastEarnTimestamp) / 1000;
            const cooldownDuration = 180; // 3 minutes in seconds
            if (timeElapsed < cooldownDuration) {
                startEarnAdCooldown(cooldownDuration - timeElapsed);
            }
        }
        if (data.lastTurboTimestamp) {
            const timeElapsed = (now - data.lastTurboTimestamp) / 1000;
            const cooldownDuration = 45; // 45 seconds
            if (timeElapsed < cooldownDuration) {
                startTurboAdCooldown(cooldownDuration - timeElapsed);
            }
        }
        if (data.lastChatPointsTimestamp) {
            const timeElapsed = (now - data.lastChatPointsTimestamp) / 1000;
            const cooldownDuration = 300; // 5 minutes in seconds
            if (timeElapsed < cooldownDuration) {
                startChatPointsCooldown(cooldownDuration - timeElapsed);
            }
        }
    } else {
        set(userRef, {
            username: userName,
            balance: 0,
            chatPoints: 0,
            totalAds: 0,
            lastEarnTimestamp: 0,
            lastTurboTimestamp: 0,
            lastChatPointsTimestamp: 0
        });
    }
});

// Load Withdrawal History
onValue(query(withdrawalHistoryRef, orderByChild('userId'), endAt(userId)), (snapshot) => {
    const list = document.getElementById('withdrawal-history-list');
    list.innerHTML = "";
    snapshot.forEach(child => {
        const hist = child.val();
        if (hist.userId === userId) { // Double check userId for filtering
            list.innerHTML += `
                <div class="glass p-3 text-xs flex justify-between items-center rounded-lg">
                    <div>
                        <p>GCash: ${hist.gcash || 'N/A'}</p>
                        <p class="text-green-400 font-bold">₱${hist.amount.toFixed(2)}</p>
                        <p class="opacity-70">${new Date(hist.timestamp).toLocaleString()}</p>
                    </div>
                    <span class="bg-blue-600 px-2 py-1 rounded font-bold">${hist.status.toUpperCase()}</span>
                </div>
            `;
        }
    });
});

// Routing Logic
window.showTab = (tabId, el) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active-tab'));
    document.getElementById(tabId).classList.add('active');
    el.classList.add('active-tab');
    
    if(tabId === 'leaderboard') loadLeaderboard();
    if(tabId === 'chat') loadChat();
    if(tabId === 'wallet') loadWithdrawalHistory(); // Ensure history is loaded when tab is shown
    if(tabId === 'admin') {
        document.getElementById('admin-login').classList.remove('hidden');
        document.getElementById('admin-panel').classList.add('hidden');
        document.getElementById('admin-pass').value = '';
    }
};

// ADS LOGIC

// Normal Earn Ad
function startEarnAdCooldown(seconds) {
    const button = document.getElementById('earn-ad-button');
    const cooldownText = document.getElementById('earn-ad-cooldown');
    button.disabled = true;
    cooldownText.innerText = `Cooldown: ${Math.ceil(seconds)}s`;
    earnAdCooldown = setInterval(() => {
        seconds--;
        cooldownText.innerText = `Cooldown: ${Math.ceil(seconds)}s`;
        if (seconds <= 0) {
            clearInterval(earnAdCooldown);
            button.disabled = false;
            cooldownText.innerText = "Cooldown: 3 minutes";
        }
    }, 1000);
}

window.watchAd = () => {
    const now = Date.now();
    const lastEarn = (await get(child(userRef, 'lastEarnTimestamp'))).val() || 0;
    const timeSinceLastEarn = (now - lastEarn) / 1000;
    const cooldownDuration = 180; // 3 minutes in seconds

    if (timeSinceLastEarn < cooldownDuration) {
        tg.showAlert(`Please wait ${Math.ceil(cooldownDuration - timeSinceLastEarn)} seconds.`);
        return;
    }

    tg.MainButton.setText("LOADING AD...").show();
    
    show_10276123('pop').then(() => { // Rewarded Interstitial
        show_10276123('pop').then(() => { // Second Rewarded Interstitial
            const rewardAmount = 0.0102;
            update(userRef, {
                balance: increment(rewardAmount),
                totalAds: increment(1),
                lastEarnTimestamp: Date.now()
            });
            tg.showAlert(`Congrats! ₱${rewardAmount.toFixed(4)} added to your balance.`);
            tg.MainButton.hide();
            startEarnAdCooldown(cooldownDuration);
        }).catch(e => {
            tg.showAlert("Second ad failed. Please try again.");
            tg.MainButton.hide();
        });
    }).catch(e => {
        tg.showAlert("First ad failed. Please try again.");
        tg.MainButton.hide();
    });
};

// Turbo Ad
function startTurboAdCooldown(seconds) {
    const button = document.getElementById('turbo-ad-button');
    const cooldownText = document.getElementById('turbo-ad-cooldown');
    button.disabled = true;
    cooldownText.innerText = `Cooldown: ${Math.ceil(seconds)}s`;
    turboAdCooldown = setInterval(() => {
        seconds--;
        cooldownText.innerText = `Cooldown: ${Math.ceil(seconds)}s`;
        if (seconds <= 0) {
            clearInterval(turboAdCooldown);
            button.disabled = false;
            cooldownText.innerText = "Cooldown: 45 seconds";
        }
    }, 1000);
}

window.watchTurboAd = () => {
    const now = Date.now();
    const lastTurbo = (await get(child(userRef, 'lastTurboTimestamp'))).val() || 0;
    const timeSinceLastTurbo = (now - lastTurbo) / 1000;
    const cooldownDuration = 45; // 45 seconds

    if (timeSinceLastTurbo < cooldownDuration) {
        tg.showAlert(`Please wait ${Math.ceil(cooldownDuration - timeSinceLastTurbo)} seconds.`);
        return;
    }

    tg.MainButton.setText("LOADING TURBO ADS...").show();
    
    // Show two rewarded interstitial ads combined
    show_10276123('pop').then(() => { 
        show_10276123('pop').then(() => {
            const rewardAmount = 0.012;
            update(userRef, {
                balance: increment(rewardAmount),
                totalAds: increment(2), // Count both ads
                lastTurboTimestamp: Date.now()
            });
            tg.showAlert(`Turbo Boost Activated! ₱${rewardAmount.toFixed(3)} added to your balance.`);
            tg.MainButton.hide();
            startTurboAdCooldown(cooldownDuration);
        }).catch(e => {
            tg.showAlert("Second turbo ad failed. Please try again.");
            tg.MainButton.hide();
        });
    }).catch(e => {
        tg.showAlert("First turbo ad failed. Please try again.");
        tg.MainButton.hide();
    });
};

// Earn Chat Points
function startChatPointsCooldown(seconds) {
    const button = document.getElementById('earn-chat-points-button');
    const cooldownText = document.getElementById('earn-chat-points-cooldown');
    button.disabled = true;
    cooldownText.innerText = `Cooldown: ${Math.ceil(seconds)}s`;
    chatPointsCooldown = setInterval(() => {
        seconds--;
        cooldownText.innerText = `Cooldown: ${Math.ceil(seconds)}s`;
        if (seconds <= 0) {
            clearInterval(chatPointsCooldown);
            button.disabled = false;
            cooldownText.innerText = "Cooldown: 5 minutes";
        }
    }, 1000);
}

window.earnChatPoints = async () => {
    const now = Date.now();
    const lastChatPoints = (await get(child(userRef, 'lastChatPointsTimestamp'))).val() || 0;
    const timeSinceLastChatPoints = (now - lastChatPoints) / 1000;
    const cooldownDuration = 300; // 5 minutes in seconds

    if (timeSinceLastChatPoints < cooldownDuration) {
        tg.showAlert(`Please wait ${Math.ceil(cooldownDuration - timeSinceLastChatPoints)} seconds.`);
        return;
    }

    tg.MainButton.setText("LOADING ADS...").show();
    
    // Show 3 rewarded interstitial ads combined
    show_10276123('pop').then(() => { 
        show_10276123('pop').then(() => { 
            show_10276123('pop').then(() => {
                update(userRef, {
                    chatPoints: increment(1),
                    lastChatPointsTimestamp: Date.now()
                });
                tg.showAlert("Earned 1 Chat Point! Use it to send messages.");
                tg.MainButton.hide();
                startChatPointsCooldown(cooldownDuration);
            }).catch(e => { tg.showAlert("Third ad failed. Please try again."); tg.MainButton.hide(); });
        }).catch(e => { tg.showAlert("Second ad failed. Please try again."); tg.MainButton.hide(); });
    }).catch(e => { tg.showAlert("First ad failed. Please try again."); tg.MainButton.hide(); });
};

// CHAT LOGIC
window.sendMessage = async () => {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-message-btn');
    const messageText = input.value.trim();
    
    if (messageText === "") return;
    if (currentChatPoints < 1) {
        tg.showAlert("You need at least 1 Chat Point to send a message.");
        return;
    }

    sendBtn.disabled = true; // Disable button while processing
    tg.MainButton.setText("Sending...").show();

    try {
        // Deduct 1 chat point
        await update(userRef, { chatPoints: increment(-1) });
        currentChatPoints--; // Update local state
        document.getElementById('user-chat-points').innerText = currentChatPoints;

        // Push message to Firebase
        await push(chatRef, {
            userId: userId,
            name: userName,
            message: messageText,
            timestamp: Date.now()
        });

        // Reward user 0.02 Peso after successful message
        const rewardAmount = 0.02;
        await update(userRef, { balance: increment(rewardAmount) });
        currentBalance += rewardAmount; // Update local state
        document.getElementById('user-balance').innerText = currentBalance.toFixed(2);
        tg.showAlert(`Message sent! ₱${rewardAmount.toFixed(2)} added to your balance.`);

        input.value = ""; // Clear input
        sendBtn.disabled = false;
        tg.MainButton.hide();

    } catch (error) {
        tg.showAlert("Failed to send message. Please try again.");
        console.error("Error sending message:", error);
        // Refund chat point if sending failed
        await update(userRef, { chatPoints: increment(1) });
        currentChatPoints++;
        document.getElementById('user-chat-points').innerText = currentChatPoints;
        sendBtn.disabled = false;
        tg.MainButton.hide();
    }
};

function loadChat() {
    const chatBox = document.getElementById('chat-messages');
    const chatQuery = query(ref(db, 'chat'), orderByChild('timestamp'), limitToLast(30)); // Fetch last 30 messages
    onValue(chatQuery, (snapshot) => {
        chatBox.innerHTML = "";
        snapshot.forEach(child => {
            const msg = child.val();
            const div = document.createElement('div');
            const isMyMessage = msg.userId === userId;
            div.className = `p-2 rounded-lg mb-2 ${isMyMessage ? 'ml-auto bg-green-600 w-3/4' : 'mr-auto bg-slate-800 w-3/4 sm:w-1/2'}`;
            div.innerHTML = `
                <div class="text-xs ${isMyMessage ? 'text-black' : 'text-blue-400 font-bold'}">${isMyMessage ? 'You' : msg.name}</div>
                <p class="text-sm ${isMyMessage ? 'text-white' : 'text-white'}">${msg.message}</p>
                <div class="text-right text-xs opacity-70">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            `;
            chatBox.appendChild(div);
        });
        chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to bottom
    });
}

// LEADERBOARD
function loadLeaderboard() {
    const lbRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
    onValue(lbRef, (snapshot) => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        let users = [];
        snapshot.forEach(child => { users.push(child.val()); });
        users.reverse().forEach((u, i) => {
            list.innerHTML += `
                <div class="glass p-3 rounded-lg flex justify-between items-center">
                    <span class="font-bold ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-orange-500' : ''}">${i+1}. ${u.username}</span>
                    <span class="text-green-400 font-bold">₱${u.balance.toFixed(2)}</span>
                </div>
            `;
        });
    });
}

// WITHDRAWAL
window.requestWithdrawal = async () => {
    constgcashNumInput = document.getElementById('gcash-number');
    constgcashNumber =gcashNumInput.value.trim();
    const withdrawBtn = document.getElementById('withdraw-button');

    if (gcashNumber.length < 10 || !/^\d+$/.test(gcashNumber)) { 
        return tg.showAlert("Enter a valid GCash number (11 digits starting with 09).");
    }
    if (currentBalance < 0.02) {
        return tg.showAlert("Minimum withdrawal is ₱0.02");
    }

    withdrawBtn.disabled = true;
    tg.MainButton.setText("Processing...").show();

    try {
        const withdrawalKey = await push(withdrawalsRef, {
            userId, 
            userName, 
            gcash:gcashNumber, 
            amount: currentBalance, 
            status: 'pending',
            timestamp: Date.now()
        });
        
        // Move to history immediately with 'pending' status
        await push(withdrawalHistoryRef, {
            userId, 
            gcash:gcashNumber, 
            amount: currentBalance, 
            status: 'pending',
            timestamp: Date.now()
        });

        await update(userRef, { balance: 0 }); // Reset balance
        
        tg.showAlert("Withdrawal Request Sent! It will be processed within 24 hours.");
        
        gcashNumInput.value = ""; // Clear input
        currentBalance = 0; // Update local state
        document.getElementById('user-balance').innerText = '0.00';
        withdrawBtn.disabled = false;
        tg.MainButton.hide();

    } catch (error) {
        console.error("Withdrawal error:", error);
        tg.showAlert("Failed to submit withdrawal. Please try again later.");
        withdrawBtn.disabled = false;
        tg.MainButton.hide();
    }
};

// Wallet History (already handled by onValue listener on withdrawalHistoryRef)
function loadWithdrawalHistory() {
     // The listener on withdrawalHistoryRef already updates this section in real-time
     // You might want to add a manual refresh button if needed, but real-time is better.
}

// ADMIN LOGIC
window.checkAdmin = () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdminPanel();
    } else {
        tg.showAlert("Incorrect Password!");
    }
};

function loadAdminPanel() {
    // Load pending withdrawals
    onValue(query(withdrawalsRef, orderByChild('status'), equalTo('pending')), (snapshot) => {
        const container = document.getElementById('withdrawal-requests');
        container.innerHTML = "";
        snapshot.forEach(child => {
            const req = child.val();
            container.innerHTML += `
                <div class="glass p-3 text-xs flex justify-between items-center rounded-lg">
                    <div>
                        <p>User: ${req.userName} (ID: ${req.userId})</p>
                        <p>GCash: ${req.gcash}</p>
                        <p class="text-green-400 font-bold">₱${req.amount.toFixed(2)}</p>
                        <p class="opacity-70">${new Date(req.timestamp).toLocaleString()}</p>
                    </div>
                    <button onclick="approveWithdrawal('${child.key}', '${req.userId}', ${req.amount})" class="bg-green-600 px-3 py-1 rounded font-bold">Approve</button>
                </div>
            `;
        });
    });

    // Load approved withdrawals and total
    onValue(query(withdrawalHistoryRef, orderByChild('status'), equalTo('completed')), (snapshot) => {
        const list = document.getElementById('approved-withdrawals-list');
        list.innerHTML = "";
        let totalApproved = 0;
        snapshot.forEach(child => {
            const hist = child.val();
            totalApproved += hist.amount;
            list.innerHTML += `
                <div class="glass p-3 text-xs flex justify-between items-center rounded-lg">
                    <div>
                        <p>User: ${hist.userName || 'N/A'} (ID: ${hist.userId || 'N/A'})</p>
                        <p>GCash: ${hist.gcash || 'N/A'}</p>
                        <p class="text-green-400 font-bold">₱${hist.amount.toFixed(2)}</p>
                        <p class="opacity-70">${new Date(hist.timestamp).toLocaleString()}</p>
                    </div>
                    <span class="bg-blue-600 px-2 py-1 rounded font-bold">APPROVED</span>
                </div>
            `;
        });
        document.getElementById('total-approved-amount').innerText = totalApproved.toFixed(2);
    });
}

window.approveWithdrawal = async (withdrawalKey, userId, amount) => {
    try {
        // Update status in pending withdrawals
        await update(ref(db, `withdrawals/${withdrawalKey}`), { status: 'completed', adminActionTimestamp: Date.now() });
        
        // Find the corresponding entry in withdrawal_history and update it
        const historySnapshot = await get(query(withdrawalHistoryRef, orderByChild('userId'), equalTo(userId)));
        let historyKeyToUpdate = null;
        historySnapshot.forEach(snap => {
            const hist = snap.val();
            if (hist.amount === amount && hist.status === 'pending' && new Date(hist.timestamp).getTime() === new Date(snap.val().timestamp).getTime()) { // Match more details
                historyKeyToUpdate = snap.key;
            }
        });

        if (historyKeyToUpdate) {
            await update(ref(db, `withdrawal_history/${historyKeyToUpdate}`), { status: 'completed', adminActionTimestamp: Date.now() });
        } else {
            // If not found, create a new completed entry (fallback)
             await push(withdrawalHistoryRef, {
                userId, 
                amount: amount, 
                status: 'completed',
                timestamp: Date.now(), // Timestamp when approved
                adminActionTimestamp: Date.now()
            });
        }

        // Update total approved amount
        await update(totalApprovedRef, increment(amount));

        tg.showAlert("Withdrawal Approved!");
    } catch (error) {
        console.error("Approval error:", error);
        tg.showAlert("Failed to approve withdrawal.");
    }
};

// Background Diamond Animation
function createDiamonds() {
    const container = document.getElementById('diamond-container');
    const numDiamonds = 12;
    for (let i = 0; i < numDiamonds; i++) {
        const diamond = document.createElement('div');
        diamond.className = 'diamond';
        
        const size = Math.random() * 30 + 15; // Diamonds between 15px and 45px
        diamond.style.width = diamond.style.height = size + 'px';
        
        const duration = Math.random() * 10 + 5; // Animation duration between 5s and 15s
        diamond.style.animationDuration = duration + 's';
        
        const delay = Math.random() * 10; // Start delay
        diamond.style.animationDelay = '-' + delay + 's';

        const posX = Math.random() * 100;
        const posY = Math.random() * 100; // Start from top
        diamond.style.left = posX + '%';
        diamond.style.top = '-' + (Math.random() * 100) + '%'; // Start off-screen top
        
        // Slightly vary opacity and color
        const opacity = Math.random() * 0.3 + 0.4; // Between 0.4 and 0.7
        diamond.style.backgroundColor = `rgba(255, 215, 0, ${opacity})`;
        diamond.style.filter = `drop-shadow(0 0 10px rgba(255, 215, 0, ${opacity - 0.2}))`;

        container.appendChild(diamond);
    }
}

// Initialize animations and data load on startup
document.addEventListener('DOMContentLoaded', () => {
    tg.ready(); // Signal to Telegram that the app is ready
    createDiamonds();
    loadChat(); // Load initial chat messages
    loadLeaderboard(); // Load initial leaderboard
    // Other initializations like checking cooldowns happen in the user data listener
});
