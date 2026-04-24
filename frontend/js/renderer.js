let canvas, ctx;
let gridWidth = 10;
let gridHeight = 10;
let cellSize = 40;
let heatMap = [];
let maxHeat = 1;

// V1: пылинки — статический массив, генерируется один раз
let dustParticles = [];

// V2: предыдущие позиции агентов для плавного движения
let prevAgentPositions = {};
// V5: предыдущие позиции хищников для плавного движения
let prevPredatorPositions = {};
// V2: текущее время кадра для анимаций
let currentFrameTime = 0;

// V3: частицы
let particles = [];
// V6: camera shake
let shakeAmount = 0;

// V7: данные для HUD
let hudData = {
    step: 0,
    generation: 1,
    health: 100,
    energy: 80,
    hunger: 0
};

const COLORS = {
    empty: '#1a1a2e',
    food: '#2ecc71',
    poison: '#9b59b6',
    predator: '#e74c3c',
    agent: '#3498db'
};

// V2: цвета агента
const AGENT_COLORS = {
    core: '#e0f7fa',
    body: '#00bcd4',
    membrane: '#4dd0e1',
    glow: '#00e5ff',
    hunger_tint: '#90a4ae',
    poison_tint: '#ce93d8'
};

// V3: цвета еды
const FOOD_COLORS = {
    body_start: '#ffb300',
    body_end: '#ff8f00',
    inner_glow: 'rgba(255, 255, 200, 0.6)'
};

// V4: цвета яда
const POISON_COLORS = {
    body_start: '#7b1fa2',
    body_end: '#4a148c',
    outline: '#ce93d8',
    inner_glow: 'rgba(200, 100, 255, 0.5)'
};

// V5: цвета хищника
const PREDATOR_COLORS = {
    body_start: '#b71c1c',
    body_end: '#f44336',
    outline: '#ff5252',
    eye: '#ffffff'
};

// V1: свечения для типов клеток
const GLOW_BASE_ALPHA = 0.08;

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
    // V7: добавляем 30px снизу для HUD
    canvas.width = cellSize * gridWidth;
    canvas.height = cellSize * gridHeight + 30;
    heatMap = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));

    // V1: генерируем пылинки один раз
    generateDust();
}

// V2: линейная интерполяция
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// V1: генерация статических пылинок
function generateDust() {
    dustParticles = [];
    const count = 30 + Math.floor(Math.random() * 11);
    for (let i = 0; i < count; i++) {
        dustParticles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * (canvas.height - 30), // V7: только в области сетки
            alpha: 0.1 + Math.random() * 0.2
        });
    }
}

// V7: обновление данных HUD (вызывается из main.js)
function updateHUD(step, generation, agent) {
    hudData.step = step;
    hudData.generation = generation;
    if (agent) {
        hudData.health = agent.health ?? 0;
        hudData.energy = agent.energy ?? 0;
        hudData.hunger = agent.hunger ?? 0;
    }
}

// V7: отрисовка HUD — LED-шкалы под сеткой
function drawHUD() {
    const gridHeightPx = cellSize * gridHeight;
    const barY = gridHeightPx + 5;
    const barHeight = 4;
    const barGap = 3;
    const barWidth = canvas.width;

    // Текст: шаг и поколение
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Шаг: ${hudData.step} | Поколение: ${hudData.generation}`, 4, gridHeightPx + 1);

    // Фон для шкалы здоровья
    const healthBarY = barY + 10;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, healthBarY, barWidth, barHeight);

    // Шкала здоровья
    const healthWidth = Math.max(0, Math.min(1, hudData.health / 100)) * barWidth;
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(0, healthBarY, healthWidth, barHeight);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Фон для шкалы энергии
    const energyBarY = healthBarY + barHeight + barGap;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, energyBarY, barWidth, barHeight);

    // Шкала энергии
    const energyWidth = Math.max(0, Math.min(1, hudData.energy / 100)) * barWidth;
    ctx.shadowColor = '#3498db';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#3498db';
    ctx.fillRect(0, energyBarY, energyWidth, barHeight);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Фон для шкалы голода
    const hungerBarY = energyBarY + barHeight + barGap;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, hungerBarY, barWidth, barHeight);

    // Шкала голода
    const hungerWidth = Math.max(0, Math.min(1, hudData.hunger / 100)) * barWidth;
    ctx.shadowColor = '#e67e22';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(0, hungerBarY, hungerWidth, barHeight);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
}

// V6: спавн частиц при съедении еды
function spawnFoodParticles(cx, cy, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 3;
        particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            life: 1.0,
            decay: 0.02 + Math.random() * 0.04,
            radius: 1.5 + Math.random() * 2.5,
            color: `hsl(${40 + Math.random() * 20}, 100%, ${60 + Math.random() * 20}%)`
        });
    }
}

// V6: спавн частиц при отравлении
function spawnPoisonFlash(cx, cy) {
    for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        particles.push({
            x: cx,
            y: cy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            decay: 0.03 + Math.random() * 0.05,
            radius: 1 + Math.random() * 3,
            color: `hsl(${280 + Math.random() * 30}, 80%, ${50 + Math.random() * 30}%)`
        });
    }
}

// V6: обновление и отрисовка частиц
function updateAndDrawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// V6: тряска камеры
function triggerShake(intensity) {
    shakeAmount = Math.max(shakeAmount, intensity);
}

// V1: сбор занятых клеток из cells + agents + predators
function getOccupiedCells(cells, agents, predators) {
    const occupied = new Set();

    for (const cell of cells) {
        if (cell.type !== 'empty') {
            occupied.add(`${cell.x},${cell.y}`);
        }
    }
    for (const a of agents) {
        if (a.alive !== false) {
            occupied.add(`${a.x},${a.y}`);
        }
    }
    for (const p of predators) {
        occupied.add(`${p.x},${p.y}`);
    }

    return occupied;
}

// V1: радиальное свечение для занятой клетки
function drawCellGlow(cx, cy, type) {
    const radius = cellSize * 0.5;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);

    let color;
    switch (type) {
        case 'food':    color = [46, 204, 113]; break;
        case 'poison':  color = [155, 89, 182]; break;
        case 'predator': color = [231, 76, 60]; break;
        case 'agent':   color = [52, 152, 219]; break;
        default: return;
    }

    gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${GLOW_BASE_ALPHA})`);
    gradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

