FROM registry.cn-hangzhou.aliyuncs.com/citics_lwj/opencode-test-runtime:1.15.12-v3

LABEL io.dagent.agent-role="development_document"

USER root
RUN mkdir -p /home/opencode/.config/opencode/skills/dev-plan /home/opencode/.serena
COPY --chown=1500:1500 opencode.json /home/opencode/.config/opencode/opencode.json
COPY --chown=1500:1500 SKILL.md /home/opencode/.config/opencode/skills/dev-plan/SKILL.md
COPY --chown=1500:1500 serena_config.yml /home/opencode/.serena/serena_config.yml
USER 1500:1500
