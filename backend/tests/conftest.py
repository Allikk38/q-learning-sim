import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.world import World, Cell
from core.agent import Agent, Creature


@pytest.fixture
def test_config():
    return {
        "grid_width": 10,
        "grid_height": 10,
        "random_event_probability": 0.0,
        "inheritance_factor": 0.3,
        "inheritance_noise_sigma": 0.05,
        "max_steps_per_episode": 1000
    }


@pytest.fixture
def cell():
    """Клетка с плодородием 0.5."""
    c = Cell(0, 0)
    c.properties["fertility"] = 0.5
    return c


@pytest.fixture
def world(test_config):
    """Мир 10×10 без случайного спавна. Очищаем и добавляем одного агента."""
    w = World(config=test_config)
    w.agents.clear()
    w.predators.clear()
    w.food_positions.clear()
    w.poison_positions.clear()
    w.step_count = 0
    w._previous_state = None
    # Очищаем клетки
    for row in w.grid:
        for cell in row:
            cell.type = "empty"
            cell.properties.clear()
    return w


@pytest.fixture
def agent(world):
    """Агент в центре мира."""
    a = Creature(agent_id=1, x=5, y=5)
    world.agents.append(a)
    return a


@pytest.fixture
def world_with_food(test_config):
    """Мир с агентом и едой в соседней клетке."""
    w = World(config=test_config)
    w.agents.clear()
    w.predators.clear()
    w.food_positions.clear()
    w.poison_positions.clear()
    w.step_count = 0
    w._previous_state = None
    for row in w.grid:
        for cell in row:
            cell.type = "empty"
            cell.properties.clear()

    a = Creature(agent_id=1, x=5, y=5)
    w.agents.append(a)

    # Кладём еду на (5, 4) — сверху от агента
    w.grid[4][5].type = "food"
    w.food_positions.add((5, 4))

    return w, a