// V7: тепловая карта — мягкие световые пятна
function drawHeatMap() {
    for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
            const heat = heatMap[y]?.[x] || 0;
            if (heat === 0) continue;

            const cx = x * cellSize + cellSize / 2;
            const cy = y * cellSize + cellSize / 2;
            const alpha = Math.log(heat + 1) / Math.log(maxHeat + 1) * 0.4;
            const radius = cellSize * 0.6;

            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            gradient.addColorStop(0, `rgba(255, 140, 0, ${alpha})`);
            gradient.addColorStop(1, 'rgba(255, 140, 0, 0)');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// V1: отрисовка пылинок
function drawDust() {
    for (const p of dustParticles) {
        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.fillRect(p.x, p.y, 1, 1);
    }
}

// V1: отрисовка линий сетки
function drawGridLines() {
    const gridHeightPx = cellSize * gridHeight;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    for (let x = 0; x <= gridWidth; x++) {
        const px = x * cellSize;
        ctx.moveTo(px, 0);
        ctx.lineTo(px, gridHeightPx);
    }
    for (let y = 0; y <= gridHeight; y++) {
        const py = y * cellSize;
        ctx.moveTo(0, py);
        ctx.lineTo(canvas.width, py);
    }

    ctx.stroke();
}

// V5: отрисовка хищника
function drawPredator(predator) {
    const id = predator.id;
    const targetX = predator.x * cellSize + cellSize / 2;
    const targetY = predator.y * cellSize + cellSize / 2;

    if (!prevPredatorPositions[id]) {
        prevPredatorPositions[id] = { x: targetX, y: targetY };
    }

    prevPredatorPositions[id].x = lerp(prevPredatorPositions[id].x, targetX, 0.2);
    prevPredatorPositions[id].y = lerp(prevPredatorPositions[id].y, targetY, 0.2);

    const cx = prevPredatorPositions[id].x;
    const cy = prevPredatorPositions[id].y;
    const halfLength = cellSize * 0.25;
    const halfWidth = cellSize * 0.1;
    const now = currentFrameTime;

    // 1. Аура — красное свечение
    const auraRadius = cellSize * 1.5;
    const auraGradient = ctx.createRadialGradient(cx, cy, halfLength * 0.5, cx, cy, auraRadius);
    auraGradient.addColorStop(0, 'rgba(255, 0, 0, 0.15)');
    auraGradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
    ctx.fillStyle = auraGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Тело — вытянутый ромб с волновой деформацией
    const waveOffset = Math.sin(now / 400) * cellSize * 0.05;

    const topX = cx;
    const topY = cy - halfLength;
    const rightX = cx + halfWidth + waveOffset;
    const rightY = cy;
    const bottomX = cx;
    const bottomY = cy + halfLength;
    const leftX = cx - halfWidth - waveOffset;
    const leftY = cy;

    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(rightX, rightY);
    ctx.lineTo(bottomX, bottomY);
    ctx.lineTo(leftX, leftY);
    ctx.closePath();

    const bodyGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, halfLength);
    bodyGradient.addColorStop(0, PREDATOR_COLORS.body_start);
    bodyGradient.addColorStop(1, PREDATOR_COLORS.body_end);
    ctx.fillStyle = bodyGradient;
    ctx.fill();

    // 3. Обводка
    ctx.strokeStyle = PREDATOR_COLORS.outline;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 4. Глаз — белая точка в верхней трети ромба
    const eyeX = cx;
    const eyeY = cy - halfLength * 0.35;
    ctx.fillStyle = PREDATOR_COLORS.eye;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 2.5, 0, Math.PI * 2);
    ctx.fill();
}

