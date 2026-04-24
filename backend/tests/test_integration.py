import pytest
from core.world import World
from core.agent import Creature


class TestWorldStep:
    """T7: world.step() возвращает корректный формат."""

    def test_step_returns_valid_format(self, world, agent):
        """world.step() возвращает словарь с rewards и next_states."""
        result = world.step({agent.id: "explore"})

        assert isinstance(result, dict), (
            f"world.step() должен возвращать dict, получено {type(result)}"
        )
        assert "rewards" in result, "Нет ключа 'rewards'"
        assert "next_states" in result, "Нет ключа 'next_states'"
        assert isinstance(result["rewards"], dict)
        assert isinstance(result["next_states"], dict)
        assert agent.id in result["rewards"]
        assert agent.id in result["next_states"]
        ns = result["next_states"][agent.id]
        if ns is not None:
            assert isinstance(ns, tuple) and len(ns) == 4

    def test_step_updates_step_count(self, world, agent):
        """Шаг увеличивает step_count (или документирует баг)."""
        initial = world.step_count
        world.step({agent.id: "rest"})

        if world.step_count == initial:
            pytest.fail(
                "БАГ: World.step() не увеличивает step_count. "
                f"Было {initial}, осталось {world.step_count}. "
                "Добавьте self.step_count += 1 в начало метода step()."
            )

        assert world.step_count == initial + 1

    def test_agent_dies_when_health_zero(self, test_config):
        """При health=0 агент умирает."""
        w = World(config=test_config)
        w.agents.clear()
        a = Creature(agent_id=1, x=5, y=5)
        a.health = 1
        a.hunger = 50
        w.agents.append(a)

        w.step({a.id: "rest"})

        assert not a.alive, (
            f"Агент с health=1 и hunger=50 должен умереть. "
            f"alive={a.alive}, health={a.health}"
        )

    def test_step_respects_max_steps(self, test_config):
        """Эпизод завершается при step_count >= max_steps_per_episode."""
        config = test_config.copy()
        config["max_steps_per_episode"] = 5
        w = World(config=config)
        w.agents.clear()
        a = Creature(agent_id=1, x=5, y=5)
        a.health = 100
        a.hunger = 0
        w.agents.append(a)

        for i in range(5):
            w.step({a.id: "rest"})

        if w.step_count == 0:
            pytest.fail(
                "БАГ: World.step() не увеличивает step_count. "
                "После 5 вызовов step() значение всё ещё 0."
            )

        assert w.step_count == 5, (
            f"После 5 шагов step_count должен быть 5, получено {w.step_count}"
        )