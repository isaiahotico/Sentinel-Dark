
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref, push, onValue, update, remove, set, get } from "firebase/database";

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
const analytics = getAnalytics(app); // eslint-disable-line no-unused-vars
const database = getDatabase(app);

// Database References
const usersRef = ref(database, 'users');
const videoQueueRef = ref(database, 'videoQueue');
const subscribeQueueRef = ref(database, 'subscribeQueue');

// --- User Management ---
let currentUserId = localStorage.getItem('paperhouse_user_id');

// Generate a unique user ID if one doesn't exist
if (!currentUserId) {
    currentUserId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now();
    localStorage.setItem('paperhouse_user_id', currentUserId);
    console.log("New user ID generated:", currentUserId);
    // Initialize user data in Firebase
    set(ref(database, `users/${currentUserId}`), {
        telegramUsername: '',
        balance: 0,
        watchedVideos: {}, // Use an object to store video IDs watched by this user
        subscribedChannels: {}, // Use an object to store channel IDs subscribed by this user
        submittedFreeVideosCount: 0,
        submittedFreeSubscribesCount: 0,
        createdAt: new Date().toISOString()
    });
} else {
    console.log("Existing user ID found:", currentUserId);
}

document.getElementById('user-id-display').textContent = currentUserId;

// Listen for user data changes
onValue(ref(database, `users/${currentUserId}`), (snapshot) => {
    const userData = snapshot.val();
    if (userData) {
        document.getElementById('user-balance').textContent = userData.balance ? userData.balance.toFixed(2) : '0.00';

        const telegramInputArea = document.getElementById('telegram-input-area');
        const telegramDisplay = document.getElementById('telegram-username-display');
        const telegramUsernameSpan = telegramDisplay.querySelector('span');

        if (userData.telegramUsername && userData.telegramUsername !== '') {
            telegramUsernameSpan.textContent = userData.telegramUsername;
            telegramInputArea.classList.add('hidden'); // Hide input if username exists
            telegramDisplay.classList.remove('hidden');
        } else {
            telegramUsernameSpan.textContent = 'N/A';
            telegramInputArea.classList.remove('hidden'); // Show input if no username
            telegramDisplay.classList.add('hidden');
        }
        // Also update user's submitted links display (simplified, just shows count)
        displayUserSubmittedLinks(userData);

    } else {
        // Handle case where user data might not be initialized yet (race condition on new user)
        document.getElementById('user-balance').textContent = '0.00';
    }
});

// Save Telegram Username
document.getElementById('save-telegram-username').addEventListener('click', () => {
    const usernameInput = document.getElementById('telegram-username-input');
    const username = usernameInput.value.trim();
    if (username) {
        // A user cannot change their username once set in this basic model
        get(ref(database, `users/${currentUserId}/telegramUsername`)).then(snapshot => {
            if (snapshot.exists() && snapshot.val() !== '') {
                alert('Your Telegram username is already set and cannot be changed.');
                usernameInput.value = '';
                return;
            }
            update(ref(database, `users/${currentUserId}`), { telegramUsername: username })
                .then(() => {
                    alert('Telegram username saved!');
                    usernameInput.value = ''; // Clear input
                })
                .catch(error => {
                    console.error("Error saving Telegram username:", error);
                    alert('Failed to save Telegram username.');
                });
        }).catch(error => console.error("Error checking existing username:", error));
    } else {
        alert('Please enter a valid Telegram username.');
    }
});


