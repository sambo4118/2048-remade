const canvas = document.getElementById("gameCanvas");
const gridCanvas = document.getElementById("gridCanvas");
const context = canvas.getContext("2d");
const gridContext = gridCanvas.getContext("2d");
const scoreValueElement = document.getElementById("scoreValue");
const leaderboardListElement = document.getElementById("leaderboardList");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScoreValueElement = document.getElementById("finalScoreValue");
const submitStatusElement = document.getElementById("submitStatus");
const initialsForm = document.getElementById("initialsForm");
const initialsInput = document.getElementById("initialsInput");
const submitScoreButton = document.getElementById("submitScoreButton");
const playAgainButton = document.getElementById("playAgainButton");

const GAME_ID = "2048";
const LEADERBOARD_LIMIT = 10;

const TILE_COLORS = {
  2: "#7aa2f7",
  4: "#89b4fa",
  8: "#f5a97f",
  16: "#ee99a0",
  32: "#f7768e",
  64: "#e46876",
  128: "#9ece6a",
  256: "#73daca",
  512: "#7dcfff",
  1024: "#c0a6ff",
  2048: "#f5c06a"
};

const TILE_TEXT_COLORS = {
    2: "#18202b",
    4: "#18202b",
    8: "#18202b",
    16: "#18202b",
    32: "#e6edf7",
    64: "#e6edf7",
    128: "#18202b",
    256: "#18202b",
    512: "#18202b",
    1024: "#18202b",
    2048: "#18202b"
};

class Grid {
    constructor(context, size = 4) {
        this.size = size;
        this.context = context;
        this.cells = this.createEmptyGrid();
        this.padding = 14;
        this.gap = 12;
        this.cellRadius = 10;
        this.totalGap = this.gap * (this.size - 1);
        this.usable = canvas.width - this.padding * 2 - this.totalGap;
        this.cellSize = this.usable / this.size;
    }

    createEmptyGrid() {
        return Array.from({ length: this.size }, () => Array(this.size).fill(0));
    }
    drawGrid() {
        this.context.clearRect(0, 0, canvas.width, canvas.height);
        const boardColor = "#1f242d";
        const cellColor = "#2c3440";

        this.context.fillStyle = boardColor;
        this.context.fillRect(0, 0, canvas.width, canvas.height);

        this.context.fillStyle = cellColor;
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const px = this.padding + x * (this.cellSize + this.gap);
                const py = this.padding + y * (this.cellSize + this.gap);
                this.context.beginPath();
                this.context.roundRect(px, py, this.cellSize, this.cellSize, this.cellRadius);
                this.context.fill();
            }
        }
    }
}

class Tile {
    constructor(grid, value, x, y) {
        
        this.grid = grid;
        this.value = value;
        this.x = x;
        this.y = y;
        this.isAnimating = false;
        this.grid.cells[this.y][this.x] = this;

    }
    
    getMoveTarget(direction) {
        const directions = [
            { dx: 0, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }
        ];

        const dir = directions[direction];
        if (!dir) return null;

        let nx = this.x;
        let ny = this.y;
        let moved = 0;

        while (true) {
            const tx = nx + dir.dx;
            const ty = ny + dir.dy;

            const outOfBounds =
                tx < 0 || tx >= this.grid.size ||
                ty < 0 || ty >= this.grid.size;

            if (outOfBounds) break;

            const occupant = this.grid.cells[ty][tx];
            if (occupant instanceof Tile) {
                if (occupant !== this && occupant.value === this.value) {
                    nx = tx;
                    ny = ty;
                    moved++;
                }
                break;
            }

            nx = tx;
            ny = ty;
            moved++;
        }

        return { x: nx, y: ny, moved };
    }

    moveDirection(direction) {
        // 0=up, 1=right, 2=down, 3=left
        const directions = [
            { dx: 0, dy: -1 }, // up
            { dx: 1, dy: 0 },  // right
            { dx: 0, dy: 1 },  // down
            { dx: -1, dy: 0 }  // left
        ];

        const dir = directions[direction];
        if (!dir) return 0;

        let nx = this.x;
        let ny = this.y;
        let moveTo = 0;

        // walk until next cell is out of bounds or blocked
        while (true) {
            const tx = nx + dir.dx;
            const ty = ny + dir.dy;

            const outOfBounds =
                tx < 0 || tx >= this.grid.size ||
                ty < 0 || ty >= this.grid.size;

            if (outOfBounds) break;
            if (this.grid.cells[ty][tx] instanceof Tile) {
                const other = this.grid.cells[ty][tx];
                if (other.value === this.value) {
                    // merge
                    this.value *= 2;
                    this.grid.cells[ty][tx] = 0;
                    moveTo++;
                } else {
                    break;
                }
            }

            nx = tx;
            ny = ty;
            moveTo++;
        }

        if (moveTo > 0) {
            this.grid.cells[this.y][this.x] = 0; // clear old
            this.x = nx;
            this.y = ny;
            this.grid.cells[this.y][this.x] = this; // place new
        }

        return moveTo; // number of spaces moved
    }

