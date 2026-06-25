FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    apt-utils \
    ca-certificates \
    sudo \
    bash \
    nano \
    vim \
    git \
    python3 \
    python3-pip \
    gcc \
    g++ \
    build-essential \
    curl \
    wget \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Creare utilizator student cu drepturi sudo
RUN useradd -m -s /bin/bash student && \
    echo "student ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

# Creare director workspace cu permisiuni corecte (înainte de USER student)
RUN mkdir -p /home/student/workspace && \
    chown -R student:student /home/student

ENV TERM=xterm-256color

USER student

# Copiem .bashrc și setăm prompt-ul personalizat
RUN cp /etc/skel/.bashrc /home/student/.bashrc 2>/dev/null || true && \
    echo 'export PS1="\[\033[01;32m\]student@educode\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ "' >> /home/student/.bashrc && \
    echo 'cd /home/student/workspace' >> /home/student/.bashrc

WORKDIR /home/student/workspace

CMD ["tail", "-f", "/dev/null"]