// --- Link Submission ---
document.getElementById('submit-link').addEventListener('click', async () => {
    const urlInput = document.getElementById('link-url');
    const linkType = document.querySelector('input[name="link-type"]:checked').value;
    const url = urlInput.value.trim();
    const submissionMessage = document.getElementById('submission-message');

    submissionMessage.textContent = ''; // Clear previous messages
    submissionMessage.className = 'mt-3 text-center text-sm text-gray-600';

    if (!url) {
        submissionMessage.textContent = 'Please enter a URL.';
        submissionMessage.className = 'mt-3 text-center text-sm text-red-600';
        return;
    }

    if (!isValidYouTubeUrl(url)) {
        submissionMessage.textContent = 'Please enter a valid YouTube video or channel URL.';
        submissionMessage.className = 'mt-3 text-center text-sm text-red-600';
        return;
    }

    // Fetch user's current submission counts and balance
    const userSnapshot = await get(ref(database, `users/${currentUserId}`));
    const userData = userSnapshot.val();

    if (!userData) {
        submissionMessage.textContent = 'Error: User data not found. Please refresh.';
        submissionMessage.className = 'mt-3 text-center text-sm text-red-600';
        return;
    }

    let interactionsRemaining, submissionCost, rewardForWatchers, counterField, queueRef;
    const submissionFee = 1.00; // Cost for non-free links

    if (linkType === 'video') {
        counterField = 'submittedFreeVideosCount';
        if ((userData[counterField] || 0) < 5) {
            interactionsRemaining = 100;
            submissionCost = 0; // Free submission
        } else {
            interactionsRemaining = 120;
            submissionCost = submissionFee; // 1 Peso
            if (userData.balance < submissionCost) {
                submissionMessage.textContent = `You need ${submissionCost.toFixed(2)} PHP to submit more video links. Current balance: ${userData.balance.toFixed(2)} PHP`;
                submissionMessage.className = 'mt-3 text-center text-sm text-red-600';
                return;
            }
        }
        rewardForWatchers = 0.01;
        queueRef = videoQueueRef;
    } else { // subscribe
        counterField = 'submittedFreeSubscribesCount';
        if ((userData[counterField] || 0) < 5) {
            interactionsRemaining = 50;
            submissionCost = 0; // Free submission
        } else {
            interactionsRemaining = 65;
            submissionCost = submissionFee; // 1 Peso
            if (userData.balance < submissionCost) {
                submissionMessage.textContent = `You need ${submissionCost.toFixed(2)} PHP to submit more subscribe links. Current balance: ${userData.balance.toFixed(2)} PHP`;
                submissionMessage.className = 'mt-3 text-center text-sm text-red-600';
                return;
            }
        }
        rewardForWatchers = 0.03;
        queueRef = subscribeQueueRef;
    }

    try {
        const newLinkRef = push(queueRef); // Get a new unique key
        await set(newLinkRef, {
            url: url,
            submittedBy: currentUserId,
            remaining: interactionsRemaining,
            cost: submissionCost, // Cost paid by submitter
            reward: rewardForWatchers, // Reward for the user who interacts
            submittedAt: new Date().toISOString(),
            type: linkType
        });

        // Deduct submission cost from user's balance and increment free counter if applicable
        const updates = {
            balance: userData.balance - submissionCost
        };
        if (submissionCost === 0) { // Only increment if it was a free submission
            updates[counterField] = (userData[counterField] || 0) + 1;
        }
        await update(ref(database, `users/${currentUserId}`), updates);

        submissionMessage.textContent = 'Link submitted successfully!';
        submissionMessage.className = 'mt-3 text-center text-sm text-green-600';
        urlInput.value = '';
    } catch (error) {
        console.error("Error submitting link:", error);
        submissionMessage.textContent = 'Failed to submit link. Please try again.';
        submissionMessage.className = 'mt-3 text-center text-sm text-red-600';
    }
});

// Helper to validate YouTube URL
function isValidYouTubeUrl(url) {
    const videoRegex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
    const channelRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:channel\/|user\/|c\/)([\w-]+)(?:\S+)?/;
    return videoRegex.test(url) || channelRegex.test(url);
}

// Function to extract YouTube video ID
function getYouTubeVideoId(url) {
    const regex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Function to extract YouTube channel ID/Username (simplified)
function getYouTubeChannelIdentifier(url) {
    const channelRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:channel\/|user\/|c\/)([\w-]+)(?:\S+)?/;
    const match = url.match(channelRegex);
    return match ? match[1] : null; // Returns channel ID or custom URL name
}

