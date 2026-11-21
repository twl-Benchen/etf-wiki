# Hugging Face Space (Docker SDK)。在 Space 的 Settings → Secrets 加上 GROQ_API_KEY。
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY data ./data
ENV PYTHONPATH=/app/backend ETFCITY_DATA=/app/data ETFCITY_CACHE=/tmp/llm_cache
EXPOSE 7860
CMD ["uvicorn", "app_space:app", "--app-dir", "backend", "--host", "0.0.0.0", "--port", "7860"]
