import pytest
from core.world import Cell, World


class TestCell:
    """T1: Тесты клетки мира."""

    def test_get_property_returns_default(self, cell):
        """Cell.get_property() возвращает значение по умолчанию."""
        result = cell.get_property("fertility", 0.5)
        assert result == 0.5, f"Ожидалось 0.5, получено {result}"

    def test_get_property_missing_key(self, cell):
        """Cell.get_property() для отсутствующего ключа возвращает default."""
        result = cell.get_property("nonexistent", 0.8)
        assert result == 0.8

    def test_get_property_override(self):
        """Cell.get_property() возвращает фактическое значение, если оно задано."""
        c = Cell(0, 0)
        c.properties["fertility"] = 0.9
        result = c.get_property("fertility", 0.5)
        assert result == 0.9