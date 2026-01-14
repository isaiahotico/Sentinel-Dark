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

let USERNAME = "";
let USER_DOC_ID = "";

// --- AUTO LOGIN IF USER EXISTS ---
const savedUsername = localStorage.getItem("miniBankUsername");
if (savedUsername) {
  USERNAME = savedUsername;
  USER_DOC_ID = savedUsername;
  showBankUI();
  listenUser(USER_DOC_ID);
} else {
  document.getElementById("usernameCard").style.display = "block";
}

// --- CREATE USER ACCOUNT ---
document.getElementById("createUsernameBtn").addEventListener("click", async () => {
  const usernameInput = document.getElementById("inputUsername").value.trim();
  if (!usernameInput) return alert("Enter a valid username");

  const createBtn = document.getElementById("createUsernameBtn");
  createBtn.disabled = true;
  createBtn.innerText = "⏳ Creating...";

  try {
    const userRef = doc(db, "users", usernameInput);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      alert("Username already taken");
      createBtn.disabled = false;
      createBtn.innerText = "✅ Create Account";
      return;
    }

    await setDoc(userRef, {
      username: usernameInput,
      balance: 500000,
      createdAt: new Date()
    });

    // Save locally for persistent login
    USERNAME = usernameInput;
    USER_DOC_ID = usernameInput;
    localStorage.setItem("miniBankUsername", USERNAME);

    showBankUI();
    listenUser(USER_DOC_ID);

  } catch (error) {
    console.error(error);
    alert("Error creating account. Please try again.");
  } finally {
    createBtn.disabled = false;
    createBtn.innerText = "✅ Create Account";
  }
});

// --- SHOW BANK UI FUNCTION ---
function showBankUI() {
  document.getElementById("usernameCard").style.display = "none";
  document.getElementById("bankCard").style.display = "block";
  document.getElementById("usernameDisplay").innerText = `👤 ${USERNAME}`;
  document.getElementById("balance").innerText = `Balance: ₱500000`;
  document.getElementById("balance").setAttribute("data-old", "500000");
}

// --- LISTEN USER DATA ---
function listenUser(docId) {
  const userRef = doc(db, "users", docId);
  onSnapshot(userRef, (docSnap) => {
    const data = docSnap.data();
    if (!data) return;

    // Animate username if changed
    const usernameEl = document.getElementById("usernameDisplay");
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

// --- BALANCE ANIMATION ---
function animateValue(element, start, end, duration) {
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const value = Math.floor(progress * (end - start) + start);
    element.innerText = `Balance: ₱${value}`;
    if (progress < 1) window.requestAnimationFrame(step);
    else {
      element.innerText = `Balance: ₱${end}`;
      element.classList.add("balance-change");
      setTimeout(() => element.classList.remove("balance-change"), 800);
    }
  };
  window.requestAnimationFrame(step);
}

// --- WITHDRAWAL ---
document.getElementById("withdrawBtn").addEventListener("click", async () => {
  const amount = parseInt(document.getElementById("withdrawAmount").value);
  const gcashNumber = document.getElementById("gcashNumber").value.trim();
  if (!amount || !gcashNumber) return alert("Enter valid amount & GCash number");

  try {
    const userRef = doc(db, "users", USER_DOC_ID);
    const userSnap = await getDoc(userRef);
    const userBalance = userSnap.data().balance;
    if (amount > userBalance) return alert("Insufficient balance");

    await addDoc(collection(db, "withdrawals"), {
      userId: USER_DOC_ID,
      username: USERNAME,
      amount,
      gcashNumber,
      status: "pending",
      requestedAt: new Date()
    });

    await updateDoc(userRef, { balance: userBalance - amount });
    alert("💰 Withdrawal requested! Waiting for approval.");

  } catch (error) {
    console.error(error);
    alert("Error processing withdrawal.");
  }
});

// --- OWNER DASHBOARD ---
document.getElementById("ownerLoginBtn").addEventListener("click", () => {
  const pass = document.getElementById("ownerPassword").value;
  if (pass !== "Propetas6") return alert("Incorrect password");
  alert("🔑 Owner logged in!");
  loadOwnerDashboard();
});

// --- OWNER DASHBOARD FUNCTION ---
function loadOwnerDashboard() {
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

// --- MARK PAID ---
window.markPaid = async function(withdrawalId, userId, amount) {
  try {
    await updateDoc(doc(db, "withdrawals", withdrawalId), { status: "paid" });
    alert(`💸 Withdrawal ₱${amount} marked as PAID`);
  } catch (error) {
    console.error(error);
    alert("Error updating status.");
  }
};
