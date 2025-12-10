const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const COLS = 10;
const ROWS = 20;
const CELL = 28;
const PX = 40;
const PY = 40;

const statusLabel = document.getElementById('status');
const pauseBtn = document.getElementById('pause');
const restartBtn = document.getElementById('restart');
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnDown = document.getElementById('btnDown');
const btnRotL = document.getElementById('btnRotL');
const btnRotR = document.getElementById('btnRotR');
const btnHard = document.getElementById('btnHard');

let keys = new Set();
let paused = false;

document.addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'KeyP') togglePause(); if (e.code === 'KeyR') restart(); e.preventDefault(); });
document.addEventListener('keyup', e => { keys.delete(e.code); });
pauseBtn.onclick = togglePause;
restartBtn.onclick = restart;
setupMobileControls();

function createMatrix(rows, cols) { const m = []; for (let y = 0; y < rows; y++) { m[y] = new Array(cols).fill(0); } return m; }

const COLORS = { 1: '#e74c3c', 2: '#f1c40f', 3: '#2ecc71', 4: '#3498db', 5: '#9b59b6', 6: '#e67e22', 7: '#1abc9c' };

const SHAPES = {
  I: [[0,1],[1,1],[2,1],[3,1]],
  O: [[1,0],[2,0],[1,1],[2,1]],
  T: [[1,0],[0,1],[1,1],[2,1]],
  S: [[1,0],[2,0],[0,1],[1,1]],
  Z: [[0,0],[1,0],[1,1],[2,1]],
  J: [[0,0],[0,1],[1,1],[2,1]],
  L: [[2,0],[0,1],[1,1],[2,1]]
};

const TYPES = ['I','O','T','S','Z','J','L'];

function rotate(points, dir) {
  const cx = 1.5; const cy = 1.0;
  return points.map(([x,y]) => {
    const dx = x - cx, dy = y - cy;
    return dir > 0 ? [Math.round(cx - dy), Math.round(cy + dx)] : [Math.round(cx + dy), Math.round(cy - dx)];
  });
}

class Bag { constructor() { this.q = []; this.refill(); } refill() { const a = TYPES.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } this.q = this.q.concat(a); } next() { if (this.q.length < 7) this.refill(); return this.q.shift(); } }

class Piece {
  constructor(type) { this.type = type; this.blocks = SHAPES[type].map(p=>p.slice()); this.x = 3; this.y = -2; this.color = COLORS[TYPES.indexOf(type)+1]; }
}

class Game { constructor(){ this.board = createMatrix(ROWS, COLS); this.bag = new Bag(); this.cur = new Piece(this.bag.next()); this.next = new Piece(this.bag.next()); this.level = 1; this.score = 0; this.lines = 0; this.dropInterval = 800; this.dropCounter = 0; this.softDrop = false; this.gameOver = false; } }

const game = new Game();

function collides(piece, nx = piece.x, ny = piece.y, blocks = piece.blocks) {
  for (const [x,y] of blocks) {
    const px = nx + x; const py = ny + y;
    if (py < 0) continue;
    if (px < 0 || px >= COLS || py >= ROWS) return true;
    if (game.board[py][px]) return true;
  }
  return false;
}

function merge(piece) {
  for (const [x,y] of piece.blocks) {
    const px = piece.x + x; const py = piece.y + y;
    if (py >= 0) game.board[py][px] = TYPES.indexOf(piece.type)+1;
  }
}

function clearLines() {
  let cleared = 0;
  for (let y = ROWS-1; y >= 0; y--) {
    if (game.board[y].every(c=>c)) { game.board.splice(y,1); game.board.unshift(new Array(COLS).fill(0)); cleared++; y++; }
  }
  if (cleared) {
    const pts = cleared === 1 ? 100 : cleared === 2 ? 300 : cleared === 3 ? 500 : 800;
    game.score += pts * game.level;
    game.lines += cleared;
    if (game.lines >= game.level * 10) { game.level++; game.dropInterval = Math.max(120, 800 - (game.level-1)*60); }
  }
}

function spawn() {
  game.cur = game.next; game.cur.x = 3; game.cur.y = -2; game.next = new Piece(game.bag.next());
  if (collides(game.cur)) { game.gameOver = true; }
}

function tryMove(dx, dy) {
  const nx = game.cur.x + dx; const ny = game.cur.y + dy;
  if (!collides(game.cur, nx, ny)) { game.cur.x = nx; game.cur.y = ny; return true; }
  return false;
}

function tryRotate(dir) {
  const rot = rotate(game.cur.blocks, dir);
  if (!collides(game.cur, game.cur.x, game.cur.y, rot)) { game.cur.blocks = rot; return true; }
  const kicks = [0,-1,1,-2,2];
  for (const k of kicks) { if (!collides(game.cur, game.cur.x + k, game.cur.y, rot)) { game.cur.x += k; game.cur.blocks = rot; return true; } }
  return false;
}

function hardDrop() {
  let dist = 0;
  while (!collides(game.cur, game.cur.x, game.cur.y + 1)) { game.cur.y++; dist++; }
  merge(game.cur); clearLines(); spawn(); game.score += dist * 2;
}

