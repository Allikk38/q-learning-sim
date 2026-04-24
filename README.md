# Q-Learning Sim

Симуляция существа с Q-обучением. MVP: сетка 10×10, один агент, еда, яд, хищник.

## Запуск бэкенда

```bash
cd backend
pip install -r requirements.txt
uvicorn server.main:app --reload --port 8000