import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, addDoc, collection,
  onSnapshot, serverTimestamp, runTransaction, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ===== ELEMENTS ===== */
const loginCard=document.getElementById("loginCard");
const loginBtn=document.getElementById("loginBtn");
const loginUsername=document.getElementById("loginUsername");

const appCard=document.getElementById("appCard");
const logoutBtn=document.getElementById("logoutBtn");
const balanceEl=document.getElementById("balance");
const usernameEl=document.getElementById("username");

const dailyBtn=document.getElementById("dailyBtn");
const adsBtn=document.getElementById("adsBtn");
const withdrawBtn=document.getElementById("withdrawBtn");
const gcashInput=document.getElementById("gcash");

const withdrawTable=document.getElementById("withdrawTable");
const ownerTable=document.getElementById("ownerTable");

const refCodeEl=document.getElementById("refCode");
const refCountEl=document.getElementById("refCount");
const refTable=document.getElementById("refTable");
const referralBox=document.getElementById("referralBox");
const toggleReferralBtn=document.getElementById("toggleReferralBtn");
const claimReferralBtn=document.getElementById("claimReferralBtn");

const leaderboardTable=document.getElementById("leaderboardTable");

const ownerBtn=document.getElementById("ownerBtn");
const ownerDiv=document.getElementById("owner");

let username=localStorage.getItem("activeUser");
let userRef=null;

/* ===== LOGIN / REGISTER ===== */
loginBtn.addEventListener("click", async () => {
  const input = loginUsername.value.trim().toLowerCase();
  if (!input) return alert("Enter username");

  loginBtn.disabled=true;
  try {
    const userDoc = doc(db,"users",input);
    const snap = await getDoc(userDoc);

    if (snap.exists()) {
      // User exists → login
      username = input;
      userRef = userDoc;
      localStorage.setItem("activeUser", username);
      showApp();
      return;
    }

    // New user registration
    const referralCode = (prompt("Referral code (optional)")||"").trim().toLowerCase();
    if(referralCode===input) return alert("Cannot refer yourself");

    username=input;
    userRef=userDoc;
    await setDoc(userRef,{
      username,
      balance:0,
      referralBonus:0,
      referrer:referralCode||null,
      createdAt:serverTimestamp()
    });
    localStorage.setItem("activeUser",username);
    showApp();

  } catch(e){console.error(e); alert("Error: "+e);}
  finally { loginBtn.disabled=false; }
});

/* ===== SHOW APP ===== */
function showApp(){
  if(!userRef) return alert("User not initialized");
  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  usernameEl.innerText=username;
  refCodeEl.innerText=username;

  // Buttons
  dailyBtn.onclick = ()=> show_10276123().then(()=> reward(0.02).then(()=>alert("🎉 0.02 earned")));
  adsBtn.onclick = ()=> show_10276123("pop").then(()=> reward(0.04).then(()=>alert("🎉 0.04 earned")));
  withdrawBtn.onclick = safeWithdraw;
  toggleReferralBtn.onclick = ()=> referralBox.classList.toggle("hidden");
  claimReferralBtn.onclick = claimReferralBonus;
  logoutBtn.onclick = ()=> { localStorage.removeItem("activeUser"); location.reload(); };

  listenBalance();
  listenWithdrawals();
  listenReferrals();
  updateLeaderboard();
}

/* ===== BALANCE ===== */
function listenBalance(){
  onSnapshot(userRef, snap=>{
    if(snap.exists()) balanceEl.innerText=Number(snap.data().balance||0).toFixed(2);
  });
}
async function reward(amount){
  await runTransaction(db, async tx=>{
    const snap=await tx.get(userRef);
    tx.update(userRef,{ balance:(snap.data().balance||0)+amount });
  });
}

/* ===== WITHDRAWALS ===== */
async function safeWithdraw(){
  const gcash=gcashInput.value.trim();
  if(!gcash) return alert("Enter GCash number");

  try{
    await runTransaction(db, async tx=>{
      const uSnap=await tx.get(userRef);
      const amount=uSnap.data().balance||0;
      if(amount<=0) throw "No balance";

      await addDoc(collection(db,"withdrawals"),{
        username,
        amount,
        gcash,
        status:"PENDING",
        time:serverTimestamp()
      });
      tx.update(userRef,{ balance:0 });

      const referrer=uSnap.data().referrer;
      if(referrer){
        const bonus=+(amount*0.10).toFixed(2);
        await addDoc(collection(db,"referrals"),{
          referrer,
          invitee:username,
          withdrawAmount:amount,
          bonus,
          claimed:false,
          time:serverTimestamp()
        });
      }
    });
    alert("Withdrawal requested!");
  }catch(e){console.error(e); alert("Failed: "+e);}
}

