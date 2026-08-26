import { effect } from "./reactive.js";

/** Classic 5x7 LED dot-matrix digit patterns, rows top-to-bottom, "1" = lit dot. */
const DIGITS: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
};

/** Renders one digit (0-9) as a 5x7 grid of dots. */
export function dotDigit(char: string, dotSize = 5): HTMLElement {
  const pattern = DIGITS[char] ?? DIGITS["0"]!;
  const grid = document.createElement("div");
  grid.className = "dot-digit";
  grid.style.gridTemplateColumns = `repeat(5, ${dotSize}px)`;
  grid.style.gridTemplateRows = `repeat(7, ${dotSize}px)`;
  grid.style.gap = `${Math.max(2, Math.round(dotSize * 0.4))}px`;
  for (const row of pattern) {
    for (const cell of row) {
      const dot = document.createElement("span");
      dot.className = cell === "1" ? "dot lit" : "dot";
      dot.style.width = `${dotSize}px`;
      dot.style.height = `${dotSize}px`;
      grid.appendChild(dot);
    }
  }
  return grid;
}

/** Renders a small 1-wide x 7-tall colon between digit groups (dots lit at rows 2 and 4). */
export function dotColon(dotSize = 5): HTMLElement {
  const grid = document.createElement("div");
  grid.className = "dot-colon";
  grid.style.gridTemplateRows = `repeat(7, ${dotSize}px)`;
  grid.style.gap = `${Math.max(2, Math.round(dotSize * 0.4))}px`;
  for (let i = 0; i < 7; i++) {
    const dot = document.createElement("span");
    dot.className = i === 2 || i === 4 ? "dot lit" : "dot";
    dot.style.width = `${dotSize}px`;
    dot.style.height = `${dotSize}px`;
    grid.appendChild(dot);
  }
  return grid;
}

/** Wraps `dotDigit` so it re-renders whenever the reactive `char` source changes. */
export function reactiveDotDigit(char: () => string, dotSize = 5): HTMLElement {
  const container = document.createElement("div");
  container.style.display = "contents";
  effect(() => {
    container.replaceChildren(dotDigit(char(), dotSize));
  });
  return container;
}