// V4: отрисовка яда
function drawPoison(poison, cellSize, frameTime) {
    const cx = poison.x * cellSize + cellSize / 2;
    const cy = poison.y * cellSize + cellSize / 2;
    const baseRadius = cellSize * 0.28;
    const spikes = 6;

    // 1. Внешнее свечение — маджентовое
    const glowRadius = baseRadius * 2.5;
    const glowGradient = ctx.createRadialGradient(cx, cy, baseRadius * 0.4, cx, cy, glowRadius);
    glowGradient.addColorStop(0, 'rgba(180, 0, 200, 0.2)');
    glowGradient.addColorStop(1, 'rgba(180, 0, 200, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Тело — угловатый сгусток с 6 шипами
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
        const angle = i * Math.PI / 3 + frameTime / 1500;
        const spikeLength = baseRadius * (1 + Math.sin(frameTime / 600 + i) * 0.3);
        const px = cx + Math.cos(angle) * spikeLength;
        const py = cy + Math.sin(angle) * spikeLength;
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();

    const bodyGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius);
    bodyGradient.addColorStop(0, POISON_COLORS.body_start);
    bodyGradient.addColorStop(1, POISON_COLORS.body_end);
    ctx.fillStyle = bodyGradient;
    ctx.fill();

    // 3. Обводка
    ctx.strokeStyle = POISON_COLORS.outline;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 4. Внутреннее свечение
    const innerRadius = baseRadius * 0.15;
    const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerRadius);
    innerGlow.addColorStop(0, 'rgba(200, 100, 255, 0.5)');
    innerGlow.addColorStop(1, 'rgba(200, 100, 255, 0)');
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();
}

// V3: отрисовка еды
function drawFood(food, cellSize, frameTime) {
    const cx = food.x * cellSize + cellSize / 2;
    const cy = food.y * cellSize + cellSize / 2;
    const baseRadius = cellSize * 0.3;

    // 1. Внешнее свечение — янтарно-золотое
    const glowRadius = baseRadius * 2;
    const glowGradient = ctx.createRadialGradient(cx, cy, baseRadius * 0.5, cx, cy, glowRadius);
    glowGradient.addColorStop(0, 'rgba(255, 200, 50, 0.15)');
    glowGradient.addColorStop(1, 'rgba(255, 200, 50, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Тело — неправильный круг (перистальтика)
    const points = 10;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const offset = Math.sin(frameTime / 800 + i * 1.5) * baseRadius * 0.15;
        const r = baseRadius + offset;
        const px = cx + Math.cos(angle) * r;
        const py = cy + Math.sin(angle) * r;
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.closePath();

    const bodyGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius);
    bodyGradient.addColorStop(0, FOOD_COLORS.body_start);
    bodyGradient.addColorStop(1, FOOD_COLORS.body_end);
    ctx.fillStyle = bodyGradient;
    ctx.fill();

    // 3. Внутреннее свечение
    const innerRadius = baseRadius * 0.2;
    const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerRadius);
    innerGlow.addColorStop(0, 'rgba(255, 255, 200, 0.6)');
    innerGlow.addColorStop(1, 'rgba(255, 255, 200, 0)');
    ctx.fillStyle = innerGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();
}

