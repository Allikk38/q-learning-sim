import pytest
import json
from fastapi.testclient import TestClient
from server.main import app

client = TestClient(app)


class TestWebSocketContract:
    """T8: WebSocket контракт."""

    def test_websocket_message_has_required_keys(self):
        """WebSocket присылает JSON со всеми необходимыми ключами."""
        with client.websocket_connect("/ws") as websocket:
            data = websocket.receive_json()

            required_keys = [
                "step", "grid", "cells", "agents",
                "predators", "metrics", "event_log",
                "generation", "q_table"
            ]

            present = list(data.keys())
            for key in required_keys:
                assert key in data, (
                    f"Отсутствует ключ: '{key}'. Доступные: {present}"
                )

    def test_websocket_state_format(self):
        """Проверяем типы полей."""
        with client.websocket_connect("/ws") as websocket:
            data = websocket.receive_json()

            assert isinstance(data["step"], int)
            assert isinstance(data["grid"], dict)
            assert isinstance(data["cells"], list)
            assert isinstance(data["agents"], list)
            assert isinstance(data["predators"], list)
            assert isinstance(data["metrics"], dict)
            assert isinstance(data["event_log"], list)
            assert isinstance(data["generation"], int)
            # q_table может быть dict или list — не проверяем строго


class TestServerCommands:
    """T9, T10: Команды через WebSocket."""

    def test_kill_agent_command(self):
        """Команда kill_agent делает агента мёртвым."""
        with client.websocket_connect("/ws") as websocket:
            initial = websocket.receive_json()
            agents = initial.get("agents", [])

            if not agents:
                pytest.skip("Нет агентов для теста")

            # Ищем живого агента
            target = None
            for a in agents:
                if a.get("alive"):
                    target = a
                    break
            if target is None:
                pytest.skip("Все агенты уже мертвы")

            websocket.send_json({"command": "kill_agent", "agent_id": target["id"]})
            updated = websocket.receive_json()
            updated_agents = {a["id"]: a for a in updated.get("agents", [])}

            assert not updated_agents[target["id"]].get("alive"), (
                f"Агент {target['id']} должен быть мёртв после kill_agent"
            )

    def test_reset_world_command(self):
        """Команда reset_world сбрасывает step на 0."""
        with client.websocket_connect("/ws") as websocket:
            # Начальное состояние
            websocket.receive_json()

            # Делаем шаг
            websocket.send_json({"command": "step", "action": "rest"})
            post_step = websocket.receive_json()
            assert post_step.get("step", 0) > 0, "Предусловие: step должен вырасти"

            # Сброс
            websocket.send_json({"command": "reset_world"})
            reset = websocket.receive_json()

            assert reset.get("step") == 0, (
                f"После reset_world step должен быть 0, получено {reset.get('step')}"
            )