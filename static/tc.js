document.getElementById("closeBtn").addEventListener("click", () => {
  // Tell parent (form.html) to close the modal overlay
  if (window.parent) {
    window.parent.postMessage("closeTC", "*");
  } else {
    window.close();
  }
});
