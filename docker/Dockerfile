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

RUN useradd -m -s /bin/bash student && \
    echo "student ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

ENV TERM=xterm-256color
WORKDIR /home/student
USER student

RUN cp /etc/skel/.bashrc /home/student/.bashrc

CMD ["tail", "-f", "/dev/null"]