
// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "facebook-follow-to-follow.firebaseapp.com",
    databaseURL: "https://facebook-follow-to-follow-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "facebook-follow-to-follow",
    storageBucket: "facebook-follow-to-follow.firebasestorage.app",
    messagingSenderId: "589427984313",
    appId: "1:589427984313:web:a17b8cc851efde6dd79868"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();

// --- Telegram Web App Integration ---
const tg = window.Telegram?.WebApp;
tg?.ready();

let username = "Guest";
let userId = null; // To track user for content ownership and replies

if (tg) {
    const tgUser = tg.initDataUnsafe?.user;
    if (tgUser) {
        userId = tgUser.id;
        username = tgUser.username || tgUser.first_name;
        if (username.startsWith('@')) username = username.substring(1); // Remove leading @
        username = "@" + username; // Re-add @ for display consistency
        localStorage.setItem('tg_username', username); // Save for fallback if TWA closes
        tg.expand(); // Expand the TWA interface
    }
} else {
    // Fallback for non-TWA environments
    const storedUsername = localStorage.getItem('tg_username');
    if (storedUsername) {
        username = storedUsername;
    } else {
        const randomSuffix = Math.floor(Math.random() * 10000);
        username = prompt(`Enter your Telegram Username (e.g., @king_dev):`);
        if (!username || !username.startsWith('@')) {
            username = `@user${randomSuffix}`;
            alert(`Invalid input. Using a random username: ${username}`);
        }
        localStorage.setItem('tg_username', username);
    }
}
document.getElementById('user-display').innerText = username;

// --- State Management ---
let adsWatched = parseInt(localStorage.getItem('ads_count') || '0');
let lastPostTime = parseInt(localStorage.getItem('last_post_time') || '0');
const REQUIRED_ADS = 27;
const POST_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

// --- UI Update Functions ---
function updateUI() {
    const adCountElement = document.getElementById('ad-count');
    adCountElement.innerText = `${adsWatched}/${REQUIRED_ADS}`;
    
    const statusElement = document.getElementById('qualify-status');
    const postBtn = document.getElementById('post-btn');
    const adTriggerBtn = document.getElementById('ad-trigger-btn');

    if (adsWatched >= REQUIRED_ADS) {
        statusElement.innerText = "Qualified";
        statusElement.className = "text-xs text-green-500 font-bold uppercase";
        postBtn.disabled = false;
        adTriggerBtn.classList.remove('animate-bounce', 'border-white');
        adTriggerBtn.classList.add('border-green-500');
    } else {
        statusElement.innerText = "Not Qualified";
        statusElement.className = "text-xs text-red-500 font-bold uppercase";
        postBtn.disabled = true;
        adTriggerBtn.classList.add('animate-bounce', 'border-white');
        adTriggerBtn.classList.remove('border-green-500');
    }
    updateCooldownTimer();
}

// --- Ad Logic ---
function watchAdsTogether() {
    // 1. Open Direct Link
    window.open("https://www.profitablecpmratenetwork.com/i2rx8svvds?key=ec449a85ea63cb0b7adf4cd90009cbca", "_blank");

    // 2. Random Interstitial Ads
    const monetagScripts = [
        { func: show_10555663, zone: '10555663' },
        { func: show_10830602, zone: '10830602' },
        { func: show_10555746, zone: '10555746' }
    ];
    const randomScriptInfo = monetagScripts[Math.floor(Math.random() * monetagScripts.length)];
    const adFunction = window[randomScriptInfo.func.name]; // Get function by name

    if (typeof adFunction === 'function') {
        adFunction().then(() => {
            adsWatched++;
            localStorage.setItem('ads_count', adsWatched);
            updateUI();
            console.log(`Ad watched via ${randomScriptInfo.zone}. Total watched: ${adsWatched}`);
            alert('Ad reward collected! Thanks for watching.');
        }).catch(error => {
            console.error(`Error showing ad from zone ${randomScriptInfo.zone}:`, error);
            // Optional: Fallback reward if ad fails but the call was made
            adsWatched++;
            localStorage.setItem('ads_count', adsWatched);
            updateUI();
            alert('Ad failed to load, but we\'ve credited you for trying!');
        });
    } else {
        console.warn(`Monetag function ${randomScriptInfo.func.name} not found. Ensure SDKs are loaded.`);
        // If the function doesn't exist, still increment as a fallback
        adsWatched++;
        localStorage.setItem('ads_count', adsWatched);
        updateUI();
    }
}

