
// app.js

// 1. Firebase Initialization
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c", // WARNING: Exposing API key directly is not recommended for production
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 2. Global Variables
let currentUser = null;
let userStars = 0.0;
let currentQuestion = {};
const REWARD_PER_CORRECT_ANSWER = 0.5;
const ADMIN_PASSWORD = 'C@rL12345'; // WARNING: Hardcoding admin password is a security risk!
const GCASH_ACTIVATION_NUMBER = '09634780237';

// 3. DOM Elements
const activationPage = document.getElementById('activation-page');
const activationCodeInput = document.getElementById('activation-code-input');
const activateButton = document.getElementById('activate-button');
const activationMessage = document.getElementById('activation-message');

const authPage = document.getElementById('auth-page');
const telegramUsernameInput = document.getElementById('telegram-username-input');
const loginButton = document.getElementById('login-button');
const authMessage = document.getElementById('auth-message');

const mainPage = document.getElementById('main-page');
const starsDisplay = document.getElementById('stars-display');
const userTelegramDisplay = document.getElementById('user-telegram-display');
const quizQuestion = document.getElementById('quiz-question');
const quizAnswerInput = document.getElementById('quiz-answer');
const submitAnswerButton = document.getElementById('submit-answer');
const quizMessage = document.getElementById('quiz-message');
const withdrawButton = document.getElementById('withdraw-button');

const withdrawalPage = document.getElementById('withdrawal-page');
const withdrawalStarsDisplay = document.getElementById('withdrawal-stars-display');
const withdrawalOptions = document.querySelectorAll('.withdrawal-option');
const withdrawalMessage = document.getElementById('withdrawal-message');
const backToQuizButton = document.getElementById('back-to-quiz');

const adminPage = document.getElementById('admin-page');
const adminPasswordInput = document.getElementById('admin-password-input');
const adminLoginButton = document.getElementById('admin-login-button');
const adminLoginMessage = document.getElementById('admin-login-message');
const adminContent = document.getElementById('admin-content');
const generateCodeButton = document.getElementById('generate-code-button');
const generatedCodeDisplay = document.getElementById('generated-code-display');
const withdrawalRequestsList = document.getElementById('withdrawal-requests-list');

// 4. Helper Functions
function showPage(pageElement) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    pageElement.classList.add('active');
}

function generateRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateQuizQuestion() {
    const num1 = generateRandomNumber(1, 20);
    const num2 = generateRandomNumber(1, 20);
    const operation = ['+', '-', '*', '/'][generateRandomNumber(0, 3)];
    let question = '';
    let answer;

    switch (operation) {
        case '+':
            question = `${num1} + ${num2} = ?`;
            answer = num1 + num2;
            break;
        case '-':
            question = `${num1} - ${num2} = ?`;
            answer = num1 - num2;
            break;
        case '*':
            question = `${num1} * ${num2} = ?`;
            answer = num1 * num2;
            break;
        case '/':
            // Ensure division results in a whole number for simplicity
            let tempNum1 = num1 * num2; // Make num1 a multiple of num2
            question = `${tempNum1} / ${num2} = ?`;
            answer = tempNum1 / num2;
            break;
    }
    currentQuestion = { question, answer };
    quizQuestion.textContent = question;
    quizAnswerInput.value = '';
    quizMessage.textContent = '';
}

async function updateUserStars(userId, amount) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
        stars: userStars + amount
    });
    userStars += amount;
    starsDisplay.textContent = userStars.toFixed(1);
    withdrawalStarsDisplay.textContent = userStars.toFixed(1);
}

async function fetchUserData(userId) {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const userData = userSnap.data();
        userStars = userData.stars || 0.0;
        starsDisplay.textContent = userStars.toFixed(1);
        userTelegramDisplay.textContent = userData.telegramUsername || 'N/A';
        return userData;
    }
    return null;
}

