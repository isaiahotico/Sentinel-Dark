
// --- DATABASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "facebook-follow-to-follow.firebaseapp.com",
    databaseURL: "https://facebook-follow-to-follow-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facebook-follow-to-follow",
    storageBucket: "facebook-follow-to-follow.firestorage.app",
    messagingSenderId: "589427984313",
    appId: "1:589427984313:web:a17b8cc851efde6dd79868"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
} catch (error) {
    console.error("Firebase initialization error:", error);
    // Handle error appropriately, maybe show a message to the user
}
const db = firebase.database();

// Telegram Setup
const tg = window.Telegram.WebApp;
tg.expand();
// Use a fallback for username if not available (e.g., not opened in Telegram)
const username = tg.initDataUnsafe?.user?.username || `Guest_${Math.floor(Math.random() * 1000)}`;
document.getElementById('user-display').innerText = `@${username}`;

// Global Variables & Constants
let adsWatched = 0;
let lastPostTime = 0;
const REQUIRED_ADS = 27;
const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

// Firebase References
const userRef = db.ref(`users/${username}`);
const tasksRef = db.ref('tasks');
const chatRef = db.ref('chat');
const presenceRef = db.ref(`presence/${username}`);

// --- User Presence and Session Management ---
presenceRef.set({ status: 'online', lastSeen: Date.now() });
presenceRef.onDisconnect().remove(); // Remove user from presence when they disconnect

// Fetch user data on load
userRef.on('value', (snapshot) => {
    const data = snapshot.val() || {};
    adsWatched = data.adsWatched || 0;
    lastPostTime = data.lastPostTime || 0;

    updateAdCounterDisplay();
    updateSubmitButton();
});

// --- Ad Watching Functionality ---
function watchAd() {
    const adStatusElement = document.getElementById('ad-status');
    adStatusElement.innerText = "Loading ad...";
    document.getElementById('watch-ad-btn').disabled = true; // Prevent multiple clicks

    // 1. Open the primary ad link in a new tab
    // Ensure this is a valid ad link that should be shown once per ad watch action
    window.open('https://www.profitablecpmratenetwork.com/i2rx8svvds?key=ec449a85ea63cb0b7adf4cd90009cbca', '_blank');

    // 2. Trigger the interstitial ads using the provided libtl.com scripts
    const interstitialAdZones = [
        { func: show_10555663, id: '10555663' },
        { func: show_10830602, id: '10830602' },
        { func: show_10555746, id: '10555746' }
    ];
    
    // Pick one random interstitial to show
    const randomAd = interstitialAdZones[Math.floor(Math.random() * interstitialAdZones.length)];

    randomAd.func().then(() => {
        // Ad shown and completed successfully
        adStatusElement.innerText = "Ad watched!";
        incrementAdCountAndSave();
    }).catch(error => {
        console.error(`Ad failed to load or display (Zone ${randomAd.id}):`, error);
        adStatusElement.innerText = "Ad failed to load. Trying to count anyway...";
        // IMPORTANT: Even if the ad fails, we still increment the count to prevent users from getting stuck.
        // This assumes the ad network or your logic will handle ad frequency/quality.
        incrementAdCountAndSave();
    });
    
    // Optional: Set a timeout in case the ad promise never resolves
    setTimeout(() => {
        if(document.getElementById('watch-ad-btn').disabled) { // Check if still disabled
            adStatusElement.innerText = "Ad loading timed out. Counting anyway.";
            incrementAdCountAndSave();
        }
    }, 15000); // 15 seconds timeout
}

function incrementAdCountAndSave() {
    adsWatched++;
    userRef.update({ adsWatched: adsWatched })
        .then(() => {
            updateAdCounterDisplay();
            updateSubmitButton();
            document.getElementById('watch-ad-btn').disabled = false; // Re-enable button
            console.log("Ad count updated in Firebase.");
        })
        .catch(error => {
            console.error("Failed to update ad count in Firebase:", error);
            alert("Error saving ad count. Please try again.");
            document.getElementById('watch-ad-btn').disabled = false; // Re-enable button on error
        });
}

