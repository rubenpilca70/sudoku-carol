let board = [];
let solution = [];
let initialBoard = [];
let selectedRow = -1;
let selectedCol = -1;
let selectedNum = null;
let lives = 3;
let hintsLeft = 3;
let timerInterval = null;
let seconds = 0;
let gameOver = false;
let paused = false;
let difficulty = 'medium';
const DIFFICULTY = {
  easy: { cellsToRemove: 30, hints: 5 },
  medium: { cellsToRemove: 45, hints: 3 },
  hard: { cellsToRemove: 52, hints: 2 },
  expert: { cellsToRemove: 58, hints: 1 }
};

function saveScore(time, diff) {
  try {
    const key = `sudoku_scores_${diff}`;
    const scores = JSON.parse(localStorage.getItem(key) || '[]');
    scores.push({ time, date: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(scores));
    const best = Math.min(...scores.map(s => s.time));
    return best;
  } catch (e) {
    return time;
  }
}

function getBestScore(diff) {
  try {
    const key = `sudoku_scores_${diff}`;
    const scores = JSON.parse(localStorage.getItem(key) || '[]');
    if (scores.length === 0) return null;
    return Math.min(...scores.map(s => s.time));
  } catch (e) {
    return null;
  }
}

function generateSolvedBoard() {
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const grid = Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => ((r * 3 + Math.floor(r / 3) + c) % 9 + 1))
  );

  const nums = shuffle([1,2,3,4,5,6,7,8,9]);
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      grid[r][c] = nums[grid[r][c] - 1];

  for (let band = 0; band < 3; band++) {
    const rows = [band * 3, band * 3 + 1, band * 3 + 2];
    shuffle(rows);
    const copy = rows.map(r => [...grid[r]]);
    for (let i = 0; i < 3; i++)
      grid[band * 3 + i] = copy[i];
  }

  for (let stack = 0; stack < 3; stack++) {
    const cols = [stack * 3, stack * 3 + 1, stack * 3 + 2];
    shuffle(cols);
    for (let r = 0; r < 9; r++) {
      const copy = cols.map(c => grid[r][c]);
      for (let i = 0; i < 3; i++)
        grid[r][stack * 3 + i] = copy[i];
    }
  }

  const bandOrder = shuffle([0, 1, 2]);
  const bands = [];
  for (let b = 0; b < 3; b++)
    bands.push(grid.slice(b * 3, b * 3 + 3).map(row => [...row]));
  for (let b = 0; b < 3; b++)
    for (let r = 0; r < 3; r++)
      grid[b * 3 + r] = bands[bandOrder[b]][r];

  const stackOrder = shuffle([0, 1, 2]);
  for (let r = 0; r < 9; r++) {
    const stacks = [];
    for (let s = 0; s < 3; s++)
      stacks.push(grid[r].slice(s * 3, s * 3 + 3));
    for (let s = 0; s < 3; s++)
      for (let c = 0; c < 3; c++)
        grid[r][s * 3 + c] = stacks[stackOrder[s]][c];
  }

  return grid;
}

function createPuzzle(solved) {
  const puzzle = solved.map(row => [...row]);
  const config = DIFFICULTY[difficulty];
  let removed = 0;
  const positions = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      positions.push([r, c]);

  shuffleArray(positions);

  for (const [r, c] of positions) {
    if (removed >= config.cellsToRemove) break;
    puzzle[r][c] = 0;
    removed++;
  }

  return puzzle;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function initGame() {
  solution = generateSolvedBoard();
  const puzzle = createPuzzle(solution);
  board = puzzle.map(row => [...row]);
  initialBoard = puzzle.map(row => [...row]);
  selectedRow = -1;
  selectedCol = -1;
  selectedNum = null;
  lives = 3;
  gameOver = false;
  paused = false;
  hintsLeft = DIFFICULTY[difficulty].hints;
  seconds = 0;

  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!paused && !gameOver) {
      seconds++;
      updateTimer();
    }
  }, 1000);

  updateUI();
  renderBoard();
  renderNumPad();
  updateStatus();
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('pause-btn').textContent = '⏸ Pausa';
}

function renderBoard() {
  const table = document.getElementById('board');
  table.innerHTML = '';

  for (let r = 0; r < 9; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < 9; c++) {
      const td = document.createElement('td');
      td.dataset.row = r;
      td.dataset.col = c;

      const div = document.createElement('div');
      div.className = 'cell-content';

      if (board[r][c] !== 0) {
        div.textContent = board[r][c];
        if (initialBoard[r][c] !== 0) {
          td.classList.add('given');
        } else {
          td.classList.add('player');
        }
      }

      td.appendChild(div);
      td.addEventListener('click', () => onCellClick(r, c));
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
}

function getNumberCount(n) {
  let count = 0;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === n) count++;
  return count;
}

function renderNumPad() {
  const pad = document.getElementById('num-pad');
  pad.innerHTML = '';

  for (let n = 1; n <= 9; n++) {
    const count = getNumberCount(n);
    const remaining = 9 - count;

    if (remaining === 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'num-placeholder';
      pad.appendChild(placeholder);
      continue;
    }

    const btn = document.createElement('button');
    btn.className = 'num-btn';
    if (selectedNum === n) btn.classList.add('selected-num');

    const numSpan = document.createElement('span');
    numSpan.textContent = n;
    btn.appendChild(numSpan);

    const countSpan = document.createElement('span');
    countSpan.className = 'num-remaining';
    countSpan.textContent = remaining;
    btn.appendChild(countSpan);

    btn.addEventListener('click', () => {
      if (gameOver || paused) return;
      if (selectedNum === n) {
        selectedNum = null;
      } else {
        selectedNum = n;
      }
      renderNumPad();
    });

    pad.appendChild(btn);
  }
}

