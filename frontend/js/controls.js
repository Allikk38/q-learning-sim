let isRunning = false;

function initControls() {
    document.getElementById('btn-play').addEventListener('click', () => {
        sendCommand({ command: 'set_speed', value: 1 });
        isRunning = true;
        updateButtons();
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
        sendCommand({ command: 'set_speed', value: 0 });
        isRunning = false;
        updateButtons();
    });

    document.getElementById('btn-speed-1x').addEventListener('click', () => {
        sendCommand({ command: 'set_speed', value: 1 });
        isRunning = true;
        updateButtons();
    });

    document.getElementById('btn-speed-2x').addEventListener('click', () => {
        sendCommand({ command: 'set_speed', value: 2 });
        isRunning = true;
        updateButtons();
    });

    document.getElementById('btn-speed-5x').addEventListener('click', () => {
        sendCommand({ command: 'set_speed', value: 5 });
        isRunning = true;
        updateButtons();
    });

    document.getElementById('btn-kill').addEventListener('click', () => {
        sendCommand({ command: 'kill_agent', id: 0 });
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        sendCommand({ command: 'reset_world' });
    });
}

function updateButtons() {
    document.getElementById('btn-play').style.background = isRunning ? '#2ecc71' : '#0f3460';
    document.getElementById('btn-pause').style.background = !isRunning ? '#e74c3c' : '#0f3460';
}