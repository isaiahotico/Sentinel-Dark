
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref, push, onValue, set, remove, child } from "firebase/database";

// Your web app's Firebase configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app); // Get database instance

// --- Constants ---
const FREE_VIDEO_WATCHES = 100;
const PAID_VIDEO_WATCHES = 120;
const FREE_SUBSCRIBE_CLICKS = 50;
const PAID_SUBSCRIBE_CLICKS = 65;
const FREE_VIDEO_REWARD = 0.01; // pesos
const PAID_VIDEO_REWARD = 1.00; // pesos
const SUBSCRIBE_REWARD = 0.03; // pesos
const REFERRAL_PERCENTAGE = 0.20; // 20%

const TELEGRAM_USERNAME_KEY = "telegramUsername";
const STORED_LINKS_REF = ref(database, "storedLinks");
const VIDEO_QUEUE_REF = ref(database, "videoQueue");
const SUBSCRIBE_QUEUE_REF = ref(database, "subscribeQueue");
const USER_DATA_REF = ref(database, "users"); // For storing user-specific data like watches

const telegramUsernameDisplay = document.getElementById("displayTelegramUsername");
const telegramUsernameInput = document.getElementById("telegramUsernameInput");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const linkToStoreInput = document.getElementById("linkToStoreInput");
const storeLinkBtn = document.getElementById("storeLinkBtn");
const storedLinksDisplay = document.getElementById("storedLinksDisplay");
const videoQueueDisplay = document.getElementById("videoQueue");
const subscribeQueueDisplay = document.getElementById("subscribeQueue");
const referralLinkInput = document.getElementById("referralLinkInput");
const copyReferralBtn = document.getElementById("copyReferralBtn");

// --- Helper Functions ---

// Generate a unique ID for each link entry (useful for deletion/updates)
function generateUniqueId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Function to format currency
function formatCurrency(amount) {
    return `₱${amount.toFixed(2)}`;
}

// Function to get current user's Telegram username (simulated)
// In a real app, this would come from your Telegram bot's session or a cookie.
function getCurrentTelegramUsername() {
    return localStorage.getItem(TELEGRAM_USERNAME_KEY) || "";
}

// Function to save current user's Telegram username
function saveTelegramUsername(username) {
    localStorage.setItem(TELEGRAM_USERNAME_KEY, username);
    displayCurrentTelegramUsername();
}

// Display the current Telegram username
function displayCurrentTelegramUsername() {
    const username = getCurrentTelegramUsername();
    if (username) {
        telegramUsernameDisplay.textContent = `Your Telegram Username: ${username}`;
        telegramUsernameDisplay.classList.add('text-highlight');
    } else {
        telegramUsernameDisplay.textContent = "Your Telegram Username: Not set";
        telegramUsernameDisplay.classList.remove('text-highlight');
    }
}

// Add a link to the stored links section
function addStoredLinkToDOM(link, linkId) {
    const linkElement = document.createElement("div");
    linkElement.classList.add("link-item");
    linkElement.innerHTML = `
        <span class="flex-grow mr-4 truncate">${link}</span>
        <button class="btn btn-sm bg-red-500 hover:bg-red-700" data-link-id="${linkId}">Remove</button>
    `;
    storedLinksDisplay.appendChild(linkElement);

    // Add event listener for removal
    linkElement.querySelector('button').addEventListener('click', () => {
        removeStoredLink(linkId);
        linkElement.remove();
    });
}

// Add a video to the video queue
function addVideoToQueue(videoUrl, videoId, watchesCount, isFree) {
    const videoElement = document.createElement("div");
    videoElement.classList.add("link-item");
    videoElement.innerHTML = `
        <div class="flex flex-col">
            <a href="${videoUrl}" target="_blank" class="text-blue-600 hover:underline font-medium">${videoUrl}</a>
            <span class="queue-info">${isFree ? `(Free: ${FREE_VIDEO_WATCHES} watches)` : `(Paid: ${PAID_VIDEO_WATCHES} watches)`}</span>
        </div>
        <button class="view-btn" data-video-id="${videoId}" data-is-free="${isFree}">
            Watch (${formatCurrency(isFree ? FREE_VIDEO_REWARD : PAID_VIDEO_REWARD)})
        </button>
    `;
    videoQueueDisplay.appendChild(videoElement);

    // Add event listener for viewing
    videoElement.querySelector('.view-btn').addEventListener('click', async () => {
        const userId = getCurrentTelegramUsername() || 'anonymous'; // Use username or 'anonymous'
        const videoIdToDelete = videoId;
        const isFreeVideo = isFree;

        try {
            // --- Reward Logic (Client-side simulation) ---
            // In a real app, this would trigger a server-side validation
            // and then update the user's balance.
            alert(`Watch this video for 30 seconds. You will earn ${formatCurrency(isFreeVideo ? FREE_VIDEO_REWARD : PAID_VIDEO_REWARD)}.`);
            // Simulate watching: after 30 seconds, reward is given and link removed
            setTimeout(async () => {
                alert(`Video watched! You've earned ${formatCurrency(isFreeVideo ? FREE_VIDEO_REWARD : PAID_VIDEO_REWARD)}.`);
                await removeVideoFromQueue(videoIdToDelete, userId, isFreeVideo); // Remove from queue and user's watch count
                videoElement.remove(); // Remove from DOM
                // TODO: Update user's balance in Firebase
            }, 30000); // 30 seconds delay

        } catch (error) {
            console.error("Error watching video:", error);
            alert("An error occurred. Please try again.");
        }
    });
}