    drawTileAt(px, py) {
        const tileColor = TILE_COLORS[this.value] || "#3b4252";
        const textColor = TILE_TEXT_COLORS[this.value] || "#e6edf7";

        context.fillStyle = tileColor;
        context.beginPath();
        context.roundRect(px, py, this.grid.cellSize, this.grid.cellSize, this.grid.cellRadius);
        context.fill();

        context.fillStyle = textColor;
        context.font = `bold ${Math.floor(this.grid.cellSize * 0.35)}px Segoe UI`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(this.value), px + this.grid.cellSize / 2, py + this.grid.cellSize / 2);
    }

    drawTile() {
        const px = this.grid.padding + this.x * (this.grid.cellSize + this.grid.gap);
        const py = this.grid.padding + this.y * (this.grid.cellSize + this.grid.gap);
        this.drawTileAt(px, py);
    }

    animateMove(direction) {
        if (this.isAnimating) return;

        const target = this.getMoveTarget(direction);
        if (!target || target.moved <= 0) {
            return;
        }

        const startX = this.x;
        const startY = this.y;
        const endX = target.x;
        const endY = target.y;

        const cellStride = this.grid.cellSize + this.grid.gap;
        const startPx = this.grid.padding + startX * cellStride;
        const startPy = this.grid.padding + startY * cellStride;
        const endPx = this.grid.padding + endX * cellStride;
        const endPy = this.grid.padding + endY * cellStride;
        const durationMs = 120;
        let startTime = null;
        this.isAnimating = true;

        context.clearRect(0, 0, canvas.width, canvas.height);
        this.drawTileAt(startPx, startPy);

        const step = (now) => {
            if (startTime === null) {
                startTime = now;
            }

            const elapsed = now - startTime;
            const t = Math.max(0, Math.min(elapsed / durationMs, 1));
            const eased = 1 - Math.pow(1 - t, 3);
            const px = startPx + (endPx - startPx) * eased;
            const py = startPy + (endPy - startPy) * eased;

            context.clearRect(0, 0, canvas.width, canvas.height);
            this.drawTileAt(px, py);

            if (t < 1) {
                requestAnimationFrame(step);
                return;
            }

            context.clearRect(0, 0, canvas.width, canvas.height);
            this.moveDirection(direction);
            this.drawTile();
            this.isAnimating = false;
        };

        requestAnimationFrame(step);
    }

}

function generateRandomTile(grid) {
    const emptyCells = [];
    for (let y = 0; y < grid.size; y++) {
        for (let x = 0; x < grid.size; x++) {
            if (grid.cells[y][x] === 0) {
                emptyCells.push({ x, y });
            }
        }
    }
    if (emptyCells.length === 0) return false;
    
    const randomIndex = Math.floor(Math.random() * emptyCells.length);
    const { x, y } = emptyCells[randomIndex];
    const value = Math.random() < 0.9 ? 2 : 4;
    const tile = new Tile(grid, value, x, y);
    return tile;
}

function drawTileValueAt(grid, value, px, py) {
    const tileColor = TILE_COLORS[value] || "#3b4252";
    const textColor = TILE_TEXT_COLORS[value] || "#e6edf7";

    context.fillStyle = tileColor;
    context.beginPath();
    context.roundRect(px, py, grid.cellSize, grid.cellSize, grid.cellRadius);
    context.fill();

    context.fillStyle = textColor;
    context.font = `bold ${Math.floor(grid.cellSize * 0.35)}px Segoe UI`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(value), px + grid.cellSize / 2, py + grid.cellSize / 2);
}

function drawAllTiles(grid) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < grid.size; y++) {
        for (let x = 0; x < grid.size; x++) {
            const tile = grid.cells[y][x];
            if (tile instanceof Tile) {
                tile.drawTile();
            }
        }
    }
}

