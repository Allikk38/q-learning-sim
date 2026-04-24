(function () {
    const host = location.hostname || 'localhost';

    initRenderer('game-canvas');
    initCharts();
    initControls();

    onFullState((state) => {
        if (state.grid) {
            setGridSize(state.grid.width, state.grid.height);
        }
        drawGrid(state.cells || [], state.agents || [], state.predators || []);
        if (state.metrics) {
            updateCharts(state.metrics);
        }
        if (state.agents && state.agents[0]) {
            updateHUD(state.step, state.generation, state.agents[0]);
            if (state.agents[0].q_table) {
                updateQTable(state.agents[0].q_table);
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