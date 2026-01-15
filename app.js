import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc,
  updateDoc, addDoc, collection, onSnapshot,
  serverTimestamp, runTransaction, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
  authDomain: "paper-house-inc.firebaseapp.com",
  projectId: "paper-house-inc"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ELEMENTS */
const loginCard=document.getElementById("loginCard");
const loginBtn=document.getElementById("loginBtn");
const loginUsername=document.getElementById("loginUsername");
const usernameStatus=document.getElementById("usernameStatus");

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

/* ======== USERNAME LIVE CHECK ======= */
loginUsername.addEventListener("input",async()=>{
  const val=loginUsername.value.trim().toLowerCase();
  if(!val){ usernameStatus.innerText=""; return;}
  const snap=await getDoc(doc(db,"users",val));
  usernameStatus.innerText = snap.exists() ? "Username already exists ✅ Login" : "Username available 🟢 New registration";
  usernameStatus.className = snap.exists() ? "available" : "taken";
});

/* ================= LOGIN / REGISTER ================= */
loginBtn.addEventListener("click", async()=>{
  const input=loginUsername.value.trim().toLowerCase();
  if(!input) return alert("Enter username");

  const userDoc=doc(db,"users",input);
  const snap=await getDoc(userDoc);

  if(snap.exists()){ // login
    username=input;
    userRef=userDoc;
    localStorage.setItem("activeUser",username);
    showApp();
    return;
  }

  // new registration
  const referralCode=prompt("Referral code (optional)").trim().toLowerCase();
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
});

/* ================= SHOW APP ================= */
function showApp(){
  loginCard.classList.add("hidden");
  appCard.classList.remove("hidden");
  usernameEl.innerText=username;
  refCodeEl.innerText=username;
  userRef=doc(db,"users",username);

  listenBalance();
  listenWithdrawals();
  listenReferrals();
  updateLeaderboard();
}

/* ================= LOGOUT ================= */
logoutBtn.addEventListener("click",()=>{localStorage.removeItem("activeUser"); location.reload();});

/* ================= BALANCE ================= */
function listenBalance(){onSnapshot(userRef,snap=>{if(snap.exists()) balanceEl.innerText=snap.data().balance.toFixed(2);});}

/* ================= WITHDRAWALS ================= */
function listenWithdrawals(){
  onSnapshot(collection(db,"withdrawals"),snap=>{
    withdrawTable.innerHTML="";
    ownerTable.innerHTML="";
    snap.forEach(d=>{
      const w=d.data();
      const date=w.time?.toDate().toLocaleString()||"-";
      const badge=w.status==="PAID"?`<span class="badge paid">PAID</span>`:`<span class="badge pending">PENDING</span>`;
      if(w.username===username) withdrawTable.innerHTML+=`<tr><td>${date}</td><td>${w.username}</td><td>₱${w.amount}</td><td>${badge}</td></tr>`;
      const actionButtons=w.status==="PENDING"?`<button onclick="approve('${d.id}')">Approve</button><button onclick="deny('${d.id}')">Deny</button>`:"";
      ownerTable.innerHTML+=`<tr><td>${date}</td><td>${w.username}</td><td>₱${w.amount}</td><td>${badge}</td><td>${actionButtons}</td></tr>`;
    });
  });
}

/* ================= REFERRALS ================= */
toggleReferralBtn.addEventListener("click",()=>referralBox.classList.toggle("hidden"));
function listenReferrals(){
  onSnapshot(collection(db,"referrals"),snap=>{
    refTable.innerHTML="";
    let total=0;
    snap.forEach(d=>{
      const r=d.data();
      if(r.referrer===username){
        total++;
        const status=r.claimed?`<span class="badge paid">CLAIMED</span>`:`<span class="badge pending">UNCLAIMED</span>`;
        refTable.innerHTML+=`<tr><td>${r.invitee}</td><td>₱${r.withdrawAmount}</td><td>₱${r.bonus}</td><td>${status}</td></tr>`;
      }
    });
    refCountEl.innerText=total;
  });
}
claimReferralBtn.addEventListener("click", async()=>{
  const snap=await getDocs(collection(db,"referrals"));
  let totalBonus=0; const docs=[];
  snap.forEach(d=>{
    const r=d.data();
    if(r.referrer===username && !r.claimed){totalBonus+=r.bonus; docs.push(d.ref);}
  });
  if(totalBonus<=0) return alert("No bonus to claim");
  await runTransaction(db,async tx=>{
    const userSnap=await tx.get(userRef);
    tx.update(userRef,{balance:userSnap.data().balance+totalBonus});
    docs.forEach(ref=>tx.update(ref,{claimed:true}));
  });
  alert(`🎉 Referral bonus ₱${totalBonus} claimed`);
  updateLeaderboard();
});

/* ================= LEADERBOARD ================= */
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
  sorted.forEach(([user,bonus])=>leaderboardTable.innerHTML+=`<tr><td>${user}</td><td>₱${bonus.toFixed(2)}</td></tr>`);
}

/* ================= AD REWARD ================= */
async function reward(amount){await runTransaction(db,async tx=>{const snap=await tx.get(userRef); tx.update(userRef,{balance:snap.data().balance+amount});});}
dailyBtn.addEventListener("click",()=>show_10276123().then(()=>reward(0.02).then(()=>alert("🎉 0.02 earned"))));
adsBtn.addEventListener("click",()=>show_10276123("pop").then(()=>reward(0.04).then(()=>alert("🎉 0.04 earned"))));

/* ================= WITHDRAW ================= */
withdrawBtn.addEventListener("click",async()=>{
  const snap=await getDoc(userRef);
  const amount=snap.data().balance;
  if(amount<=0) return alert("No balance");
  const referrer=snap.data().referrer;
  await addDoc(collection(db,"withdrawals"),{username,amount,status:"PENDING",time:serverTimestamp()});
  await updateDoc(userRef,{balance:0});
  if(referrer){
    const bonus=+(amount*0.10).toFixed(2);
    await addDoc(collection(db,"referrals"),{referrer,invitee:username,withdrawAmount:amount,bonus,claimed:false,time:serverTimestamp()});
  }
  updateLeaderboard();
});

/* ================= OWNER DASHBOARD ================= */
ownerBtn.addEventListener("click",()=>{if(prompt("Owner password")==="Propetas6") ownerDiv.classList.remove("hidden");});
window.approve=async(id)=>{await updateDoc(doc(db,"withdrawals",id),{status:"PAID"});};
window.deny=async(id)=>{const wRef=doc(db,"withdrawals",id); const wSnap=await getDoc(wRef); if(!wSnap.exists()) return; await runTransaction(db,async tx=>{tx.update(doc(db,"users",wSnap.data().username),{balance:wSnap.data().amount}); tx.update(wRef,{status:"DENIED"});});};

/* ================= INIT ================= */
if(username) showApp();