function moveAllTiles(grid, direction) {
    let moved = false;
    const xOrder = [...Array(grid.size).keys()];
    const yOrder = [...Array(grid.size).keys()];

    if (direction === 1) {
        xOrder.reverse();
    }
    if (direction === 2) {
        yOrder.reverse();
    }

    for (const y of yOrder) {
        for (const x of xOrder) {
            const tile = grid.cells[y][x];
            if (!(tile instanceof Tile)) continue;
            const distance = tile.moveDirection(direction);
            if (distance > 0) {
                moved = true;
            }
        }
    }

    return moved;
}

let isBoardAnimating = false;
let grid = null;
let currentScore = 0;
let gameIsOver = false;
let scoreSubmitted = false;

function formatScore(score) {
    return Number(score || 0).toLocaleString("en-US");
}

function sanitizeInitials(value) {
    return String(value || "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 3);
}

function calculateBoardScore(grid) {
    let total = 0;
    for (let y = 0; y < grid.size; y++) {
        for (let x = 0; x < grid.size; x++) {
            const tile = grid.cells[y][x];
            if (tile instanceof Tile) {
                total += tile.value;
            }
        }
    }
    return total;
}

function canMakeAnyMove(grid) {
    for (let y = 0; y < grid.size; y++) {
        for (let x = 0; x < grid.size; x++) {
            const tile = grid.cells[y][x];
            if (!(tile instanceof Tile)) {
                return true;
            }

            const right = x + 1 < grid.size ? grid.cells[y][x + 1] : null;
            const down = y + 1 < grid.size ? grid.cells[y + 1][x] : null;

            if (right instanceof Tile && right.value === tile.value) {
                return true;
            }
            if (down instanceof Tile && down.value === tile.value) {
                return true;
            }
        }
    }

    return false;
}

function updateScoreUI() {
    scoreValueElement.textContent = formatScore(currentScore);
}

function setSubmitStatus(message, isError = false) {
    submitStatusElement.textContent = message;
    submitStatusElement.style.color = isError ? "#ff9aa9" : "#b0c6dd";
}

function toggleOverlay(show) {
    gameOverOverlay.classList.toggle("visible", show);
    gameOverOverlay.setAttribute("aria-hidden", show ? "false" : "true");
}

function renderLeaderboard(entries) {
    leaderboardListElement.innerHTML = "";

    if (!entries.length) {
        const item = document.createElement("li");
        item.className = "leaderboard-item";
        item.textContent = "No scores yet.";
        leaderboardListElement.appendChild(item);
        return;
    }

    entries.slice(0, LEADERBOARD_LIMIT).forEach((entry, index) => {
        const item = document.createElement("li");
        item.className = "leaderboard-item";

        const rank = document.createElement("span");
        rank.className = "leaderboard-rank";
        rank.textContent = `#${index + 1}`;

        const name = document.createElement("span");
        name.className = "leaderboard-name";
        name.textContent = String(entry.name || "---").slice(0, 24);

        const score = document.createElement("span");
        score.className = "leaderboard-score";
        score.textContent = formatScore(entry.score || 0);

        item.appendChild(rank);
        item.appendChild(name);
        item.appendChild(score);

        leaderboardListElement.appendChild(item);
    });
}

async function fetchLeaderboard() {
    try {
        const response = await fetch(`/api/games/${encodeURIComponent(GAME_ID)}/leaderboard?max=${LEADERBOARD_LIMIT}`);
        if (!response.ok) {
            throw new Error(`Leaderboard fetch failed (${response.status})`);
        }

        const payload = await response.json();
        const entries = Array.isArray(payload.leaderboard) ? payload.leaderboard : [];
        renderLeaderboard(entries);
    } catch (error) {
        renderLeaderboard([]);
    }
}

async function submitLeaderboardScore(name, score) {
    const response = await fetch(`/api/games/${encodeURIComponent(GAME_ID)}/leaderboard`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, score })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = typeof payload.error === "string" ? payload.error : "Failed to submit score";
        throw new Error(message);
    }

    return payload;
}

function handleLoss() {
    if (gameIsOver) {
        return;
    }

    gameIsOver = true;
    scoreSubmitted = false;
    finalScoreValueElement.textContent = formatScore(currentScore);
    submitScoreButton.disabled = false;
    setSubmitStatus("Enter 1-3 initials, then submit to leaderboard.");
    toggleOverlay(true);
    initialsInput.value = "";
    initialsInput.focus();
}

