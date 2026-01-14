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
  }
}

function listenUser(userId) {
  const userRef = doc(db, "users", userId);
  onSnapshot(userRef, (docSnap) => {
    const data = docSnap.data();
    if (data) {
      document.getElementById("username").innerText = `👤 ${data.username}`;
      document.getElementById("balance").innerText = `Balance: ₱${data.balance}`;
    }
  });
}

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

// --- OWNER FUNCTIONS ---
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

// Mark withdrawal as paid
window.markPaid = async function(withdrawalId, userId, amount) {
  await updateDoc(doc(db, "withdrawals", withdrawalId), { status: "paid" });
  alert(`💸 Withdrawal ₱${amount} marked as PAID`);
}
