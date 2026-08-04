ARG PYTHON_IMAGE=registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent-python:3.11-slim-bookworm

FROM ${PYTHON_IMAGE} AS builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /build
COPY pyproject.toml ./
COPY dagent ./dagent
RUN python -m pip wheel --wheel-dir /wheels .

FROM ${PYTHON_IMAGE}

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN groupadd --gid 10001 dagent \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin dagent

WORKDIR /app
COPY --from=builder /wheels /wheels
RUN python -m pip install /wheels/* \
    && rm -rf /wheels

USER 10001:10001
EXPOSE 8000

CMD ["uvicorn", "dagent.app:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
