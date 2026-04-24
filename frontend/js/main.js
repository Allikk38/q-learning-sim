(function () {
    const host = location.hostname || 'localhost';

    initRenderer('game-canvas');
    initCharts();
    initControls();

    onFullState((state) => {
        console.log('EVENT_LOG:', state.event_log);
        if (state.grid) {
            setGridSize(state.grid.width, state.grid.height);
        }
        drawGrid(state.cells || [], state.agents || [], state.predators || []);
        if (state.metrics) {
            updateCharts(state.metrics);
        }
        if (state.agents && state.agents[0]) {
            const metrics = state.metrics?.agents?.[0] || null;
            updateHUD(state.step, state.generation, state.agents[0], metrics);
            if (state.agents[0].q_table) {
                updateRadar(state.agents[0].q_table, state.agents[0].action, null);
            }
        }
        if (state.event_log) {
            updateEventLog(state.event_log);
        }
    });

    onDelta((step, deltas) => {
        applyDeltas(deltas);
    });

    onMetrics((metrics) => {
        updateCharts(metrics);
    });

    connect(host + ':8000');
})();