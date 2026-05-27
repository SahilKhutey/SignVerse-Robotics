FROM ros:humble-ros-base

WORKDIR /app
RUN apt-get update && apt-get install -y python3-pip

COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# We assume standard ROS setup is executed in entrypoint
COPY src/ ./src/

CMD ["/bin/bash", "-c", "source /opt/ros/humble/setup.bash && uvicorn src.main:app --host 0.0.0.0 --port 8001"]
