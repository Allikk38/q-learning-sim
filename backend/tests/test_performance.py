import pytest
import time
from core.world import World
from core.agent import Creature


@pytest.mark.slow
class TestPerformance:
    """T11: Нагрузочное тестирование."""

    def test_100_agents_10_steps_performance(self, test_config):
        """100 агентов, 10 шагов, среднее время шага ≤ 8 мс."""
        w = World(config=test_config)
        w.agents.clear()
        w.predators.clear()
        w.food_positions.clear()
        w.poison_positions.clear()

        # Создаём 100 агентов
        actions_dicts = []
        for i in range(100):
            a = Creature(agent_id=100 + i, x=i % 10, y=(i // 10) % 10)
            a.health = 100
            a.hunger = 0
            a.energy = 100
            w.agents.append(a)
            actions_dicts.append({a.id: "rest"})

        # Прогрев
        w.step(actions_dicts[0])

        times = []
        for step in range(10):
            act = actions_dicts[step % len(actions_dicts)]
            start = time.perf_counter()
            w.step(act)
            elapsed = time.perf_counter() - start
            times.append(elapsed)

        avg_ms = (sum(times) / len(times)) * 1000
        assert avg_ms <= 8.0, (
            f"Среднее время шага {avg_ms:.2f} мс превышает лимит 8 мс"
        )

    def test_scaling_10_agents(self, test_config):
        """10 агентов для быстрой проверки."""
        w = World(config=test_config)
        w.agents.clear()
        w.predators.clear()
        w.food_positions.clear()
        w.poison_positions.clear()

        acts = {}
        for i in range(10):
            a = Creature(agent_id=i, x=i, y=0)
            a.health = 100
            a.hunger = 0
            a.energy = 100
            w.agents.append(a)
            acts[a.id] = "rest"

        times = []
        for _ in range(20):
            start = time.perf_counter()
            w.step(acts)
            elapsed = time.perf_counter() - start
            times.append(elapsed * 1000)

        avg = sum(times) / len(times)
        print(f"\n10 агентов: среднее = {avg:.3f} мс")
        assert avg < 50.0, f"Слишком медленно: {avg:.2f} мс"