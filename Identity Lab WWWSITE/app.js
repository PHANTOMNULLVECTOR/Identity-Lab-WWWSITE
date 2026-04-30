/* =========================================
   1. CONFIGURATION & INITIALIZATION
   ========================================= */

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAaFngFh2m0LAU9CyejpM_uvw4vzhjMp10",
  authDomain: "identity-lab-4f2c5.firebaseapp.com",
  projectId: "identity-lab-4f2c5",
  messagingSenderId: "98434827057",
  appId: "1:98434827057:web:da2fd6fa174c0b7abf6610"
};

// INIT FIREBASE
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore(); // Initialized, though not used in current logic

function testDatabase() {
  const user = firebase.auth().currentUser;
  
  if (!user) {
    console.log("Not logged in. Cannot test database.");
    return;
  }
  
  db.collection("users").doc(user.uid).set({
    email: user.email,
    created_at: new Date().toISOString(),
    test: "Database is working!"
  })
  .then(() => {
    console.log("✅ Database test PASSED! Data saved.");
  })
  .catch((error) => {
    console.log("❌ Database test FAILED:", error);
  });
}

// INIT EMAILJS
(function() {
  emailjs.init("MVEzmgzooFoETwUHc"); // replace with your real key if this is a placeholder
})();

/* =========================================
   2. STATE HELPERS (Payment Status)
   ========================================= */

// Helper to store payment status (Default: 'none', 'pending', 'approved')
function getPaymentStatus() {
  return localStorage.getItem("payment_status") || "none";
}

function setPaymentStatus(status) {
  localStorage.setItem("payment_status", status);
  updatePaymentUI();
}

/* =========================================
   3. MODAL FUNCTIONS
   ========================================= */

function openModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("authModal");
  if (modal) modal.style.display = "none";
}

/* =========================================
   4. AUTHENTICATION LOGIC
   ========================================= */

let isLogin = true;

function toggleAuth() {
  isLogin = !isLogin;
  const title = document.getElementById("authTitle");
  if (title) title.innerText = isLogin ? "Login" : "Sign Up";
}

function login() {
  const emailInput = document.getElementById("email");
  const passInput = document.getElementById("password");
  
  if (!emailInput || !passInput) {
    console.error("Email or Password input not found");
    return;
  }

  const email = emailInput.value;
  const password = passInput.value;

  if (isLogin) {
    auth.signInWithEmailAndPassword(email, password)
      .then(() => closeModal())
      .catch(err => handleAuthError(err));
  } else {
    auth.createUserWithEmailAndPassword(email, password)
      .then(() => closeModal())
      .catch(err => handleAuthError(err));
  }
}

function logout() {
  auth.signOut();
}

function handleAuthError(err) {
  console.error(err); // Log real error for debugging
  let message = "Something went wrong";

  switch (err.code) {
    case "auth/user-not-found":
      message = "Email not found";
      break;
    case "auth/wrong-password":
      message = "Wrong password";
      break;
    case "auth/invalid-email":
      message = "Invalid email format";
      break;
    case "auth/email-already-in-use":
      message = "Email already in use";
      break;
    case "auth/weak-password":
      message = "Password should be at least 6 characters";
      break;
    default:
      message = "Wrong email or password";
  }
  alert(message);
}

/* =========================================
   5. IMAGE HANDLING & COMPRESSION
   ========================================= */

const screenshotInput = document.getElementById("paymentScreenshot");
const previewImage = document.getElementById("previewImage");

// Live Preview Listener
if (screenshotInput) {
  screenshotInput.addEventListener("change", () => {
    const file = screenshotInput.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        previewImage.src = e.target.result;
        previewImage.style.display = "block";
      };
      reader.readAsDataURL(file);
    }
  });
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = function(event) {
      const img = new Image();

      img.onload = function() {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        let width = img.width;
        let height = img.height;

        const MAX_WIDTH = 500;

        if (width > MAX_WIDTH) {
          height = height * (MAX_WIDTH / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG at 35% quality
        const compressed = canvas.toDataURL("image/jpeg", 0.35);
        resolve(compressed);
      };

      img.onerror = reject;
      img.src = event.target.result;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* =========================================
   6. PAYMENT FORM SUBMISSION
   ========================================= */

const paymentForm = document.querySelector(".payment-form");

if (paymentForm) {
  paymentForm.addEventListener("submit", function(e) {
    e.preventDefault();

    const name = paymentForm.querySelector("input[type='text']").value;
    const email = paymentForm.querySelector("input[type='email']").value;
    const phone = paymentForm.querySelector("input[type='tel']").value;
    const code = document.getElementById("mpesaCode").value;
    const file = document.getElementById("paymentScreenshot").files[0];

    // 1. Check File Existence
    if (!file) {
      alert("Please upload your payment screenshot");
      return;
    }

    // 2. Check File Size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert("Image too large. Please upload a smaller image.");
      return;
    }

    // 3. Validation Checks
    if (!/^07\d{8}$/.test(phone)) {
      alert("Enter a valid Kenyan phone number (07XXXXXXXX)");
      return;
    }

    if (!/^[A-Z0-9]{8,10}$/.test(code)) {
      alert("Enter a valid M-Pesa transaction code");
      return;
    }

    // 4. Process & Send
    compressImage(file)
      .then((base64) => {
        return emailjs.send("service_9bn2nfs", "template_hiv4dph", {
          name: name,
          email: email,
          phone: phone,
          code: code,
          screenshot: base64,
          reply_to: email
        });
      })
            .then(() => {
        setPaymentStatus("pending");
        paymentForm.reset();
        previewImage.style.display = "none";

        var popup = document.getElementById("paymentSuccessModal");
        if (popup) {
          popup.style.display = "flex";
        }
      })
      .catch((error) => {
        console.log("FULL ERROR:", error);
        alert("Failed: " + JSON.stringify(error));
      });
  });
}

// Input Uppercase Formatter
const codeInput = document.getElementById("mpesaCode");
if (codeInput) {
  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.toUpperCase();
  });
}