// 5. Authentication and User Management
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userData = await fetchUserData(user.uid);

        if (userData && userData.activated) {
            showPage(mainPage);
            generateQuizQuestion();
        } else {
            // User exists but not activated, or new anonymous user
            showPage(activationPage);
        }
    } else {
        // No user signed in, show activation page first
        showPage(activationPage);
    }
});

async function signInOrCreateUser(telegramUsername) {
    if (!telegramUsername || !telegramUsername.startsWith('@')) {
        authMessage.textContent = "Please enter a valid Telegram username starting with '@'.";
        return;
    }

    try {
        // Check if a user with this telegram username already exists
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('telegramUsername', '==', telegramUsername));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // User with this Telegram username exists, sign in anonymously
            await signInAnonymously(auth);
            const existingUserDoc = querySnapshot.docs[0];
            currentUser = auth.currentUser; // Update currentUser to the anonymous user
            // Link anonymous user to existing data (if needed, or just use existing data)
            // For simplicity, we'll just update the current user's UID to match the existing one
            // This is a simplified approach, real linking is more complex.
            // For now, we'll assume the anonymous user is a new session for an existing telegram user.
            // A more robust solution might involve email/password or phone auth.
            await updateDoc(doc(db, 'users', currentUser.uid), {
                telegramUsername: telegramUsername,
                activated: existingUserDoc.data().activated || false,
                stars: existingUserDoc.data().stars || 0.0,
                lastLogin: serverTimestamp()
            });
            authMessage.textContent = "Signed in successfully!";
        } else {
            // New user, sign in anonymously and create new user document
            await signInAnonymously(auth);
            currentUser = auth.currentUser;
            await setDoc(doc(db, 'users', currentUser.uid), {
                telegramUsername: telegramUsername,
                stars: 0.0,
                activated: false,
                createdAt: serverTimestamp(),
                lastLogin: serverTimestamp()
            });
            authMessage.textContent = "Account created successfully! Please activate your account.";
        }
        // After sign-in/creation, onAuthStateChanged will handle page display
    } catch (error) {
        console.error("Error signing in or creating user:", error);
        authMessage.textContent = `Error: ${error.message}`;
    }
}

// 6. Activation Logic
activateButton.addEventListener('click', async () => {
    const code = activationCodeInput.value.trim();
    if (!code) {
        activationMessage.textContent = "Please enter an activation code.";
        return;
    }

    if (!currentUser) {
        activationMessage.textContent = "Please sign in first.";
        showPage(authPage); // Redirect to auth if no user
        return;
    }

    try {
        const codeRef = doc(db, 'activationCodes', code);
        const codeSnap = await getDoc(codeRef);

        if (codeSnap.exists() && !codeSnap.data().usedBy) {
            // Code is valid and unused
            await updateDoc(doc(db, 'users', currentUser.uid), {
                activated: true
            });
            await updateDoc(codeRef, {
                usedBy: currentUser.uid,
                usedAt: serverTimestamp()
            });
            activationMessage.textContent = "Account activated successfully! Redirecting...";
            setTimeout(() => {
                showPage(mainPage);
                generateQuizQuestion();
            }, 1500);
        } else if (codeSnap.exists() && codeSnap.data().usedBy) {
            activationMessage.textContent = "This activation code has already been used.";
        } else {
            activationMessage.textContent = "Invalid activation code.";
        }
    } catch (error) {
        console.error("Error activating account:", error);
        activationMessage.textContent = `Error: ${error.message}`;
    }
});

loginButton.addEventListener('click', () => {
    const telegramUsername = telegramUsernameInput.value.trim();
    signInOrCreateUser(telegramUsername);
});