// --- Display User's Submitted Links (for tracking) ---
// This is a simplified display showing current counts
async function displayUserSubmittedLinks(userData) {
    const container = document.getElementById('user-submitted-links');
    container.innerHTML = ''; // Clear previous content

    const videoSnapshot = await get(videoQueueRef);
    const allVideos = videoSnapshot.val() || {};
    const subSnapshot = await get(subscribeQueueRef);
    const allChannels = subSnapshot.val() || {};

    let userVideos = [];
    for (const key in allVideos) {
        if (allVideos[key].submittedBy === currentUserId) {
            userVideos.push({ id: key, ...allVideos[key] });
        }
    }

    let userChannels = [];
    for (const key in allChannels) {
        if (allChannels[key].submittedBy === currentUserId) {
            userChannels.push({ id: key, ...allChannels[key] });
        }
    }

    if (userVideos.length === 0 && userChannels.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500">No links submitted yet.</p>';
        return;
    }

    // Display submitted videos
    if (userVideos.length > 0) {
        const videoList = document.createElement('div');
        videoList.className = "p-3 bg-blue-50 rounded-md";
        videoList.innerHTML = `<h4 class="font-semibold text-blue-800 mb-2">Your Video Links:</h4>`;
        userVideos.forEach(link => {
            const videoId = getYouTubeVideoId(link.url);
            const thumbnail = videoId ? `https://img.youtube.com/vi/${videoId}/default.jpg` : `https://via.placeholder.com/60x45?text=Video`;
            videoList.innerHTML += `
                <div class="flex items-center space-x-2 py-1 border-b border-blue-100 last:border-b-0">
                    <img src="${thumbnail}" alt="Video Thumbnail" class="w-12 h-9 rounded object-cover">
                    <p class="text-sm text-blue-700 flex-grow truncate">${link.url}</p>
                    <p class="text-sm text-blue-700">Remaining: <span class="font-bold">${link.remaining}</span></p>
                    <button class="text-red-500 hover:text-red-700 text-sm delete-link-btn" data-id="${link.id}" data-type="video">X</button>
                </div>
            `;
        });
        container.appendChild(videoList);
    }

    // Display submitted channels
    if (userChannels.length > 0) {
        const channelList = document.createElement('div');
        channelList.className = "p-3 bg-purple-50 rounded-md mt-4";
        channelList.innerHTML = `<h4 class="font-semibold text-purple-800 mb-2">Your Channel Links:</h4>`;
        userChannels.forEach(link => {
            channelList.innerHTML += `
                <div class="flex items-center space-x-2 py-1 border-b border-purple-100 last:border-b-0">
                    <img src="https://via.placeholder.com/45x45?text=Channel" alt="Channel Icon" class="w-9 h-9 rounded-full object-cover">
                    <p class="text-sm text-purple-700 flex-grow truncate">${link.url}</p>
                    <p class="text-sm text-purple-700">Remaining: <span class="font-bold">${link.remaining}</span></p>
                    <button class="text-red-500 hover:text-red-700 text-sm delete-link-btn" data-id="${link.id}" data-type="subscribe">X</button>
                </div>
            `;
        });
        container.appendChild(channelList);
    }

    // Add event listeners for deletion (optional feature)
    container.querySelectorAll('.delete-link-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (confirm("Are you sure you want to delete this link? This action cannot be undone.")) {
                const linkId = e.target.dataset.id;
                const linkType = e.target.dataset.type;
                const targetRef = linkType === 'video' ? videoQueueRef : subscribeQueueRef;
                try {
                    await remove(ref(database, `${targetRef.path}/${linkId}`));
                    alert('Link deleted successfully!');
                } catch (error) {
                    console.error("Error deleting link:", error);
                    alert('Failed to delete link.');
                }
            }
        });
    });
}


// --- Display Video Links available to watch ---
onValue(videoQueueRef, async (snapshot) => {
    const videoLinksContainer = document.getElementById('video-links-container');
    videoLinksContainer.innerHTML = '';
    const videos = snapshot.val() || {};

    const userSnapshot = await get(ref(database, `users/${currentUserId}`)); // Fetch current user's watched videos
    const userData = userSnapshot.val();
    const watchedVideos = userData?.watchedVideos || {};

    let hasVisibleVideos = false;

    for (const key in videos) {
        const video = videos[key];
        // Only show if user hasn't watched it yet, it has remaining watches, and not submitted by current user
        if (!watchedVideos[key] && video.remaining > 0 && video.submittedBy !== currentUserId) {
            hasVisibleVideos = true;
            const videoId = getYouTubeVideoId(video.url);
            // Default to mqdefault.jpg (medium quality) for better appearance
            const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : 'https://via.placeholder.com/320x180?text=Video';

            const videoElement = document.createElement('div');
            videoElement.id = `video-card-${key}`; // Add ID for removal
            videoElement.className = 'bg-gray-50 p-4 rounded-lg shadow flex flex-col justify-between';
            videoElement.innerHTML = `
                <div class="youtube-thumbnail relative mb-3">
                    <img src="${thumbnailUrl}" alt="Video Thumbnail" class="absolute inset-0 w-full h-full object-cover">
                    <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                        <span class="text-white text-5xl opacity-80 pointer-events-none">▶</span>
                    </div>
                </div>
                <h3 class="font-semibold text-lg mb-2 truncate">${video.url}</h3>
                <p class="text-sm text-gray-600">Remaining views: <span id="video-remaining-${key}">${video.remaining}</span></p>
                <p class="text-sm text-gray-600 mb-3">Reward: ${video.reward.toFixed(2)} PHP</p>
                <button id="watch-btn-${key}"
                        class="mt-auto px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-md font-semibold transition duration-300">
                    Watch (30s)
                </button>
                <button id="claim-btn-${key}"
                        class="mt-auto px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md font-semibold transition duration-300 hidden">
                    Claim Reward
                </button>
                <div id="timer-display-${key}" class="text-center mt-2 text-sm text-gray-700 hidden">Time left: <span class="font-bold">30</span>s</div>
            `;
            videoLinksContainer.appendChild(videoElement);

            // Add event listener for watch button
            document.getElementById(`watch-btn-${key}`).addEventListener('click', () => startVideoWatch(key, video.url, video.reward));
        }
    }

    if (!hasVisibleVideos) {
        videoLinksContainer.innerHTML = '<p class="text-center text-gray-500 col-span-full">No videos available to watch. Check back later!</p>';
    }
});


