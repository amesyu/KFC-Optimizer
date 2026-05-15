FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && \
	apt-get install -y build-essential nlohmann-json3-dev ca-certificates && \
	rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY . /app
# Generate menu JSON assets into frontend/src/assets so backend can load them at runtime
RUN mkdir -p /app/frontend/src/assets && \
	cd /app/src/menu_generator && \
	make gen_all OUTPUT_DIR=/app/frontend/src/assets || echo "menu generation failed"
EXPOSE 8000

CMD ["uvicorn", "backend.web_app:app", "--host", "0.0.0.0", "--port", "8000"]