function createNewGame() {
    grid = new Grid(gridContext, 4);
    grid.drawGrid();

    generateRandomTile(grid);
    generateRandomTile(grid);
    drawAllTiles(grid);

    currentScore = calculateBoardScore(grid);
    gameIsOver = false;
    scoreSubmitted = false;
    updateScoreUI();
    toggleOverlay(false);
}

function animateBoardMove(grid, direction, onComplete) {
    if (isBoardAnimating) return;

    const beforeState = new Map();
    for (let y = 0; y < grid.size; y++) {
        for (let x = 0; x < grid.size; x++) {
            const tile = grid.cells[y][x];
            if (tile instanceof Tile) {
                beforeState.set(tile, { x: tile.x, y: tile.y, value: tile.value });
            }
        }
    }

    const moved = moveAllTiles(grid, direction);
    if (!moved) {
        return false;
    }

    const tileStride = grid.cellSize + grid.gap;
    const tilesForDraw = [];

    for (let y = 0; y < grid.size; y++) {
        for (let x = 0; x < grid.size; x++) {
            const tile = grid.cells[y][x];
            if (!(tile instanceof Tile)) continue;

            const start = beforeState.get(tile) || { x: tile.x, y: tile.y, value: tile.value };
            tilesForDraw.push({
                startX: start.x,
                startY: start.y,
                endX: tile.x,
                endY: tile.y,
                startValue: start.value,
                endValue: tile.value
            });
        }
    }

    const durationMs = 120;
    let startTime = null;
    isBoardAnimating = true;

    const step = (now) => {
        if (startTime === null) {
            startTime = now;
        }

        const elapsed = now - startTime;
        const t = Math.max(0, Math.min(elapsed / durationMs, 1));
        const eased = 1 - Math.pow(1 - t, 3);

        context.clearRect(0, 0, canvas.width, canvas.height);

        for (const tile of tilesForDraw) {
            const drawX = tile.startX + (tile.endX - tile.startX) * eased;
            const drawY = tile.startY + (tile.endY - tile.startY) * eased;
            const px = grid.padding + drawX * tileStride;
            const py = grid.padding + drawY * tileStride;
            const value = t < 1 ? tile.startValue : tile.endValue;
            drawTileValueAt(grid, value, px, py);
        }

        if (t < 1) {
            requestAnimationFrame(step);
            return;
        }

        generateRandomTile(grid);
        drawAllTiles(grid);
        isBoardAnimating = false;

        if (typeof onComplete === "function") {
            onComplete();
        }
    };

    requestAnimationFrame(step);
    return true;
}

createNewGame();
fetchLeaderboard();

const keyToDirection = {
    "ArrowUp": 0,
    "ArrowRight": 1,
    "ArrowDown": 2,
    "ArrowLeft": 3,
    "w": 0,
    "d": 1,
    "s": 2,
    "a": 3
};

window.addEventListener("keydown", (event) => {
    if (event.repeat || isBoardAnimating || gameIsOver) return;

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const direction = keyToDirection[key];
    if (direction === undefined) return;

    event.preventDefault();
    const moved = animateBoardMove(grid, direction, () => {
        currentScore = calculateBoardScore(grid);
        updateScoreUI();

        if (!canMakeAnyMove(grid)) {
            handleLoss();
        }
    });

    if (!moved && !canMakeAnyMove(grid)) {
        handleLoss();
    }
});

initialsInput.addEventListener("input", () => {
    const cleaned = sanitizeInitials(initialsInput.value);
    if (cleaned !== initialsInput.value) {
        initialsInput.value = cleaned;
    }
});

initialsForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!gameIsOver || scoreSubmitted) {
        return;
    }

    const initials = sanitizeInitials(initialsInput.value);
    initialsInput.value = initials;

    if (!initials) {
        setSubmitStatus("Initials required.", true);
        return;
    }

    submitScoreButton.disabled = true;
    setSubmitStatus("Submitting score...");

    try {
        const payload = await submitLeaderboardScore(initials, currentScore);
        const entries = Array.isArray(payload.leaderboard) ? payload.leaderboard : [];
        renderLeaderboard(entries);
        scoreSubmitted = true;
        setSubmitStatus("Score submitted. You are on the board.");
    } catch (error) {
        setSubmitStatus(error.message || "Unable to submit score.", true);
        submitScoreButton.disabled = false;
    }
});

playAgainButton.addEventListener("click", () => {
    createNewGame();
});