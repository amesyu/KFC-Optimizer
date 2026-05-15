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

EXPOSE 8000

# Generate menu JSON assets during image build so backend can load them at runtime
RUN mkdir -p /app/frontend/src/assets && \
	cd /app/src/menu_generator && \
	make gen_all OUTPUT_DIR=/app/frontend/src/assets || echo "menu generation failed"

# Use shell form so $PORT (set by Render) is expanded; fallback to 8000 if unset
CMD ["sh", "-c", "uvicorn backend.web_app:app --host 0.0.0.0 --port ${PORT:-8000}"]
