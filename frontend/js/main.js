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
    });

    onDelta((step, deltas) => {
        applyDeltas(deltas);
    });

    onMetrics((metrics) => {
        updateCharts(metrics);
    });

    connect(host + ':8000');
})();