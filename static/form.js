const nameEl = document.getElementById("name");
const ageEl = document.getElementById("age");
const sexEl = document.getElementById("sex");
const acceptEl = document.getElementById("accept");
const proceedBtn = document.getElementById("proceedBtn");
const form = document.getElementById("intakeForm");

const nameError = document.getElementById("nameError");
const ageError = document.getElementById("ageError");
const sexError = document.getElementById("sexError");
const acceptError = document.getElementById("acceptError");

const tcModal = document.getElementById("tcModal");
const openTcLink = document.getElementById("openTcLink");

function sanitizeName(value) {
  // Keep letters and spaces only (also supports common name punctuation? user asked characters only, so strict)
  return value.replace(/[^A-Za-z\s]/g, "").replace(/\s+/g, " ").trimStart();
}

function isValidName(value) {
  // At least 2 chars, letters/spaces only
  return /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/.test(value) && value.length >= 2;
}

function isValidAge(value) {
  if (value === "" || value == null) return false;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 120;
}

function isValidSex(value) {
  return value === "Male" || value === "Female";
}

function updateErrors() {
  const nameVal = nameEl.value.trim();
  const ageVal = ageEl.value;
  const sexVal = sexEl.value;
  const acceptVal = acceptEl.checked;

  nameError.style.display = nameVal === "" ? "none" : (isValidName(nameVal) ? "none" : "block");
  ageError.style.display = ageVal === "" ? "none" : (isValidAge(ageVal) ? "none" : "block");
  sexError.style.display = sexVal === "" ? "none" : (isValidSex(sexVal) ? "none" : "block");
  acceptError.style.display = acceptVal ? "none" : "block";
}

function canProceed() {
  const nameVal = nameEl.value.trim();
  return (
    isValidName(nameVal) &&
    isValidAge(ageEl.value) &&
    isValidSex(sexEl.value) &&
    acceptEl.checked
  );
}

function updateProceedButton() {
  proceedBtn.disabled = !canProceed();
}

// Live input rules
nameEl.addEventListener("input", (e) => {
  const cleaned = sanitizeName(e.target.value);
  if (cleaned !== e.target.value) e.target.value = cleaned;
  updateErrors();
  updateProceedButton();
});

ageEl.addEventListener("input", () => {
  // type=number already restricts most, still validate range
  updateErrors();
  updateProceedButton();
});

sexEl.addEventListener("change", () => {
  updateErrors();
  updateProceedButton();
});

acceptEl.addEventListener("change", () => {
  updateErrors();
  updateProceedButton();
});

// Terms modal: open link as popup overlay (prevent navigation)
openTcLink.addEventListener("click", (e) => {
  e.preventDefault();
  tcModal.style.display = "flex";
  tcModal.setAttribute("aria-hidden", "false");
});

// Close modal if click outside the dialog
tcModal.addEventListener("click", (e) => {
  if (e.target === tcModal) {
    tcModal.style.display = "none";
    tcModal.setAttribute("aria-hidden", "true");
  }
});

// Listen for postMessage from tc.html close button
window.addEventListener("message", (event) => {
  if (event && event.data === "closeTC") {
    tcModal.style.display = "none";
    tcModal.setAttribute("aria-hidden", "true");
  }
});

// Submit handler (frontend only placeholder)
form.addEventListener("submit", (e) => {
  e.preventDefault();
  updateErrors();
  updateProceedButton();

  if (!canProceed()) return;

  // For now just show data (later you’ll POST to backend that talks to MedGemma)
  const payload = {
    name: nameEl.value.trim(),
    age: Number(ageEl.value),
    sex: sexEl.value,
    acceptedTerms: acceptEl.checked
  };

  alert("Proceeding with:\n" + JSON.stringify(payload, null, 2));
});