// --- Navigation & UI Switching ---
let isMenuOpen = false;
const sidebar = document.getElementById('sidebar');
const sections = document.querySelectorAll('.content-section');

function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    sidebar.classList.toggle('-translate-x-full');
    // For wider screens, it's always visible, so toggle translateX to align correctly
    if (window.innerWidth >= 768) {
        sidebar.classList.toggle('translate-x-0');
    }
}

function showSection(sectionId) {
    sections.forEach(s => s.classList.add('hidden'));
    document.getElementById(sectionId + '-section').classList.remove('hidden');
    if (window.innerWidth < 768) { // Only close menu on mobile
        toggleMenu();
    }
}

// --- Task Section Logic ---
let taskPostTimeout = null; // To handle the auto-hide timeout
let cooldownInterval = null; // To update the cooldown timer

function updateCooldownTimer() {
    const cooldownTimerElement = document.getElementById('cooldown-timer');
    const now = Date.now();
    const timeSinceLastPost = now - lastPostTime;
    const timeLeft = POST_COOLDOWN_MS - timeSinceLastPost;

    if (timeLeft > 0) {
        const hours = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        cooldownTimerElement.innerText = `Next post available in: ${hours}h ${minutes}m ${seconds}s`;
        cooldownTimerElement.style.color = 'yellow';
        document.getElementById('post-btn').disabled = true;
    } else {
        cooldownTimerElement.innerText = "Ready to post! Watch ads to qualify.";
        cooldownTimerElement.style.color = 'lightgreen';
        if (adsWatched >= REQUIRED_ADS) {
             document.getElementById('post-btn').disabled = false;
        }
        if (cooldownInterval) clearInterval(cooldownInterval); // Stop interval if cooldown is over
    }
}

function postLink() {
    const linkInput = document.getElementById('tg-link');
    const link = linkInput.value.trim();
    const now = Date.now();

    if (adsWatched < REQUIRED_ADS) {
        alert("You need to watch 27 ads to qualify for posting!");
        return;
    }
    if (!link || !link.includes("t.me/")) {
        alert("Please enter a valid Telegram link (starting with https://t.me/).");
        return;
    }
    if (now - lastPostTime < POST_COOLDOWN_MS) {
        alert("You are still on cooldown. Please wait a while before posting again.");
        updateCooldownTimer(); // Ensure timer is displayed
        return;
    }

    const newPost = {
        username: username, // Use the determined username (TWA or fallback)
        link: link,
        timestamp: now,
        id: Math.random().toString(36).substr(2, 9) + Date.now() // More unique ID
    };

    db.ref('tasks').push(newPost)
        .then(() => {
            lastPostTime = now;
            localStorage.setItem('last_post_time', now);
            localStorage.setItem('ads_count', adsWatched); // Ensure ads count is saved
            linkInput.value = ""; // Clear input
            alert("Link posted successfully!");
            updateCooldownTimer(); // Update timer immediately
            
            // Auto-hide post area for a short duration
            const postArea = document.getElementById('post-area');
            postArea.style.opacity = '0';
            postArea.style.height = '0';
            postArea.style.overflow = 'hidden';
            postArea.style.padding = '0';

            if (taskPostTimeout) clearTimeout(taskPostTimeout);
            taskPostTimeout = setTimeout(() => {
                postArea.style.opacity = '1';
                postArea.style.height = 'auto';
                postArea.style.overflow = 'visible';
                postArea.style.padding = '1rem'; // Restore padding
                // Optionally clear the link input after hiding/showing
                 linkInput.value = "";
            }, 5000); // Hide for 5 seconds

            // Start the cooldown interval if not already running
            if (!cooldownInterval) {
                cooldownInterval = setInterval(updateCooldownTimer, 1000);
            }
        })
        .catch(error => {
            console.error("Error posting link:", error);
            alert("Failed to post link. Please try again.");
        });
}