// 7. Quiz Logic
submitAnswerButton.addEventListener('click', async () => {
    const userAnswer = parseFloat(quizAnswerInput.value);
    if (isNaN(userAnswer)) {
        quizMessage.textContent = "Please enter a valid number.";
        return;
    }

    if (userAnswer === currentQuestion.answer) {
        quizMessage.textContent = "Correct! You earned 0.5 🌟";
        await updateUserStars(currentUser.uid, REWARD_PER_CORRECT_ANSWER);

        // Show ads and give 3x reward
        // The Monetag SDK function `show_10550051()` is assumed to be globally available from the script tag.
        if (typeof show_10550051 === 'function') {
            try {
                // Show first ad
                await show_10550051().then(async () => {
                    alert('You have seen the first ad!');
                    // Show second ad
                    await show_10550051().then(async () => {
                        alert('You have seen the second ad!');
                        await updateUserStars(currentUser.uid, REWARD_PER_CORRECT_ANSWER * 2); // 0.5 + 0.5*2 = 1.5 total for correct answer + ads
                        quizMessage.textContent += " + 1.0 🌟 from ads!";
                    });
                });
            } catch (adError) {
                console.error("Error showing ad:", adError);
                quizMessage.textContent += " (Ad failed, no extra reward)";
            }
        } else {
            console.warn("Monetag SDK function show_10550051 not found. Ads will not be shown.");
        }
    } else {
        quizMessage.textContent = `Incorrect. The answer was ${currentQuestion.answer}.`;
    }
    generateQuizQuestion(); // Always generate a new question
});

// 8. Withdrawal Logic
withdrawButton.addEventListener('click', () => {
    showPage(withdrawalPage);
    withdrawalStarsDisplay.textContent = userStars.toFixed(1);
    withdrawalMessage.textContent = '';
});

backToQuizButton.addEventListener('click', () => {
    showPage(mainPage);
    generateQuizQuestion();
});

withdrawalOptions.forEach(button => {
    button.addEventListener('click', async () => {
        const requiredStars = parseFloat(button.dataset.stars);
        const pesoAmount = parseFloat(button.dataset.peso);

        if (userStars >= requiredStars) {
            try {
                // Deduct stars immediately to prevent double spending
                await updateUserStars(currentUser.uid, -requiredStars);

                // Record withdrawal request
                await addDoc(collection(db, 'users', currentUser.uid, 'withdrawals'), {
                    stars: requiredStars,
                    peso: pesoAmount,
                    telegramUsername: userTelegramDisplay.textContent,
                    status: 'pending', // 'pending', 'processed', 'rejected'
                    requestedAt: serverTimestamp()
                });
                withdrawalMessage.textContent = `Withdrawal request for ${requiredStars} stars (${pesoAmount} PHP) submitted successfully!`;
                withdrawalMessage.style.color = 'green';
            } catch (error) {
                console.error("Error submitting withdrawal request:", error);
                withdrawalMessage.textContent = `Error submitting withdrawal: ${error.message}`;
                withdrawalMessage.style.color = 'red';
                // If transaction fails, ideally revert stars (more complex with client-side only)
                // For a real app, this should be handled by a secure backend.
                await updateUserStars(currentUser.uid, requiredStars); // Attempt to revert
            }
        } else {
            withdrawalMessage.textContent = `You need ${requiredStars} stars to withdraw ${pesoAmount} PHP. You only have ${userStars.toFixed(1)} stars.`;
            withdrawalMessage.style.color = 'red';
        }
    });
});

// 9. Admin Panel Logic
adminLoginButton.addEventListener('click', () => {
    const password = adminPasswordInput.value;
    if (password === ADMIN_PASSWORD) {
        adminLoginMessage.textContent = "Admin login successful!";
        adminLoginMessage.style.color = 'green';
        adminPasswordInput.classList.add('hidden');
        adminLoginButton.classList.add('hidden');
        adminContent.classList.remove('hidden');
        loadWithdrawalRequests(); // Load requests on successful login
    } else {
        adminLoginMessage.textContent = "Incorrect admin password.";
        adminLoginMessage.style.color = 'red';
    }
});

generateCodeButton.addEventListener('click', async () => {
    const newCode = Math.random().toString(36).substring(2, 10).toUpperCase(); // Simple random code
    try {
        await setDoc(doc(db, 'activationCodes', newCode), {
            createdAt: serverTimestamp(),
            usedBy: null // null indicates unused
        });
        generatedCodeDisplay.textContent = `Generated Code: ${newCode}`;
        generatedCodeDisplay.style.color = 'blue';
    } catch (error) {
        console.error("Error generating activation code:", error);
        generatedCodeDisplay.textContent = `Error generating code: ${error.message}`;
        generatedCodeDisplay.style.color = 'red';
    }
});