// V2: отрисовка агента
function drawAgent(agent) {
    if (agent.alive === false) return;

    const id = agent.id;
    const targetX = agent.x * cellSize + cellSize / 2;
    const targetY = agent.y * cellSize + cellSize / 2;

    if (!prevAgentPositions[id]) {
        prevAgentPositions[id] = { x: targetX, y: targetY };
    }

    prevAgentPositions[id].x = lerp(prevAgentPositions[id].x, targetX, 0.2);
    prevAgentPositions[id].y = lerp(prevAgentPositions[id].y, targetY, 0.2);

    const cx = prevAgentPositions[id].x;
    const cy = prevAgentPositions[id].y;
    const radius = cellSize * 0.35;
    const now = currentFrameTime;

    let glowColor = AGENT_COLORS.glow;
    if (agent.hunger > 70) {
        glowColor = AGENT_COLORS.hunger_tint;
    } else if (agent.health < 40) {
        glowColor = AGENT_COLORS.poison_tint;
    }

    // 1. Внешнее свечение
    const glowRadius = radius + 3;
    const glowGradient = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, glowRadius);
    glowGradient.addColorStop(0, glowColor);
    glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. Тело
    ctx.fillStyle = AGENT_COLORS.body;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Мембрана
    const membraneAlpha = Math.sin(now / 300) * 0.15 + 0.7;
    ctx.strokeStyle = AGENT_COLORS.membrane;
    ctx.globalAlpha = membraneAlpha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 4. Ядро
    const corePulse = Math.sin(now / 500) * 0.2 + 1;
    const coreRadius = radius * 0.3 * corePulse;
    ctx.fillStyle = AGENT_COLORS.core;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fill();
}

// Основная отрисовка
function drawGrid(cells, agents, predators) {
    currentFrameTime = Date.now();

    // V6: camera shake
    let shakeApplied = false;
    if (shakeAmount > 0.01) {
        const sx = (Math.random() - 0.5) * shakeAmount * 2;
        const sy = (Math.random() - 0.5) * shakeAmount * 2;
        ctx.save();
        ctx.translate(sx, sy);
        shakeAmount *= 0.85;
        shakeApplied = true;
    } else {
        shakeAmount = 0;
    }

    const gridHeightPx = cellSize * gridHeight;

    // 1. Фон (вся область Canvas включая HUD)
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Пылинки
    drawDust();

    // 3. Свечения занятых клеток
    const occupied = getOccupiedCells(cells, agents, predators);
    for (const key of occupied) {
        const [gx, gy] = key.split(',').map(Number);
        const cx = gx * cellSize + cellSize / 2;
        const cy = gy * cellSize + cellSize / 2;

        let cellType = 'agent';
        const cell = cells.find(c => c.x === gx && c.y === gy);
        if (cell && cell.type !== 'empty') {
            cellType = cell.type;
        } else {
            const hasAgent = agents.some(a => a.x === gx && a.y === gy && a.alive !== false);
            const hasPredator = predators.some(p => p.x === gx && p.y === gy);
            if (hasAgent) cellType = 'agent';
            else if (hasPredator) cellType = 'predator';
        }

        drawCellGlow(cx, cy, cellType);
    }

    // 4. Тепловая карта (V7: мягкие пятна ДО объектов)
    drawHeatMap();

    // 5. Линии сетки
    drawGridLines();

    // 6. Еда (V3)
    for (const cell of cells) {
        if (cell.type === 'food') {
            drawFood(cell, cellSize, currentFrameTime);
        }
    }

    // 7. Яд (V4)
    for (const cell of cells) {
        if (cell.type === 'poison') {
            drawPoison(cell, cellSize, currentFrameTime);
        }
    }

    // 8. Хищники (V5)
    for (const p of predators) {
        drawPredator(p);
    }

    // 9. Агенты (V2)
    for (const a of agents) {
        drawAgent(a);

        if (a.alive !== false && heatMap[a.y] !== undefined) {
            heatMap[a.y][a.x] = (heatMap[a.y][a.x] || 0) + 1;
            if (heatMap[a.y][a.x] > maxHeat) maxHeat = heatMap[a.y][a.x];
        }
    }

    // V6: частицы
    updateAndDrawParticles();

    // V7: HUD — LED-шкалы под сеткой
    drawHUD();

    // V6: восстанавливаем контекст если был shake
    if (shakeApplied) {
        ctx.restore();
    }
}

function applyDeltas(deltas) {
    for (const d of deltas) {
        if (d.type === 'agent_moved') {
            heatMap[d.from[1]][d.from[0]] = (heatMap[d.from[1]][d.from[0]] || 0) + 0;
        }
        if (d.type === 'food_consumed') {
            const cx = d.x * cellSize + cellSize / 2;
            const cy = d.y * cellSize + cellSize / 2;
            spawnFoodParticles(cx, cy, 8);
            triggerShake(1);
        }
        if (d.type === 'poison_consumed') {
            const cx = d.x * cellSize + cellSize / 2;
            const cy = d.y * cellSize + cellSize / 2;
            spawnPoisonFlash(cx, cy);
            triggerShake(3);
        }
    }
}

function resetRenderer() {
    heatMap = Array.from({ length: gridHeight }, () => Array(gridWidth).fill(0));
    maxHeat = 1;
    prevAgentPositions = {};
    prevPredatorPositions = {};
    particles = [];
    shakeAmount = 0;
    hudData = { step: 0, generation: 1, health: 100, energy: 80, hunger: 0 };
}