// Function to handle link clicks and hide them
function handleLinkClick(id, url) {
    const hiddenLinks = JSON.parse(localStorage.getItem('hidden_links') || "[]");
    if (!hiddenLinks.includes(id)) {
        hiddenLinks.push(id);
        localStorage.setItem('hidden_links', JSON.stringify(hiddenLinks));
    }
    window.open(url, "_blank");
    // No immediate reload needed, the listener will update the UI if item is truly hidden
    alert("Link opened! It will be hidden for you now.");
    // Trigger UI update to remove the link from the current view
    renderTasks();
}

// Render tasks section
function renderTasks() {
    const container = document.getElementById('links-container');
    container.innerHTML = ""; // Clear existing
    const hiddenLinks = JSON.parse(localStorage.getItem('hidden_links') || "[]");

    db.ref('tasks').orderByChild('timestamp').once('value', snapshot => {
        const tasks = [];
        snapshot.forEach(child => {
            const data = child.val();
            if (!hiddenLinks.includes(data.id)) {
                tasks.push({ ...data, key: child.key });
            }
        });

        // Display newest tasks first
        tasks.reverse().forEach(task => {
            const div = document.createElement('div');
            div.className = "bg-gray-800 p-4 rounded border-l-4 border-blue-500 flex justify-between items-center";
            div.innerHTML = `
                <div>
                    <p class="text-sm font-bold">${task.username}</p>
                    <p class="text-xs text-gray-400">Posted ${new Date(task.timestamp).toLocaleString()}</p>
                </div>
                <button onclick="handleLinkClick('${task.id}', '${task.link}')" class="bg-blue-600 px-4 py-1 rounded text-sm hover:bg-blue-700">Join</button>
            `;
            container.prepend(div);
        });
    });
}

// --- Topics Section Logic ---
const topicsListElement = document.getElementById('topics-list');
const createTopicFormElement = document.getElementById('create-topic-form');
const topicTitleInput = document.getElementById('topic-title');
const topicDescriptionInput = document.getElementById('topic-description');
const topicImageInput = document.getElementById('topic-image');

function showCreateTopicForm() {
    createTopicFormElement.classList.remove('hidden');
}

function hideCreateTopicForm() {
    createTopicFormElement.classList.add('hidden');
    // Clear form fields
    topicTitleInput.value = '';
    topicDescriptionInput.value = '';
    topicImageInput.value = '';
}

function createTopic() {
    const title = topicTitleInput.value.trim();
    const description = topicDescriptionInput.value.trim();
    const imageFile = topicImageInput.files[0];

    if (!title || !description) {
        alert("Please enter a title and description for the topic.");
        return;
    }

    const newTopicRef = db.ref('topics').push();
    const topicData = {
        title: title,
        description: description,
        createdBy: username,
        userId: userId,
        createdAt: Date.now(),
        replies: {} // Initialize replies object
    };

    if (imageFile) {
        const storageRef = storage.ref(`topic_images/${newTopicRef.key}/${imageFile.name}`);
        const uploadTask = storageRef.put(imageFile);

        uploadTask.on('state_changed',
            (snapshot) => { /* Progress */ },
            (error) => {
                console.error("Image upload failed:", error);
                alert("Failed to upload image. Topic created without image.");
                newTopicRef.set(topicData).catch(e => console.error("Error saving topic:", e));
            },
            () => {
                storageRef.getDownloadURL().then((downloadURL) => {
                    topicData.imageUrl = downloadURL;
                    newTopicRef.set(topicData).then(() => {
                        alert("Topic created successfully!");
                        hideCreateTopicForm();
                    }).catch(e => console.error("Error saving topic with image URL:", e));
                });
            }
        );
    } else {
        newTopicRef.set(topicData).then(() => {
            alert("Topic created successfully!");
            hideCreateTopicForm();
        }).catch(e => console.error("Error saving topic:", e));
    }
}