// --- Display Subscribe Links available to subscribe ---
onValue(subscribeQueueRef, async (snapshot) => {
    const subscribeLinksContainer = document.getElementById('subscribe-links-container');
    subscribeLinksContainer.innerHTML = '';
    const channels = snapshot.val() || {};

    const userSnapshot = await get(ref(database, `users/${currentUserId}`));
    const userData = userSnapshot.val();
    const subscribedChannels = userData?.subscribedChannels || {};

    let hasVisibleChannels = false;

    for (const key in channels) {
        const channel = channels[key];
        // Only show if user hasn't subscribed yet, it has remaining subscribers, and not submitted by current user
        if (!subscribedChannels[key] && channel.remaining > 0 && channel.submittedBy !== currentUserId) {
            hasVisibleChannels = true;
            const channelIdentifier = getYouTubeChannelIdentifier(channel.url);
            const placeholderImg = `https://via.placeholder.com/150x150?text=Channel`;

            const channelElement = document.createElement('div');
            channelElement.id = `channel-card-${key}`; // Add ID for removal
            channelElement.className = 'bg-gray-50 p-4 rounded-lg shadow flex flex-col justify-between items-center text-center';
            channelElement.innerHTML = `
                <img src="${placeholderImg}" alt="Channel Icon" class="w-24 h-24 rounded-full mb-3 object-cover border-2 border-blue-400">
                <h3 class="font-semibold text-lg mb-2 truncate w-full">${channelIdentifier || 'YouTube Channel'}</h3>
                <p class="text-sm text-gray-600">Remaining subscribers: <span id="sub-remaining-${key}">${channel.remaining}</span></p>
                <p class="text-sm text-gray-600 mb-3">Reward: ${channel.reward.toFixed(2)} PHP</p>
                <button id="subscribe-btn-${key}"
                        class="mt-auto px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-semibold transition duration-300">
                    Subscribe
                </button>
                <button id="claim-sub-btn-${key}"
                        class="mt-auto px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md font-semibold transition duration-300 hidden">
                    Claim Reward
                </button>
            `;
            subscribeLinksContainer.appendChild(channelElement);

            document.getElementById(`subscribe-btn-${key}`).addEventListener('click', () => startChannelSubscribe(key, channel.url, channel.reward));
        }
    }

    if (!hasVisibleChannels) {
        subscribeLinksContainer.innerHTML = '<p class="text-center text-gray-500 col-span-full">No channels available to subscribe. Check back later!</p>';
    }
});


