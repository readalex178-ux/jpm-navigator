import confetti from "canvas-confetti";

/** Celebration burst for "Call Booked" wins. */
export function celebrateWin() {
  if (typeof window === "undefined") return;
  const end = Date.now() + 700;
  const colors = ["#fde68a", "#60a5fa", "#a78bfa", "#34d399"];
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({
    particleCount: 80,
    spread: 100,
    startVelocity: 38,
    origin: { x: 0.5, y: 0.5 },
    colors,
  });
}
