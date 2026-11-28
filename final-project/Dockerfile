# 後端 Docker 映像 (Render 或 Hugging Face Space)。金鑰不在映像裡：在平台的環境變數設定 GROQ_API_KEY。
# Render 會用環境變數 PORT 指定 port；沒有 PORT 時 (例如 HF Space) 用 7860。
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend ./backend
COPY data ./data
ENV PYTHONPATH=/app/backend ETFCITY_DATA=/app/data ETFCITY_CACHE=/tmp/llm_cache
EXPOSE 7860
CMD ["sh", "-c", "uvicorn app_space:app --app-dir backend --host 0.0.0.0 --port ${PORT:-7860}"]