function softDropTick(dt) { if (keys.has('ArrowDown')) { game.dropCounter += dt * 3; game.softDrop = true; } else { game.softDrop = false; } }

function inputTick() {
  if (keys.has('ArrowLeft')) { tryMove(-1,0); keys.delete('ArrowLeft'); }
  if (keys.has('ArrowRight')) { tryMove(1,0); keys.delete('ArrowRight'); }
  if (keys.has('KeyZ')) { tryRotate(-1); keys.delete('KeyZ'); }
  if (keys.has('KeyX')) { tryRotate(1); keys.delete('KeyX'); }
  if (keys.has('Space')) { hardDrop(); keys.delete('Space'); }
}

function togglePause(){ paused = !paused; }
function restart(){ Object.assign(game, new Game()); }

function drawCell(x,y,val){ if (!val) return; const px = PX + x*CELL; const py = PY + y*CELL; const col = COLORS[val]; ctx.fillStyle = col; ctx.fillRect(px+1, py+1, CELL-2, CELL-2); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px+2, py+2, CELL-2, CELL/3); ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(px+2, py+CELL/2, CELL-3, CELL/2); ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.strokeRect(px+0.5, py+0.5, CELL-1, CELL-1); }

function drawPiece(p){ for (const [x,y] of p.blocks){ const px = p.x + x; const py = p.y + y; if (py >= 0) drawCell(px,py,TYPES.indexOf(p.type)+1); } }

function drawUI(){ ctx.fillStyle = '#0d0d14'; ctx.fillRect(0,0,W,H); ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = '#1f1f2e'; ctx.fillRect(PX-6, PY-6, COLS*CELL+12, ROWS*CELL+12); ctx.strokeRect(PX-6.5, PY-6.5, COLS*CELL+13, ROWS*CELL+13); ctx.fillStyle = '#1f1f2e'; ctx.fillRect(W-180, PY-6, 160, 180); ctx.strokeRect(W-180.5, PY-6.5, 160, 180); ctx.fillStyle = '#fff'; ctx.font = 'bold 18px ui-sans-serif, system-ui, -apple-system'; ctx.fillText('NEXT', W-160, PY+20); drawNext(); ctx.fillText('SCORE', W-160, PY+120); ctx.fillText(String(game.score), W-160, PY+142); ctx.fillText('LEVEL '+game.level, W-160, PY+164); }

function drawNext(){ const p = game.next; for (const [x,y] of p.blocks){ const px = W-140 + x*CELL*0.7; const py = PY+30 + y*CELL*0.7; ctx.fillStyle = p.color; ctx.fillRect(px, py, CELL*0.7, CELL*0.7); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.strokeRect(px+0.5, py+0.5, CELL*0.7, CELL*0.7); }
}

function render(){ drawUI(); for (let y=0;y<ROWS;y++){ for (let x=0;x<COLS;x++){ drawCell(x,y,game.board[y][x]); } } drawPiece(game.cur); statusLabel.textContent = `分數 ${game.score}｜等級 ${game.level}｜行數 ${game.lines}${game.gameOver?'｜遊戲結束':''}${paused?'｜暫停':''}`; }

let last = performance.now();
function loop(t){ const dt = t-last; last=t; if (!paused && !game.gameOver){ inputTick(); softDropTick(dt); game.dropCounter += dt; const interval = game.softDrop ? Math.max(60, game.dropInterval/6) : game.dropInterval; if (game.dropCounter > interval){ if (!tryMove(0,1)){ merge(game.cur); clearLines(); spawn(); } else { if (game.softDrop) game.score += 1; } game.dropCounter = 0; } } render(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

function setupMobileControls(){
  const holds = { left:null, right:null };
  const startHold = (key)=>{
    if (key==='left'){
      if (holds.left) return; tryMove(-1,0); holds.left = setInterval(()=>tryMove(-1,0), 90);
    } else if (key==='right'){
      if (holds.right) return; tryMove(1,0); holds.right = setInterval(()=>tryMove(1,0), 90);
    }
  };
  const stopHold = (key)=>{
    if (key==='left' && holds.left){ clearInterval(holds.left); holds.left=null; }
    if (key==='right' && holds.right){ clearInterval(holds.right); holds.right=null; }
  };
  const on = (el, down, up)=>{
    if (!el) return;
    el.addEventListener('pointerdown', (e)=>{ e.preventDefault(); down(); });
    el.addEventListener('pointerup', (e)=>{ e.preventDefault(); up(); });
    el.addEventListener('pointerleave', (e)=>{ e.preventDefault(); up(); });
  };
  on(btnLeft, ()=>startHold('left'), ()=>stopHold('left'));
  on(btnRight, ()=>startHold('right'), ()=>stopHold('right'));
  on(btnDown, ()=>{ keys.add('ArrowDown'); }, ()=>{ keys.delete('ArrowDown'); });
  on(btnRotL, ()=>{ tryRotate(-1); }, ()=>{});
  on(btnRotR, ()=>{ tryRotate(1); }, ()=>{});
  on(btnHard, ()=>{ hardDrop(); }, ()=>{});
}
