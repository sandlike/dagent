FROM registry.cn-hangzhou.aliyuncs.com/citics_lwj/opencode:1.15.12

USER root

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    UV_TOOL_DIR=/opt/uv-tools \
    UV_TOOL_BIN_DIR=/usr/local/bin \
    UV_PYTHON_INSTALL_DIR=/opt/uv-python

RUN apk add --no-cache \
      chromium \
      git \
      go \
      gradle \
      maven \
      linux-headers \
      py3-pip \
      py3-pytest \
      python3 \
      python3-dev \
      uv \
    && ln -sf /usr/bin/python3 /usr/local/bin/python \
    && uv tool install --default-index https://mirrors.aliyun.com/pypi/simple \
      --python /usr/bin/python3 serena-agent==1.6.1 \
    && npm config set registry https://registry.npmmirror.com \
    && npm install --global @playwright/test@1.54.2 playwright@1.54.2 \
    && npm cache clean --force \
    && python -m pytest --version \
    && node --version \
    && java -version \
    && mvn -version \
    && gradle -version \
    && go version \
    && git --version \
    && serena --help >/dev/null \
    && playwright --version

USER 1500:1500
