import pytest
import json
import server.main as server_module
from core.world import World
from server.game_loop import GameLoop
from fastapi.testclient import TestClient

client = TestClient(server_module.app)

@pytest.fixture(autouse=True)
def setup_game_loop():
    config = {
        "grid_width": 10, "grid_height": 10,
        "random_event_probability": 0.0,
        "inheritance_factor": 0.3,
        "inheritance_noise_sigma": 0.05,
        "max_steps_per_episode": 1000
    }
    gl = GameLoop(config)
    gl.world._spawn_initial()
    gl.running = True
    gl.generation = 1
    server_module.game_loop = gl
    yield
    server_module.game_loop = None

class TestWebSocketContract:
    def test_websocket_message_has_required_keys(self):
        with client.websocket_connect("/ws") as ws:
            data = json.loads(ws.receive_text())
            required = ["step", "grid", "cells", "agents", "predators"]
            for k in required:
                assert k in data, f"Missing: {k}"

class TestServerCommands:
    def test_kill_agent_command(self):
        with client.websocket_connect("/ws") as ws:
            initial = json.loads(ws.receive_text())
            target = next((a for a in initial["agents"] if a["alive"]), None)
            if not target: pytest.skip("No alive agent")
            ws.send_text(json.dumps({"command":"kill_agent","id":target["id"]}))
            import time; time.sleep(0.1)
            gl = server_module.game_loop
            agent = next(a for a in gl.world.agents if a.id == target["id"])
            assert not agent.alive

    def test_reset_world_command(self):
        with client.websocket_connect("/ws") as ws:
            ws.receive_text()
            ws.send_text(json.dumps({"command":"reset_world"}))
            import time; time.sleep(0.1)
            assert server_module.game_loop.world.step_count == 0