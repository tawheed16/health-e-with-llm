const refIdEl = document.getElementById("refId");
const viewBtn = document.getElementById("viewBtn");
const statusEl = document.getElementById("status");

// auto-fill if coming from ?ref=...
const params = new URLSearchParams(window.location.search);
const ref = params.get("ref");
if (ref) refIdEl.value = ref;

function normRef(s) {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
}

refIdEl.addEventListener("input", (e) => {
  const cleaned = normRef(e.target.value);
  if (cleaned !== e.target.value) e.target.value = cleaned;
});

viewBtn.addEventListener("click", async () => {
  const refId = normRef(refIdEl.value);
  if (refId.length !== 20) {
    statusEl.textContent = "Please enter a valid 20-character Ref ID.";
    return;
  }
  statusEl.textContent = "Opening report...";
  window.open(`/api/report/${refId}.pdf`, "_blank");
});
