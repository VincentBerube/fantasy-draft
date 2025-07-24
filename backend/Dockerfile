FROM python:3.11-slim

WORKDIR /app

COPY ./app /app

RUN pip install --upgrade pip && pip install fastapi uvicorn psycopg2-binary sqlalchemy pydantic

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