function updateAdCounterDisplay() {
    const counterElement = document.getElementById('ad-count');
    counterElement.innerText = `${adsWatched} / ${REQUIRED_ADS}`;
    if (adsWatched >= REQUIRED_ADS) {
        counterElement.classList.add('text-green-400'); // Highlight when requirement is met
    } else {
        counterElement.classList.remove('text-green-400');
    }
}


// --- Task Submission and Cooldown Logic ---
function updateSubmitButton() {
    const btn = document.getElementById('btn-submit');
    const now = Date.now();
    const isCooldownActive = (now - lastPostTime) < COOLDOWN_MS;
    const cooldownTimerElement = document.getElementById('cooldown-timer');

    if (adsWatched >= REQUIRED_ADS && !isCooldownActive) {
        btn.disabled = false;
        btn.style.opacity = "1";
        btn.classList.remove('cursor-not-allowed', 'bg-gray-500');
        btn.classList.add('bg-blue-600', 'hover:bg-blue-500');
        cooldownTimerElement.innerText = "";
    } else {
        btn.disabled = true;
        btn.style.opacity = "0.5";
        btn.classList.add('cursor-not-allowed');
        btn.classList.remove('bg-blue-600', 'hover:bg-blue-500');
        btn.classList.add('bg-gray-500'); // Indicate disabled state visually

        if (isCooldownActive) {
            const remainingTime = COOLDOWN_MS - (now - lastPostTime);
            const hours = Math.floor(remainingTime / (1000 * 60 * 60));
            const minutes = Math.floor((remainingTime % (1000 * 60 * 60)) / (1000 * 60));
            cooldownTimerElement.innerText = `Cooldown active: ${hours}h ${minutes}m left`;
        } else if (adsWatched < REQUIRED_ADS) {
             cooldownTimerElement.innerText = `${REQUIRED_ADS - adsWatched} more ads needed`;
        }
    }
}

function submitTask() {
    const linkInput = document.getElementById('task-link');
    const link = linkInput.value.trim();

    if (!link || !link.includes('t.me')) {
        alert("Please enter a valid Telegram link (e.g., https://t.me/your_channel).");
        return;
    }

    // Disable button immediately after click
    document.getElementById('btn-submit').disabled = true;

    const newTaskRef = tasksRef.push(); // Generates a unique ID
    newTaskRef.set({
        sender: username,
        link: link,
        timestamp: Date.now(),
        taskId: newTaskRef.key // Store the generated ID with the task
    }).then(() => {
        userRef.update({ lastPostTime: Date.now() });
        linkInput.value = ""; // Clear input
        alert("Task posted successfully!");
        updateSubmitButton(); // Update button state after successful post
    }).catch(error => {
        console.error("Failed to post task:", error);
        alert("Failed to post task. Please try again.");
        updateSubmitButton(); // Re-enable button on error
    });
}

// --- Task Rendering and Hiding ---
tasksRef.on('value', (snapshot) => {
    const tasks = snapshot.val();
    const container = document.getElementById('tasks-container');
    container.innerHTML = ""; // Clear existing tasks

    // Get tasks that this user has hidden
    const hiddenTasks = JSON.parse(localStorage.getItem(`hidden_tasks_${username}`) || "[]");

    if (!tasks) {
        container.innerHTML = '<p class="text-sm opacity-70">No tasks available right now.</p>';
        return;
    }

    for (const taskId in tasks) {
        // Skip if this user has hidden this task
        if (hiddenTasks.includes(taskId)) {
            continue;
        }

        const taskData = tasks[taskId];
        const div = document.createElement('div');
        div.className = "glass p-3 rounded-lg flex justify-between items-center animate-fade-in";
        div.innerHTML = `
            <span class="text-sm truncate max-w-[70%]">Posted by @${taskData.sender}</span>
            <button onclick="handleTaskClick('${taskId}', '${taskData.link}')" class="bg-white/20 hover:bg-white/30 px-4 py-1 rounded font-semibold transition duration-300 ease-in-out text-sm">Open Link</button>
        `;
        container.appendChild(div);
    }
    
    // Add animation delay for newly added tasks
    container.querySelectorAll('.animate-fade-in').forEach((el, index) => {
        el.style.animationDelay = `${index * 0.1}s`;
    });
});

