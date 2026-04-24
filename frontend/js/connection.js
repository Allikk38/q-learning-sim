let ws = null;
let onFullStateCallback = null;
let onDeltaCallback = null;
let onMetricsCallback = null;

function connect(host) {
    ws = new WebSocket(`ws://${host}/ws`);

    ws.onopen = () => {
        console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'full_state' && onFullStateCallback) {
            onFullStateCallback(data);
        } else if (data.type === 'delta' && onDeltaCallback) {
            onDeltaCallback(data.step, data.deltas);
        }
        if (data.metrics && onMetricsCallback) {
            onMetricsCallback(data.metrics);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
    };

    ws.onerror = (err) => {
        console.error('WebSocket error', err);
    };
}

function sendCommand(command) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(command));
    }
}

function onFullState(callback) {
    onFullStateCallback = callback;
}

function onDelta(callback) {
    onDeltaCallback = callback;
}

function onMetrics(callback) {
    onMetricsCallback = callback;
}