/* =========================================
   7. UI & NAVIGATION UPDATES
   ========================================= */

function updatePaymentUI() {
  const box = document.getElementById("paymentStatusBox");
  if (!box) return;

  const status = getPaymentStatus();

  if (status === "pending") {
    box.innerHTML = "⏳ Payment submitted. Waiting for admin confirmation.";
    box.style.color = "orange";
  } else if (status === "approved") {
    box.innerHTML = "✅ Payment confirmed. You now have access!";
    box.style.color = "lightgreen";
  } else {
    box.innerHTML = "⚠️ You must complete payment to access the Main Lab.";
    box.style.color = "red";
  }
}

function updateNavbar(user) {
  const nav = document.querySelector(".nav-container");
  if (!nav) return;

  nav.innerHTML = `
    <img src="logo-Photoroom.png" class="logo">

    <div class="nav-links" id="navLinks">
      <a href="index.html">Home</a>
      <a href="process.html" onclick="goToProcess(event)">Process</a>
      <a href="about.html">About</a>
      <a href="access.html">Learn Now</a>
    </div>

    <div class="menu-toggle" onclick="toggleMenu()">
      <i class="ri-menu-line"></i>
    </div>

    ${
      user
        ? `
      <div class="user-box">
        <div class="avatar-wrapper" onclick="toggleDropdown()">
          ${
            user.photoURL
              ? `<img src="${user.photoURL}" class="avatar">`
              : `<div class="avatar-fallback"><i class="ri-user-line"></i></div>`
          }
        </div>
        <div class="dropdown" id="userDropdown">
          <button onclick="logout()">Logout</button>
        </div>
      </div>
      `
        : `
      <button class="btn-secondary" onclick="openModal()">Login</button>
      `
    }
  `;
}

/* =========================================
   8. EVENT LISTENERS & PAGE PROTECTION
   ========================================= */

// Auth State Listener (Updates Navbar automatically)
auth.onAuthStateChanged(user => {
  updateNavbar(user);
  checkProcessPageAccess(user);
});

function toggleDropdown() {
  const dropdown = document.getElementById("userDropdown");
  if (dropdown) dropdown.classList.toggle("show");
}

// Close dropdown when clicking outside
document.addEventListener("click", function(e) {
  const userBox = document.querySelector(".user-box");
  const dropdown = document.getElementById("userDropdown");

  if (userBox && dropdown && !userBox.contains(e.target)) {
    dropdown.classList.remove("show");
  }
});

function toggleMenu() {
  const navLinks = document.getElementById("navLinks");
  if (navLinks) navLinks.classList.toggle("active");
  
  // Optional: handle overlay if you have one
  const overlay = document.getElementById("menuOverlay");
  if (overlay) overlay.classList.toggle("active");
}

document.addEventListener("click", function(e) {
  const navLinks = document.getElementById("navLinks");
  const menuBtn = document.querySelector(".menu-toggle");

  if (
    navLinks &&
    menuBtn &&
    navLinks.classList.contains("active") &&
    !navLinks.contains(e.target) &&
    !menuBtn.contains(e.target)
  ) {
    navLinks.classList.remove("active");
  }
});

function goToProcess(e) {
  if (e) e.preventDefault();
  const user = firebase.auth().currentUser;
  if (!user) {
    openModal();
  } else {
    window.location.href = "process.html";
  }
}

// Protect Process Page
function checkProcessPageAccess(user) {
  const locked = document.getElementById("lockedMessage");
  const content = document.getElementById("processContent");
  const payment = document.getElementById("paymentSection");
  const contact = document.getElementById("contactSection");
  const value = document.getElementById("valueSection");

  // Only run if we are on the process page (check if elements exist)
  if (!locked) return;

  if (user) {
    locked.style.display = "none";
    content.style.display = "block";
    payment.style.display = "block";
    contact.style.display = "block";
    value.style.display = "block";
  } else {
    locked.style.display = "block";
    content.style.display = "none";
    payment.style.display = "none";
    contact.style.display = "none";
    value.style.display = "none";
  }
}

/* =========================================
   9. INITIAL STARTUP
   ========================================= */

// Ensure UI is correct on load
updatePaymentUI();  


/* =========================================
   10. SCROLL REVEAL ANIMATION
   ========================================= */

const revealElements = document.querySelectorAll('.reveal');

if (revealElements.length > 0) {
  const revealObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
      }
    });
  }, {
    threshold: 0.15
  });

  revealElements.forEach(function(el) {
    revealObserver.observe(el);
  });
}