// Add a subscribe task to the subscribe queue
function addSubscribeToQueue(channelUrl, subscribeId, clicksCount, isFree) {
    const subscribeElement = document.createElement("div");
    subscribeElement.classList.add("link-item");
    subscribeElement.innerHTML = `
        <div class="flex flex-col">
            <a href="${channelUrl}" target="_blank" class="text-blue-600 hover:underline font-medium">${channelUrl}</a>
            <span class="queue-info">${isFree ? `(Free: ${FREE_SUBSCRIBE_CLICKS} clicks)` : `(Paid: ${PAID_SUBSCRIBE_CLICKS} clicks)`}</span>
        </div>
        <button class="subscribe-btn" data-subscribe-id="${subscribeId}" data-is-free="${isFree}">
            Subscribe (${formatCurrency(SUBSCRIBE_REWARD)})
        </button>
    `;
    subscribeQueueDisplay.appendChild(subscribeElement);

    // Add event listener for subscribing
    subscribeElement.querySelector('.subscribe-btn').addEventListener('click', async () => {
        const userId = getCurrentTelegramUsername() || 'anonymous'; // Use username or 'anonymous'
        const subscribeIdToDelete = subscribeId;
        const isFreeSubscribe = isFree;

        try {
            // --- Reward Logic (Client-side simulation) ---
            // In a real app, this would involve verifying subscription (complex!)
            // and then rewarding. For now, we simulate.
            alert(`Please subscribe to this channel for 30 seconds. You will earn ${formatCurrency(SUBSCRIBE_REWARD)}.`);
            // Simulate subscription: after 30 seconds, reward is given and link removed
            setTimeout(async () => {
                alert(`Subscription processed! You've earned ${formatCurrency(SUBSCRIBE_REWARD)}.`);
                await removeSubscribeFromQueue(subscribeIdToDelete, userId, isFreeSubscribe); // Remove from queue and user's click count
                subscribeElement.remove(); // Remove from DOM
                // TODO: Update user's balance in Firebase
            }, 30000); // 30 seconds delay

        } catch (error) {
            console.error("Error subscribing:", error);
            alert("An error occurred. Please try again.");
        }
    });
}

// --- Firebase Database Operations ---

// Save Telegram Username to localStorage and update display
saveProfileBtn.addEventListener("click", () => {
    const username = telegramUsernameInput.value.trim();
    if (username) {
        saveTelegramUsername(username);
        telegramUsernameInput.value = ""; // Clear input
        alert("Telegram username saved successfully!");
        // In a real app, you'd also send this to your backend or Firebase
        // to associate it with their account for rewards.
    } else {
        alert("Please enter a valid Telegram username.");
    }
});

// Store a link provided by the user
storeLinkBtn.addEventListener("click", () => {
    const link = linkToStoreInput.value.trim();
    if (!link) {
        alert("Please enter a YouTube link.");
        return;
    }
    if (!link.includes("youtube.com") && !link.includes("youtu.be")) {
        alert("Please enter a valid YouTube link.");
        return;
    }

    const newLinkRef = push(STORED_LINKS_REF);
    const linkId = newLinkRef.key; // Get the unique key generated by push
    set(newLinkRef, {
        url: link,
        submittedBy: getCurrentTelegramUsername() || "anonymous",
        timestamp: Date.now()
    }).then(() => {
        addStoredLinkToDOM(link, linkId); // Add to DOM immediately
        linkToStoreInput.value = ""; // Clear input
        alert("Link stored successfully!");
    }).catch(error => {
        console.error("Error storing link:", error);
        alert("Failed to store link. Please try again.");
    });
});

// Remove a stored link from Firebase and DOM
function removeStoredLink(linkId) {
    const linkRef = child(STORED_LINKS_REF, linkId);
    remove(linkRef).then(() => {
        console.log("Link removed from Firebase.");
    }).catch(error => {
        console.error("Error removing link from Firebase:", error);
        alert("Failed to remove link. Please try again.");
    });
}

