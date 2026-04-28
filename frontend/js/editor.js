let contextMenu = null;
let contextCell = null;

function createContextMenu() {
    if (contextMenu) return;
    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.style.cssText = `
        position: fixed;
        background: #16213e;
        border: 1px solid #333;
        border-radius: 4px;
        padding: 4px 0;
        z-index: 1000;
        display: none;
        min-width: 160px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;

    const items = [
        { label: 'Сделать плодородной', action: () => applyBrush(contextCell.x, contextCell.y, 1.0, 2) },
        { label: 'Сделать бесплодной', action: () => applyBrush(contextCell.x, contextCell.y, 0.0, 2) },
        { label: 'Отмена', action: () => hideContextMenu() }
    ];

    items.forEach(item => {
        const el = document.createElement('div');
        el.textContent = item.label;
        el.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            font-size: 13px;
            color: #eee;
            transition: background 0.15s;
            user-select: none;
        `;
        el.addEventListener('mouseenter', () => el.style.background = '#0f3460');
        el.addEventListener('mouseleave', () => el.style.background = 'transparent');
        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            item.action();
            hideContextMenu();
        });
        menu.appendChild(el);
    });

    document.body.appendChild(menu);
    contextMenu = menu;
}

function showContextMenu(clientX, clientY, cellX, cellY) {
    if (!contextMenu) {
        createContextMenu();
    }
    contextCell = { x: cellX, y: cellY };

    let menuX = clientX;
    let menuY = clientY;
    const menuW = 170;
    const menuH = 120;

    if (clientX + menuW > window.innerWidth) menuX = clientX - menuW;
    if (clientY + menuH > window.innerHeight) menuY = clientY - menuH;

    contextMenu.style.left = menuX + 'px';
    contextMenu.style.top = menuY + 'px';
    contextMenu.style.display = 'block';
}

function hideContextMenu() {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
    contextCell = null;
}

function applyBrush(x, y, fertility, radius) {
    sendCommand({
        command: 'apply_brush',
        x: x,
        y: y,
        fertility: fertility,
        radius: radius
    });
}

function initEditor(canvas) {
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const mx = (e.clientX - rect.left) * scaleX;
        const my = (e.clientY - rect.top) * scaleY;

        const world = screenToWorld(mx, my);
        const cellX = Math.floor(world.x / cellSize);
        const cellY = Math.floor(world.y / cellSize);

        if (cellX >= 0 && cellX < gridWidth && cellY >= 0 && cellY < gridHeight) {
            showContextMenu(e.clientX, e.clientY, cellX, cellY);
        }
    });

    document.addEventListener('click', (e) => {
        if (contextMenu && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });

    document.addEventListener('contextmenu', (e) => {
        if (contextMenu && !contextMenu.contains(e.target)) {
            hideContextMenu();
        }
    });
}