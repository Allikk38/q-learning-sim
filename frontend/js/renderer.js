let canvas, ctx;
let gridWidth = 10;
let gridHeight = 10;
let cellSize = 40;
let heatMap = [];
let maxHeat = 1;

const COLORS = {
    empty: '#1a1a2e',
    food: '#2ecc71',
    poison: '#9b59b6',
    predator: '#e74c3c',
    agent: '#3498db'
};

function initRenderer(canvasId) {
    canvas = document.getElementById(canvasId);
    ctx = canvas.getContext('2d');
}

function setGridSize(w, h) {
    gridWidth = w;
    gridHeight = h;
    cellSize = Math.floor(Math.min(
        (window.innerWidth - 340) / gridWidth,
        (window.innerHeight - 40) / gridHeight
    ));
    canvas.width = cellSize * gridWidth;
    canvas.height = cellSize * gridHeight;
    heatMap = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));
}

function drawGrid(cells, agents, predators) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Клетки
    for (const cell of cells) {
        const x = cell.x * cellSize;
        const y = cell.y * cellSize;
        ctx.fillStyle = COLORS[cell.type] || COLORS.empty;
        ctx.fillRect(x, y, cellSize, cellSize);

        // Тепловая карта
        const heat = heatMap[cell.y]?.[cell.x] || 0;
        if (heat > 0) {
            const alpha = Math.log(heat + 1) / Math.log(maxHeat + 1) * 0.5;
            ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
            ctx.fillRect(x, y, cellSize, cellSize);
        }

        // Сетка
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, cellSize, cellSize);
    }

    // Хищники
    for (const p of predators) {
        drawTriangle(p.x * cellSize + cellSize / 2, p.y * cellSize + cellSize / 2, cellSize / 2, COLORS.predator);
    }

    // Агенты
    for (const a of agents) {
        if (a.alive === false) continue;
        const cx = a.x * cellSize + cellSize / 2;
        const cy = a.y * cellSize + cellSize / 2;
        ctx.fillStyle = COLORS.agent;
        ctx.fillRect(cx - cellSize / 3, cy - cellSize / 3, cellSize / 1.5, cellSize / 1.5);

        // Обновляем тепловую карту
        if (heatMap[a.y] !== undefined) {
            heatMap[a.y][a.x] = (heatMap[a.y][a.x] || 0) + 1;
            if (heatMap[a.y][a.x] > maxHeat) maxHeat = heatMap[a.y][a.x];
        }
    }
}

function drawTriangle(cx, cy, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx - size, cy + size / 2);
    ctx.lineTo(cx + size, cy + size / 2);
    ctx.closePath();
    ctx.fill();
}

function applyDeltas(deltas) {
    for (const d of deltas) {
        if (d.type === 'agent_moved') {
            heatMap[d.from[1]][d.from[0]] = (heatMap[d.from[1]][d.from[0]] || 0) + 0;
        }
    }
}

function resetRenderer() {
    heatMap = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));
    maxHeat = 1;
}