ARG AGENT_RUNTIME_IMAGE=registry.cn-hangzhou.aliyuncs.com/citics_lwj/dagent:agent-runtime-v1.0.0
FROM ${AGENT_RUNTIME_IMAGE}

LABEL io.dagent.agent-role="development_document"

USER root
RUN mkdir -p /home/opencode/.config/opencode/skills/dev-plan /home/opencode/.serena
COPY --chown=1500:1500 opencode.json /home/opencode/.config/opencode/opencode.json
COPY --chown=1500:1500 SKILL.md /home/opencode/.config/opencode/skills/dev-plan/SKILL.md
COPY --chown=1500:1500 serena_config.yml /home/opencode/.serena/serena_config.yml
USER 1500:1500