function renderTopics() {
    topicsListElement.innerHTML = ""; // Clear existing
    db.ref('topics').orderByChild('createdAt').once('value', snapshot => {
        const topics = [];
        snapshot.forEach(child => {
            topics.push({ id: child.key, ...child.val() });
        });
        
        topics.reverse().forEach(topic => {
            const topicDiv = document.createElement('div');
            topicDiv.className = "bg-gray-800 p-4 rounded-lg border border-gray-700";
            topicDiv.innerHTML = `
                <h4 class="text-lg font-bold text-blue-400 cursor-pointer" onclick="showTopicDetail('${topic.id}')">${topic.title}</h4>
                <p class="text-sm text-gray-400 mb-2">Created by ${topic.createdBy} on ${new Date(topic.createdAt).toLocaleString()}</p>
                <p>${topic.description}</p>
                ${topic.imageUrl ? `<img src="${topic.imageUrl}" alt="Topic Image" class="topic-image mt-2">` : ''}
                <div class="mt-3 text-sm text-gray-400 cursor-pointer" onclick="showTopicDetail('${topic.id}')">
                    <span class="reply-count" id="reply-count-${topic.id}">0</span> Replies | View Discussion
                </div>
            `;
            topicsListElement.appendChild(topicDiv);

            // Update reply count
            const replies = topic.replies || {};
            const replyCount = Object.keys(replies).length;
            const replyCountElement = topicDiv.querySelector(`#reply-count-${topic.id}`);
            if(replyCountElement) replyCountElement.textContent = replyCount;
        });
    });
}

function showTopicDetail(topicId) {
    // Hide other sections and show a dedicated topic detail view (or modal)
    showSection('topics'); // Go back to topics list first
    // For simplicity, we'll just scroll to the topic or implement a modal later
    const topicElement = topicsListElement.querySelector(`[onclick="showTopicDetail('${topicId}')"]`)?.closest('.bg-gray-800');
    if (topicElement) {
        // Basic implementation: Scroll to the element
        topicElement.scrollIntoView({ behavior: 'smooth' });
        // A modal would be better for a true detail view
        alert(`Topic ID: ${topicId} - Implement modal or dedicated view here`);
    }
    // In a real app, you'd navigate to a new screen or open a modal here
}

function addReplyToTopic(topicId) {
    // This function would be called from the topic detail view/modal
    const replyText = prompt("Enter your reply:");
    if (!replyText) return;

    const replyRef = db.ref(`topics/${topicId}/replies`).push();
    replyRef.set({
        text: replyText,
        user: username,
        userId: userId,
        timestamp: Date.now()
    }).then(() => {
        alert("Reply added!");
        renderTopics(); // Re-render to update counts
    }).catch(e => console.error("Error adding reply:", e));
}


// --- Chat Logic ---
const chatMessagesElement = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');

function sendMessage() {
    const messageText = chatInput.value.trim();
    if (!messageText) return;

    db.ref('chat').push({
        user: username,
        userId: userId, // Store userId for potential owner checks
        text: messageText,
        time: Date.now()
    })
    .catch(error => {
        console.error("Error sending message:", error);
        alert("Failed to send message. Please try again.");
    });
    chatInput.value = "";
}

// Real-time listener for chat messages
db.ref('chat').orderByChild('time').limitToLast(50).on('value', snapshot => {
    chatMessagesElement.innerHTML = ""; // Clear previous messages
    snapshot.forEach(child => {
        const msg = child.val();
        const messageDiv = document.createElement('div');
        const isOwnMessage = msg.userId === userId; // Check if it's the current user's message

        messageDiv.className = `p-2 rounded-lg max-w-[80%] break-words ${isOwnMessage ? "ml-auto bg-blue-900" : "mr-auto bg-gray-700"}`;
        messageDiv.innerHTML = `
            <p class="text-[10px] ${isOwnMessage ? "text-blue-300" : "text-green-300"} font-semibold">${msg.user}</p>
            <p class="text-sm">${msg.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
        `;
        chatMessagesElement.appendChild(messageDiv);
    });
    chatMessagesElement.scrollTop = chatMessagesElement.scrollHeight; // Auto-scroll to bottom
});

// --- Online Users Logic ---
const userStatusBaseRef = db.ref('status');
const userStatusRef = userStatusBaseRef.child(userId || username.replace('@', '')); // Use TWA ID if available, else username

