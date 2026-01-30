// static/form.js

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
  // Keep letters and spaces only (strict)
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

// Helper: safe JSON parse (for error messages)
async function safeReadJson(res) {
  try {
    return await res.json();
  } catch (_) {
    return null;
  }
}

// Helper: set loading UI
function setLoading(isLoading) {
  if (isLoading) {
    proceedBtn.disabled = true;
    proceedBtn.dataset.originalText = proceedBtn.textContent;
    proceedBtn.textContent = "Submitting...";
  } else {
    proceedBtn.disabled = !canProceed();
    proceedBtn.textContent = proceedBtn.dataset.originalText || "Proceed";
  }
}

// Live input rules
nameEl.addEventListener("input", (e) => {
  const cleaned = sanitizeName(e.target.value);
  if (cleaned !== e.target.value) e.target.value = cleaned;
  updateErrors();
  updateProceedButton();
});

ageEl.addEventListener("input", () => {
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

// Submit handler (now calls backend to create Ref ID + PDF)
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  updateErrors();
  updateProceedButton();

  if (!canProceed()) return;

  const payload = {
    name: nameEl.value.trim(),
    age: Number(ageEl.value),
    sex: sexEl.value,
    acceptedTerms: acceptEl.checked,
  };

  try {
    setLoading(true);

    const res = await fetch("/api/intake/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await safeReadJson(res);

    if (!res.ok) {
      const msg = (data && (data.detail || data.message)) || `Submission failed (${res.status})`;
      throw new Error(msg);
    }

    // Expected response: { ref_id, report_pdf_url }
    const refId = data?.ref_id;
    const pdfUrl = data?.report_pdf_url;

    if (!refId) throw new Error("Server did not return a reference ID.");

    // Option A: simple alert + optional redirect
    alert(
      "✅ Submitted!\n\n" +
      "Reference ID (give to doctor): " + refId + "\n" +
      (pdfUrl ? ("PDF: " + pdfUrl + "\n") : "")
    );

    // OPTIONAL: Auto-open PDF in new tab
    // if (pdfUrl) window.open(pdfUrl, "_blank");

    // OPTIONAL: redirect to your doctor dashboard (if you add it)
    // window.location.href = "/static/dashboard.html?ref=" + encodeURIComponent(refId);

  } catch (err) {
    alert("❌ " + (err?.message || "Something went wrong"));
  } finally {
    setLoading(false);
  }
});