function handleTaskClick(taskId, link) {
    let hiddenTasks = JSON.parse(localStorage.getItem(`hidden_tasks_${username}`) || "[]");
    
    // Add task ID to hidden list if it's not already there
    if (!hiddenTasks.includes(taskId)) {
        hiddenTasks.push(taskId);
        localStorage.setItem(`hidden_tasks_${username}`, JSON.stringify(hiddenTasks));
    }

    // Open the link in a new tab
    window.open(link, '_blank');

    // Optionally, you could re-render the task list immediately or just let the Firebase listener handle it
    // For immediate visual feedback, you might want to hide the element directly.
    // However, relying on the Firebase listener is cleaner for data consistency.
    // location.reload(); // Less ideal, but ensures UI update
}

// --- Chat Functionality ---
function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;

    const senderUsername = username; // Use the dynamically fetched username

    chatRef.push({
        user: senderUsername,
        msg: message,
        time: Date.now()
    }).then(() => {
        input.value = ""; // Clear input after sending
    }).catch(error => {
        console.error("Failed to send message:", error);
        alert("Failed to send message. Please check your connection.");
    });
}

// Listen for new chat messages
chatRef.orderByChild('time').limitToLast(30).on('value', (snapshot) => {
    const box = document.getElementById('chat-box');
    const wasScrolledToBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 50; // Check if user is near bottom
    
    box.innerHTML = ""; // Clear previous messages
    snapshot.forEach(child => {
        const data = child.val();
        const messageElement = document.createElement('div');
        messageElement.className = "text-sm";
        // Highlight current user's messages
        const isCurrentUser = data.user === username;
        messageElement.innerHTML = `
            <b class="${isCurrentUser ? 'text-blue-300' : 'text-gray-300'}">@${data.user}:</b> 
            <span class="${isCurrentUser ? 'text-blue-100' : ''}">${data.msg}</span>
        `;
        box.appendChild(messageElement);
    });

    // Auto-scroll to bottom if user was already near the bottom
    if (wasScrolledToBottom) {
        box.scrollTop = box.scrollHeight;
    }
});

// --- Online Users List ---
db.ref('presence').on('value', (snapshot) => {
    const listElement = document.getElementById('online-users');
    listElement.innerHTML = ""; // Clear previous list
    snapshot.forEach(child => {
        const onlineUser = child.key;
        const status = child.val().status; // e.g., 'online'
        const userElement = document.createElement('span');
        userElement.className = `px-2 py-1 rounded text-xs ${status === 'online' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'}`;
        userElement.textContent = `● ${onlineUser}`;
        listElement.appendChild(userElement);
    });
});

// --- Footer Date and Time ---
function updateFooterTime() {
    const now = new Date();
    document.getElementById('footer-date').innerText = now.toLocaleString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}
setInterval(updateFooterTime, 1000); // Update every second

// --- Load User Preferences on Initial Load ---
window.addEventListener('load', () => {
    const savedBg = localStorage.getItem(`pref-bg_${username}`);
    const savedText = localStorage.getItem(`pref-text_${username}`);

    if (savedBg) {
        document.documentElement.style.setProperty('--main-bg', savedBg);
        document.getElementById('bgColor').value = savedBg;
    }
    if (savedText) {
        document.documentElement.style.setProperty('--main-color', savedText);
        document.getElementById('textColor').value = savedText;
    }
    
    // Attach event listeners for color pickers
    document.getElementById('bgColor').addEventListener('input', (e) => {
        const color = e.target.value;
        document.documentElement.style.setProperty('--main-bg', color);
        localStorage.setItem(`pref-bg_${username}`, color);
    });

    document.getElementById('textColor').addEventListener('input', (e) => {
        const color = e.target.value;
        document.documentElement.style.setProperty('--main-color', color);
        localStorage.setItem(`pref-text_${username}`, color);
    });

    // Initial update of footer time
    updateFooterTime();
});