// Fetch and display stored links
function fetchStoredLinks() {
    storedLinksDisplay.innerHTML = '<p class="text-center text-gray-500">Loading stored links...</p>';
    onValue(STORED_LINKS_REF, (snapshot) => {
        storedLinksDisplay.innerHTML = ""; // Clear current display
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const linkId = childSnapshot.key;
                const linkData = childSnapshot.val();
                addStoredLinkToDOM(linkData.url, linkId);
            });
        } else {
            storedLinksDisplay.innerHTML = '<p class="text-center text-gray-500">No links stored yet.</p>';
        }
    }, {
        onlyOnce: true // Fetch only once for initial load
    });
}

// --- Queue Management ---

// Function to simulate fetching and adding initial queue items
// In a real app, this would be dynamic and based on availability.
function populateInitialQueue() {
    // Clear existing content
    videoQueueDisplay.innerHTML = '<h3 class="text-lg font-medium mb-3">Videos to Watch</h3>';
    subscribeQueueDisplay.innerHTML = '<h3 class="text-lg font-medium mb-3">Subscribe for Rewards</h3>';

    // Add sample free videos
    for (let i = 0; i < 3; i++) { // Adding 3 free videos as example
        const videoId = generateUniqueId();
        addVideoToQueue(`https://www.youtube.com/watch?v=example${i}`, videoId, FREE_VIDEO_WATCHES, true);
    }

    // Add sample paid videos
    for (let i = 0; i < 2; i++) { // Adding 2 paid videos as example
        const videoId = generateUniqueId();
        addVideoToQueue(`https://www.youtube.com/watch?v=example_paid${i}`, videoId, PAID_VIDEO_WATCHES, false);
    }

    // Add sample free subscribe tasks
    for (let i = 0; i < 2; i++) { // Adding 2 free subscribe tasks
        const subscribeId = generateUniqueId();
        addSubscribeToQueue(`https://www.youtube.com/channel/example_channel${i}`, subscribeId, FREE_SUBSCRIBE_CLICKS, true);
    }

    // Add sample paid subscribe tasks
    for (let i = 0; i < 1; i++) { // Adding 1 paid subscribe task
        const subscribeId = generateUniqueId();
        addSubscribeToQueue(`https://www.youtube.com/channel/example_channel_paid${i}`, subscribeId, PAID_SUBSCRIBE_CLICKS, false);
    }
}

// Function to remove a video from the queue and update user's watch count
async function removeVideoFromQueue(videoId, userId, isFree) {
    // In a real scenario, you'd check if the user has already watched enough,
    // record the watch, and then potentially remove from the queue if it's exhausted.

    // For this example, we just remove it after the simulated watch.
    // A more robust system would involve Firebase Realtime Database to track user watches.
    console.log(`Simulating removal of video ${videoId} for user ${userId}.`);
    // TODO: Implement actual logic to update user watch count in Firebase
    // and handle queue exhaustion.
}

// Function to remove a subscribe task from the queue and update user's click count
async function removeSubscribeFromQueue(subscribeId, userId, isFree) {
    console.log(`Simulating removal of subscribe task ${subscribeId} for user ${userId}.`);
    // TODO: Implement actual logic to update user click count in Firebase
    // and handle queue exhaustion.
}


// --- Referral System ---
const referralBaseUrl = "http://t.me/Sentinel_KRo_earning_bot?startapp"; // Base bot link
const referralBotLink = "http://t.me/Sentinel_KRo_earning_bot?startapp"; // Explicitly stated

function updateReferralLink() {
    const currentUser = getCurrentTelegramUsername();
    if (currentUser) {
        // Append referral code (e.g., using username)
        // In a real system, you'd have unique referral codes generated by your backend.
        // For this example, we'll use the username as a placeholder.
        const referralCode = currentUser.replace('@', ''); // Remove '@' for a cleaner code
        referralLinkInput.value = `${referralBotLink}&ref=${referralCode}`;
    } else {
        referralLinkInput.value = referralBotLink; // Default if no user logged in
    }
}

copyReferralBtn.addEventListener("click", () => {
    referralLinkInput.select();
    navigator.clipboard.writeText(referralLinkInput.value).then(() => {
        alert("Referral link copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy referral link: ", err);
        alert("Could not copy link. Please copy it manually.");
    });
});

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    // Initialize display for Telegram username
    displayCurrentTelegramUsername();

    // Populate initial queue items (for demonstration)
    populateInitialQueue();

    // Fetch and display any existing stored links
    fetchStoredLinks();

    // Update referral link based on current user
    updateReferralLink();

    // Re-update referral link if username is saved later
    saveProfileBtn.addEventListener("click", updateReferralLink);
});

