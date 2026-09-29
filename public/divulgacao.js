"use strict";
(() => {
  const button = document.getElementById("share-game");
  if (!button) return;
  const gameUrl = new URL("/", location.href).href;
  const originalLabel = button.innerHTML;
  function showCopied() {
    button.textContent = "LINK COPIADO ✓";
    setTimeout(() => { button.innerHTML = originalLabel; }, 2600);
  }
  button.addEventListener("click", async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Universe Z", text: "Venha jogar Universe Z comigo!", url: gameUrl });
        return;
      }
      await navigator.clipboard.writeText(gameUrl);
      showCopied();
    } catch (err) {
      if (err?.name === "AbortError") return;
      let copied = false;
      const field = document.createElement("textarea");
      field.value = gameUrl;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.append(field);
      try {
        field.select();
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      } finally {
        field.remove();
      }
      if (copied) showCopied();
      else {
        button.textContent = gameUrl;
        button.setAttribute("aria-label", `Endereço do jogo: ${gameUrl}`);
      }
    }
  });
})();
