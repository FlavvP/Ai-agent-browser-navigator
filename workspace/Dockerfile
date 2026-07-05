FROM ghcr.io/linuxserver/baseimage-selkies:debiantrixie

ENV DEBIAN_FRONTEND=noninteractive
ENV WORKSPACE_AUTOMATION_HOST=0.0.0.0
ENV WORKSPACE_AUTOMATION_PORT=8765
ENV LANG=fr_FR.UTF-8
ENV LC_ALL=fr_FR.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends \
    at-spi2-core \
    chromium \
    dbus-x11 \
    espeak-ng \
    libatk-adaptor \
    libgail-common \
    locales \
    orca \
    python3 \
    python3-dogtail \
    python3-pyatspi \
    speech-dispatcher-espeak-ng \
    wmctrl \
    xdotool \
  && sed -i 's/^# *fr_FR.UTF-8 UTF-8/fr_FR.UTF-8 UTF-8/' /etc/locale.gen \
  && locale-gen fr_FR.UTF-8 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

COPY automation/ /opt/agent-automation/
COPY root/ /

RUN chmod +x /custom-cont-init.d/99-agent-automation \
  && chmod +x /usr/local/bin/agent-chromium

EXPOSE 3000 8765
