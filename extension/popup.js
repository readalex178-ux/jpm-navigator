const codeEl = document.getElementById("code");
const btn = document.getElementById("save");
const status = document.getElementById("status");

chrome.runtime.sendMessage({ kind: "get:pairing" }, (resp) => {
  if (resp && resp.code) {
    codeEl.value = resp.code;
    status.innerHTML = '<span class="ok">Paired ✓</span> code ' + resp.code;
  }
});

btn.addEventListener("click", () => {
  const code = (codeEl.value || "").trim().toUpperCase();
  if (code.length < 4) {
    status.textContent = "Enter the 6-character code from the app.";
    return;
  }
  chrome.runtime.sendMessage({ kind: "save:pairing", code }, (resp) => {
    if (resp && resp.ok) {
      status.innerHTML = '<span class="ok">Paired ✓</span> code ' + code;
    }
  });
});

codeEl.addEventListener("input", () => {
  codeEl.value = codeEl.value.toUpperCase();
});
