// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.2.0/firebase-app.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, addDoc,
  onSnapshot, updateDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.2.0/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc",
  storageBucket: "paper-house-inc.firebasestorage.app",
  messagingSenderId: "658389836376",
  appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Telegram Web App
let USER_ID = "";
let TELEGRAM_USERNAME = "";
if (window.Telegram.WebApp) {
  const tgUser = Telegram.WebApp.initDataUnsafe.user;
  USER_ID = tgUser.id.toString();
  TELEGRAM_USERNAME = tgUser.username || "NoUsername";

  // Display username immediately
  document.getElementById("username").innerText = `👤 ${TELEGRAM_USERNAME}`;

  registerUser(USER_ID, TELEGRAM_USERNAME);
  listenUser(USER_ID);
} else {
  alert("Open inside Telegram Web App!");
}

// --- USER FUNCTIONS ---
async function registerUser(userId, username) {
  const userRef = doc(db, "users", userId);
  const docSnap = await getDoc(userRef);
  if (!docSnap.exists()) {
    await setDoc(userRef, {
      username: username,
      balance: 500000,
      createdAt: new Date()
    });
  } else {
    // Sync Telegram username if changed
    if (docSnap.data().username !== username) {
      await updateDoc(userRef, { username: username });
    }
  }
}

function listenUser(userId) {
  const userRef = doc(db, "users", userId);
  onSnapshot(userRef, (docSnap) => {
    const data = docSnap.data();
    if (!data) return;

    // Animate username
    const usernameEl = document.getElementById("username");
    if (usernameEl.innerText !== `👤 ${data.username}`) {
      usernameEl.classList.add("username-change");
      usernameEl.innerText = `👤 ${data.username}`;
      setTimeout(() => usernameEl.classList.remove("username-change"), 800);
    }

    // Animate balance
    const balanceEl = document.getElementById("balance");
    const oldBalance = parseInt(balanceEl.getAttribute("data-old") || "0");
    if (oldBalance !== data.balance) {
      animateValue(balanceEl, oldBalance, data.balance, 600);
      balanceEl.setAttribute("data-old", data.balance);
    }
  });
}

// Animate number for balance
function animateValue(element, start, end, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const value = Math.floor(progress * (end - start) + start);
    element.innerText = `Balance: ₱${value}`;
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      element.innerText = `Balance: ₱${end}`;
      element.classList.add("balance-change");
      setTimeout(() => element.classList.remove("balance-change"), 800);
    }
  };
  window.requestAnimationFrame(step);
}

// --- WITHDRAWAL ---
async function requestWithdrawal(userId) {
  const amount = parseInt(document.getElementById("withdrawAmount").value);
  const gcashNumber = document.getElementById("gcashNumber").value.trim();
  if (!amount || !gcashNumber) return alert("Enter valid amount & GCash number");

  const userRef = doc(db, "users", userId);
  const userSnap = await getDoc(userRef);
  const userBalance = userSnap.data().balance;

  if (amount > userBalance) return alert("Insufficient balance");

  await addDoc(collection(db, "withdrawals"), {
    userId,
    username: userSnap.data().username,
    amount,
    gcashNumber,
    status: "pending",
    requestedAt: new Date()
  });

  await updateDoc(userRef, { balance: userBalance - amount });
  alert("💰 Withdrawal requested! Waiting for approval.");
}

document.getElementById("withdrawBtn").addEventListener("click", () => requestWithdrawal(USER_ID));

// --- OWNER DASHBOARD ---
function ownerLogin() {
  const pass = document.getElementById("ownerPassword").value;
  if (pass !== "Propetas6") return alert("Incorrect password");
  alert("🔑 Owner logged in!");
  listenWithdrawals();
}

document.getElementById("ownerLoginBtn").addEventListener("click", ownerLogin);

function listenWithdrawals() {
  const q = query(collection(db, "withdrawals"), orderBy("requestedAt", "desc"));
  onSnapshot(q, (snapshot) => {
    const list = document.getElementById("withdrawalsList");
    list.innerHTML = "";
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const li = document.createElement("li");
      li.innerHTML = `
        <span>👤 ${data.username} - ₱${data.amount} - ${data.status}</span>
        ${data.status === "pending" ? `<button class="btn" onclick="markPaid('${docSnap.id}', '${data.userId}', ${data.amount})">✅ Mark Paid</button>` : ""}
      `;
      list.appendChild(li);
    });
  });
}

// Mark Paid
window.markPaid = async function(withdrawalId, userId, amount) {
  await updateDoc(doc(db, "withdrawals", withdrawalId), { status: "paid" });
  alert(`💸 Withdrawal ₱${amount} marked as PAID`);
}