/* ===== OWNER DASHBOARD ===== */
ownerBtn.addEventListener("click", async ()=>{
  const pass=prompt("Enter owner password:");
  if(!pass) return;
  try{
    const ownerSnap=await getDoc(doc(db,"owners","admin"));
    if(!ownerSnap.exists()) return alert("Owner not found");
    if(ownerSnap.data().password!==pass) return alert("Wrong password");
    ownerDiv.classList.toggle("hidden");
    alert("Owner access granted ✅");
  }catch(e){console.error(e); alert("Error: "+e);}
});

window.approve=async(withdrawId)=>{
  try{
    const wRef=doc(db,"withdrawals",withdrawId);
    const ownerSnap=await getDoc(doc(db,"owners","admin"));
    if(!ownerSnap.exists()) throw "Owner not found";

    await runTransaction(db, async tx=>{
      const wSnap=await tx.get(wRef);
      if(!wSnap.exists()) throw "Not found";
      if(wSnap.data().status!=="PENDING") throw "Already processed";
      tx.update(wRef,{ status:"PAID" });
    });
    alert("Withdrawal approved ✅");
  }catch(e){console.error(e); alert("Failed: "+e);}
};

window.deny=async(withdrawId)=>{
  try{
    const wRef=doc(db,"withdrawals",withdrawId);
    const ownerSnap=await getDoc(doc(db,"owners","admin"));
    if(!ownerSnap.exists()) throw "Owner not found";

    await runTransaction(db, async tx=>{
      const wSnap=await tx.get(wRef);
      if(!wSnap.exists()) throw "Not found";
      if(wSnap.data().status!=="PENDING") throw "Already processed";

      const uname=wSnap.data().username;
      const amt=wSnap.data().amount||0;
      const uRef=doc(db,"users",uname);
      const uSnap=await tx.get(uRef);
      if(!uSnap.exists()) throw "User not found";

      tx.update(uRef,{ balance:(uSnap.data().balance||0)+amt });
      tx.update(wRef,{ status:"DENIED" });
    });
    alert("Withdrawal denied & refunded ✅");
  }catch(e){console.error(e); alert("Failed: "+e);}
};

/* ===== REFERRALS ===== */
function listenReferrals(){
  onSnapshot(collection(db,"referrals"), snap=>{
    refTable.innerHTML=""; let total=0;
    snap.forEach(d=>{
      const r=d.data();
      if(r.referrer===username){
        total++;
        const status=r.claimed?`<span class="badge paid">CLAIMED</span>`:`<span class="badge pending">UNCLAIMED</span>`;
        refTable.innerHTML+=`<tr><td>${r.invitee}</td><td>₱${Number(r.withdrawAmount).toFixed(2)}</td><td>₱${Number(r.bonus).toFixed(2)}</td><td>${status}</td></tr>`;
      }
    });
    refCountEl.innerText=total;
  });
}
async function claimReferralBonus(){
  const snap=await getDocs(collection(db,"referrals"));
  let totalBonus=0; const docs=[];
  snap.forEach(d=>{
    const r=d.data();
    if(r.referrer===username && !r.claimed){ totalBonus+=r.bonus; docs.push(d.ref); }
  });
  if(totalBonus<=0) return alert("No bonus");
  await runTransaction(db, async tx=>{
    const uSnap=await tx.get(userRef);
    tx.update(userRef,{ balance:(uSnap.data().balance||0)+totalBonus });
    docs.forEach(ref=>tx.update(ref,{ claimed:true }));
  });
  alert(`🎉 Bonus ₱${totalBonus.toFixed(2)} claimed`);
  updateLeaderboard();
}

/* ===== LEADERBOARD ===== */
async function updateLeaderboard(){
  const snap=await getDocs(collection(db,"referrals"));
  const leaderboard={};
  snap.forEach(d=>{
    const r=d.data();
    if(!r.claimed) return;
    leaderboard[r.referrer]=(leaderboard[r.referrer]||0)+r.bonus;
  });
  const sorted=Object.entries(leaderboard).sort((a,b)=>b[1]-a[1]);
  leaderboardTable.innerHTML="";
  sorted.forEach(([user,bonus])=>leaderboardTable.innerHTML+=`<tr><td>${user}</td><td>₱${Number(bonus).toFixed(2)}</td></tr>`);
}

/* ===== INIT ===== */
if(username) {
  userRef=doc(db,"users",username);
  showApp();
}
