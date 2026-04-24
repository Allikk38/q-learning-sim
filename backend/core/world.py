class Cell:
    def __init__(self, x: int, y: int):
        self.x = x
        self.y = y
        self.type = "empty"
        self.properties = {}

    def get_property(self, key: str, default: float) -> float:
        return self.properties.get(key, default)

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y, "type": self.type}


class World:
    def __init__(self, config: dict):
        self.width = config["grid_width"]
        self.height = config["grid_height"]
        self.grid = [
            [Cell(x, y) for x in range(self.width)] for y in range(self.height)
        ]
        self.agents = []
        self.predators = []
        self.food_positions = set()
        self.poison_positions = set()
        self.step_count = 0
        self._previous_state = None

    def _spawn_initial(self):
        pass

    def step(self, actions: dict) -> dict:
        pass

    def get_state(self) -> dict:
        pass

    def to_delta(self, previous_state: dict) -> list:
        pass

    def get_visible_entities(self, x: int, y: int, radius: int = 3) -> list:
        pass

    def get_cell(self, x: int, y: int) -> Cell:
        return self.grid[y][x]

    def reset(self):
        pass