// Set presence on connection
if (userId || username !== "Guest") {
    db.ref('.info/connected').on('value', (snap) => {
        if (snap.val() === true) {
            // Mark user as online
            userStatusRef.set({
                username: username,
                state: 'online',
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
            // Remove on disconnect
            userStatusRef.onDisconnect().update({
                state: 'offline',
                lastSeen: firebase.database.ServerValue.TIMESTAMP
            });
        } else {
            // If not connected, remove from presence list
             userStatusRef.set(null); // Or update state to offline if needed for historical reasons
        }
    });
}

// Listen for status changes
userStatusBaseRef.on('value', (snapshot) => {
    const userListElement = document.getElementById('user-list');
    userListElement.innerHTML = ""; // Clear list
    let onlineCount = 0;
    snapshot.forEach((child) => {
        const userData = child.val();
        if (userData && userData.state === 'online') {
            const li = document.createElement('li');
            li.className = "flex items-center gap-2 text-sm";
            li.innerHTML = `<span class="w-2 h-2 bg-green-500 rounded-full"></span> ${userData.username || child.key}`;
            userListElement.appendChild(li);
            onlineCount++;
        }
    });
     // Optional: Display online count somewhere
     console.log(`Online users: ${onlineCount}`);
});


// --- Settings & Colors ---
const body = document.body;
const bgPicker = document.getElementById('bg-picker');
const accentPicker = document.getElementById('accent-picker');

function updateColors() {
    const bg = bgPicker.value;
    const accent = accentPicker.value;
    
    body.style.setProperty('--main-bg', bg);
    body.style.backgroundColor = bg; // Ensure body background is set directly

    // Apply accent color to specific elements (adjust selectors as needed)
    const accentElements = document.querySelectorAll('.bg-blue-600, button:not([disabled]), .hover\\:bg-blue-700:hover');
    accentElements.forEach(el => {
        // Check if it's a button or link-like element to apply accent
        if (el.tagName === 'BUTTON' || el.classList.contains('bg-blue-600') || el.classList.contains('hover\\:bg-blue-700')) {
            el.style.backgroundColor = accent;
        }
         // Add other selectors if needed, e.g., for borders, text colors
    });
     // Update Tailwind's default blue to match accent more closely for buttons etc.
     const root = document.documentElement;
     root.style.setProperty('--tw-bg-opacity', '1');
     root.style.setProperty('--tw-bg-opacity-hover', '1');
     // Applying accent to specific Tailwind classes can be tricky.
     // Direct style manipulation is more reliable here.

    localStorage.setItem('pref_bg', bg);
    localStorage.setItem('pref_accent', accent);
}

// --- Footer Time ---
const footerTimeDateElement = document.getElementById('footer-time-date');
function updateFooterTime() {
    const now = new Date();
    footerTimeDateElement.innerText = now.toLocaleString();
}

// --- Initialization ---
function initializeApp() {
    updateUI();
    updateFooterTime();
    renderTasks(); // Load initial tasks
    renderTopics(); // Load initial topics

    // Set initial colors from localStorage
    const savedBg = localStorage.getItem('pref_bg');
    const savedAccent = localStorage.getItem('pref_accent');
    if (savedBg) {
        bgPicker.value = savedBg;
        body.style.setProperty('--main-bg', savedBg);
        body.style.backgroundColor = savedBg;
    }
    if (savedAccent) {
        accentPicker.value = savedAccent;
        // Apply initial accent color
        updateColors(); // Call this after setting picker values
    } else {
        // Set default accent color if none saved
         accentPicker.value = '#3b82f6'; // Default Tailwind blue
         updateColors();
    }

    // Start intervals
    setInterval(updateFooterTime, 1000);
    cooldownInterval = setInterval(updateCooldownTimer, 1000); // Start cooldown timer update
     // Show initial section (e.g., tasks)
     showSection('tasks');
     // Adjust sidebar visibility for larger screens
     if (window.innerWidth >= 768) {
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
     }
}

// --- Event Listeners ---
// Listen for window resize to adjust sidebar if needed
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        sidebar.classList.remove('-translate-x-full');
        sidebar.classList.add('translate-x-0');
    } else {
        // If menu was open and screen resizes smaller, ensure it's hidden by default
        if (!isMenuOpen) {
             sidebar.classList.add('-translate-x-full');
             sidebar.classList.remove('translate-x-0');
        }
    }
});

// Input listeners for chat and topics
chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Initial call to start the app
initializeApp();

