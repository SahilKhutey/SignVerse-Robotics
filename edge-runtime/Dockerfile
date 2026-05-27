FROM python:3.10-slim

# Note: Target for linux/arm64 in CI/CD (Jetson/Pi)
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/

CMD ["python", "-m", "src.main"]