// --- Watch Video Logic ---
async function startVideoWatch(key, videoUrl, rewardAmount) {
    const watchBtn = document.getElementById(`watch-btn-${key}`);
    const claimBtn = document.getElementById(`claim-btn-${key}`);
    const timerDisplay = document.getElementById(`timer-display-${key}`);
    const timerSpan = timerDisplay.querySelector('span');
    const videoCard = document.getElementById(`video-card-${key}`);

    watchBtn.disabled = true;
    watchBtn.textContent = 'Opening video...';

    // Open video in new tab
    window.open(videoUrl, '_blank');

    // Simulate 30-second watch time
    timerDisplay.classList.remove('hidden');
    let timeLeft = 30;
    timerSpan.textContent = timeLeft;

    const timerInterval = setInterval(() => {
        timeLeft--;
        timerSpan.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerDisplay.classList.add('hidden');
            watchBtn.classList.add('hidden'); // Hide watch button
            claimBtn.classList.remove('hidden'); // Show claim button
            claimBtn.disabled = false;
            claimBtn.textContent = 'Claim Reward';
        }
    }, 1000);

    // Event listener for claiming reward
    claimBtn.addEventListener('click', async () => {
        claimBtn.disabled = true;
        claimBtn.textContent = 'Claiming...';

        try {
            const videoQueueEntryRef = ref(database, `videoQueue/${key}`);
            const userRef = ref(database, `users/${currentUserId}`);

            const videoSnapshot = await get(videoQueueEntryRef);
            const videoData = videoSnapshot.val();

            if (!videoData || videoData.remaining <= 0) {
                alert('This video is no longer available or has no remaining views.');
                videoCard.classList.add('fade-out');
                setTimeout(() => videoCard.remove(), 500);
                return;
            }

            const userSnapshot = await get(userRef);
            const userData = userSnapshot.val();

            if (userData.watchedVideos && userData.watchedVideos[key]) {
                alert('You have already watched this video for reward.');
                videoCard.classList.add('fade-out');
                setTimeout(() => videoCard.remove(), 500);
                return;
            }

            // Update user balance, mark video as watched, decrement video remaining
            const updates = {};
            updates[`users/${currentUserId}/balance`] = (userData.balance || 0) + rewardAmount;
            updates[`users/${currentUserId}/watchedVideos/${key}`] = true;
            updates[`videoQueue/${key}/remaining`] = videoData.remaining - 1;

            await update(ref(database), updates);

            alert(`Successfully earned ${rewardAmount.toFixed(2)} PHP!`);

            // Check if video should be removed from queue
            if (videoData.remaining - 1 <= 0) {
                await remove(ref(database, `videoQueue/${key}`));
            }
            // Remove from UI for the current user
            videoCard.classList.add('fade-out');
            setTimeout(() => videoCard.remove(), 500);

        } catch (error) {
            console.error("Error claiming video reward:", error);
            alert('Failed to claim reward. Please try again.');
            claimBtn.disabled = false;
            claimBtn.textContent = 'Claim Reward';
        }
    }, { once: true }); // Ensure claim button can only be clicked once
}


// --- Subscribe Channel Logic ---
async function startChannelSubscribe(key, channelUrl, rewardAmount) {
    const subscribeBtn = document.getElementById(`subscribe-btn-${key}`);
    const claimSubBtn = document.getElementById(`claim-sub-btn-${key}`);
    const channelCard = document.getElementById(`channel-card-${key}`);

    subscribeBtn.disabled = true;
    subscribeBtn.textContent = 'Opening channel...';

    // Open channel in new tab
    window.open(channelUrl, '_blank');

    // After opening, hide subscribe button and show claim button
    subscribeBtn.classList.add('hidden');
    claimSubBtn.classList.remove('hidden');
    claimSubBtn.disabled = false;
    claimSubBtn.textContent = 'Claim Reward';

    // Event listener for claiming reward
    claimSubBtn.addEventListener('click', async () => {
        claimSubBtn.disabled = true;
        claimSubBtn.textContent = 'Claiming...';

        try {
            const subscribeQueueEntryRef = ref(database, `subscribeQueue/${key}`);
            const userRef = ref(database, `users/${currentUserId}`);

            const channelSnapshot = await get(subscribeQueueEntryRef);
            const channelData = channelSnapshot.val();

            if (!channelData || channelData.remaining <= 0) {
                alert('This channel is no longer available or has no remaining subscribers.');
                channelCard.classList.add('fade-out');
                setTimeout(() => channelCard.remove(), 500);
                return;
            }

            const userSnapshot = await get(userRef);
            const userData = userSnapshot.val();

            if (userData.subscribedChannels && userData.subscribedChannels[key]) {
                alert('You have already subscribed to this channel for reward.');
                channelCard.classList.add('fade-out');
                setTimeout(() => channelCard.remove(), 500);
                return;
            }

            // Update user balance, mark channel as subscribed, decrement channel remaining
            const updates = {};
            updates[`users/${currentUserId}/balance`] = (userData.balance || 0) + rewardAmount;
            updates[`users/${currentUserId}/subscribedChannels/${key}`] = true;
            updates[`subscribeQueue/${key}/remaining`] = channelData.remaining - 1;

            await update(ref(database), updates);

            alert(`Successfully earned ${rewardAmount.toFixed(2)} PHP!`);

            // Check if channel should be removed from queue
            if (channelData.remaining - 1 <= 0) {
                await remove(ref(database, `subscribeQueue/${key}`));
            }
            // Remove from UI for the current user
            channelCard.classList.add('fade-out');
            setTimeout(() => channelCard.remove(), 500);

        } catch (error) {
            console.error("Error claiming subscribe reward:", error);
            alert('Failed to claim reward. Please try again.');
            claimSubBtn.disabled = false;
            claimSubBtn.textContent = 'Claim Reward';
        }
    }, { once: true }); // Ensure claim button can only be clicked once
}