async function loadWithdrawalRequests() {
    withdrawalRequestsList.innerHTML = '';
    try {
        // Admin needs to authenticate to Firebase to read this securely
        // For simplicity, we're assuming admin is already "logged in" via the password check
        // and Firebase rules allow admin UID to read.
        // A proper admin login would involve Firebase Auth for the admin.
        const q = query(collection(db, 'users')); // Get all users
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach(async (userDoc) => {
            const userId = userDoc.id;
            const userTelegram = userDoc.data().telegramUsername;
            const withdrawalQ = query(collection(db, 'users', userId, 'withdrawals'), where('status', '==', 'pending'));
            const withdrawalSnapshot = await getDocs(withdrawalQ);

            withdrawalSnapshot.forEach(async (withdrawalDoc) => {
                const request = withdrawalDoc.data();
                const requestId = withdrawalDoc.id;
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    User: ${userTelegram} (ID: ${userId})<br>
                    Stars: ${request.stars} 🌟, PHP: ${request.peso}<br>
                    Status: ${request.status}<br>
                    Requested: ${new Date(request.requestedAt.toDate()).toLocaleString()}
                    <button class="process" data-user-id="${userId}" data-request-id="${requestId}">Process</button>
                    <button class="reject" data-user-id="${userId}" data-request-id="${requestId}">Reject</button>
                `;
                withdrawalRequestsList.appendChild(listItem);
            });
        });
    } catch (error) {
        console.error("Error loading withdrawal requests:", error);
        withdrawalRequestsList.innerHTML = `<li>Error loading requests: ${error.message}</li>`;
    }
}

withdrawalRequestsList.addEventListener('click', async (event) => {
    if (event.target.classList.contains('process') || event.target.classList.contains('reject')) {
        const userId = event.target.dataset.userId;
        const requestId = event.target.dataset.requestId;
        const newStatus = event.target.classList.contains('process') ? 'processed' : 'rejected';

        try {
            await updateDoc(doc(db, 'users', userId, 'withdrawals', requestId), {
                status: newStatus,
                processedAt: serverTimestamp()
            });
            alert(`Request ${requestId} for user ${userId} marked as ${newStatus}.`);
            loadWithdrawalRequests(); // Refresh the list
        } catch (error) {
            console.error(`Error updating withdrawal request ${requestId}:`, error);
            alert(`Failed to update request: ${error.message}`);
        }
    }
});

// Initial page load check for admin (if URL contains a specific parameter, for example)
// For now, admin page is accessed by clicking a hidden element or directly navigating
// This is a very basic admin access. A real admin panel would have its own login.
document.addEventListener('keydown', (e) => {
    if (e.key === 'A' && e.ctrlKey) { // Ctrl+A to open admin page
        showPage(adminPage);
    }
});

// Handle initial page display based on activation status
// This is handled by onAuthStateChanged, but if no user is signed in, it defaults to activation.
// We need a mechanism to transition from activation to auth if the user isn't signed in yet.
if (!currentUser) {
    // If no user is logged in at all, start with activation page.
    // The activation page will prompt for code, and if no user, it will suggest signing in.
    // Let's refine the flow:
    // 1. Check if user is activated (requires being logged in).
    // 2. If not logged in, prompt for Telegram username (auth page).
    // 3. Once logged in (anonymously), check activation status.
    // 4. If not activated, show activation page.
    // 5. If activated, show main page.

    // Initial state: show activation page. The onAuthStateChanged will then refine.
    showPage(activationPage);

    // If activation button is clicked and no currentUser, guide to auth.
    activateButton.addEventListener('click', () => {
        if (!currentUser) {
            activationMessage.textContent = "Please sign in with your Telegram username first.";
            showPage(authPage);
        }
    });
}