function onCellClick(row, col) {
  if (gameOver || paused) return;
  if (initialBoard[row][col] !== 0) {
    selectedRow = row;
    selectedCol = col;
    updateUI();
    return;
  }

  if (selectedNum !== null) {
    placeNumber(row, col, selectedNum);
  } else {
    selectedRow = row;
    selectedCol = col;
    updateUI();
  }
}

function placeNumber(row, col, num) {
  if (initialBoard[row][col] !== 0) return;
  if (board[row][col] === num) {
    board[row][col] = 0;
    renderBoard();
    updateUI();
    renderNumPad();
    return;
  }

  board[row][col] = num;

  if (num === solution[row][col]) {
    board[row][col] = num;
    renderBoard();
    updateUI();
    renderNumPad();
    checkWin();
  } else {
    lives--;
    board[row][col] = 0;
    updateStatus();
    renderBoard();
    updateUI();

    if (lives <= 0) {
      gameOver = true;
      clearInterval(timerInterval);
      showModal('💀 Game Over', 'Te quedaste sin vidas. ¡Intenta de nuevo!');
    }
  }
}

function checkWin() {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) return;
    }
  }

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== solution[r][c]) return;
    }
  }

  gameOver = true;
  clearInterval(timerInterval);

  const best = saveScore(seconds, difficulty);
  const timeStr = formatTime(seconds);
  let msg = `¡Completaste el Sudoku en ${timeStr}!`;
  if (best && best <= seconds) {
    msg += `\n🏆 ¡Nueva mejor puntuación!`;
  } else if (best) {
    msg += `\nMejor tiempo: ${formatTime(best)}`;
  }

  showModal('🎉 ¡Felicidades!', msg);
}

function giveHint() {
  if (gameOver || paused) return;
  if (hintsLeft <= 0) return;

  const emptyCells = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] === 0) emptyCells.push([r, c]);
    }
  }

  if (emptyCells.length === 0) return;

  const [r, c] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  board[r][c] = solution[r][c];
  hintsLeft--;

  renderBoard();
  updateStatus();
  renderNumPad();

  selectedRow = r;
  selectedCol = c;
  updateUI();

  checkWin();
}

function eraseNumber() {
  if (gameOver || paused) return;
  if (selectedRow < 0 || selectedCol < 0) return;
  if (initialBoard[selectedRow][selectedCol] !== 0) return;

  board[selectedRow][selectedCol] = 0;
  renderBoard();
  updateUI();
  renderNumPad();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  document.getElementById('pause-btn').textContent = paused ? '▶ Reanudar' : '⏸ Pausa';

  const cells = document.querySelectorAll('#board td');
  cells.forEach(td => {
    if (paused) {
      td.style.opacity = '0.3';
    } else {
      td.style.opacity = '1';
    }
  });

  if (!paused) {
    updateUI();
  }
}

function updateUI() {
  const cells = document.querySelectorAll('#board td');
  cells.forEach(td => {
    const r = parseInt(td.dataset.row);
    const c = parseInt(td.dataset.col);
    td.classList.remove('highlighted', 'same-number', 'selected', 'conflict');
  });

  if (selectedRow < 0 || selectedCol < 0 || paused || gameOver) return;

  const sr = selectedRow;
  const sc = selectedCol;
  const val = board[sr][sc];

  cells.forEach(td => {
    const r = parseInt(td.dataset.row);
    const c = parseInt(td.dataset.col);

    if (r === sr && c === sc) {
      td.classList.add('selected');
      return;
    }

    const sameRow = r === sr;
    const sameCol = c === sc;
    const sameBox = Math.floor(r / 3) === Math.floor(sr / 3) && Math.floor(c / 3) === Math.floor(sc / 3);
    const sameVal = val !== 0 && board[r][c] === val;

    if (sameVal && (board[r][c] !== 0)) {
      td.classList.add('same-number');
    } else if (sameRow || sameCol || sameBox) {
      td.classList.add('highlighted');
    }
  });
}

function updateStatus() {
  const heartsStr = '❤️'.repeat(Math.max(0, lives)) + '🖤'.repeat(Math.max(0, 3 - lives));
  document.getElementById('lives').textContent = heartsStr;
  document.getElementById('hint-count').textContent = hintsLeft;
}

function updateTimer() {
  document.getElementById('timer').textContent = formatTime(seconds);
}

function formatTime(s) {
  const m = String(Math.floor(s / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

function showModal(title, msg) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-msg').textContent = msg;
  document.getElementById('overlay').classList.remove('hidden');
}

document.getElementById('new-game-btn').addEventListener('click', () => {
  clearInterval(timerInterval);
  initGame();
});

document.getElementById('mode-select').addEventListener('change', (e) => {
  difficulty = e.target.value;
});

document.getElementById('hint-btn').addEventListener('click', giveHint);
document.getElementById('erase-btn').addEventListener('click', eraseNumber);
document.getElementById('pause-btn').addEventListener('click', togglePause);

document.getElementById('modal-btn').addEventListener('click', () => {
  document.getElementById('overlay').classList.add('hidden');
});

document.addEventListener('keydown', (e) => {
  if (gameOver || paused) return;
  const num = parseInt(e.key);
  if (num >= 1 && num <= 9) {
    selectedNum = num;
    renderNumPad();
    if (selectedRow >= 0 && selectedCol >= 0) {
      placeNumber(selectedRow, selectedCol, num);
    }
    return;
  }
  if (e.key === 'Backspace' || e.key === 'Delete') {
    eraseNumber();
  }
  if (e.key === 'h' || e.key === 'H') {
    giveHint();
  }
});

initGame();
