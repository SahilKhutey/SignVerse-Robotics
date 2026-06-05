import subprocess
import sys
import os
import time
import signal
import threading

# List of all background processes
processes = []
threads = []

# ANSI Colors for terminal beautification
COLOR_ORCH = "\033[93m[Orchestrator]\033[0m"
COLOR_BACK = "\033[92m[FastAPI Backend]\033[0m"
COLOR_GATE = "\033[94m[API Gateway   ]\033[0m"
COLOR_DASH = "\033[96m[Vite Dashboard ]\033[0m"

def log_stream(stream, prefix):
    """Reads lines from a stream and prints them with a service prefix."""
    for line in iter(stream.readline, b''):
        try:
            line_str = line.decode('utf-8', errors='replace').rstrip()
            if line_str:
                print(f"{prefix} {line_str}")
        except Exception:
            pass

def cleanup_and_exit(signum, frame):
    """Gracefully terminates all child processes to prevent zombie ports."""
    print(f"\n{COLOR_ORCH} Shutting down SignVerse Ecosystem...")
    for p in processes:
        try:
            print(f"{COLOR_ORCH} Terminating Process ID: {p.pid}")
            # On Windows, we terminate the process group if shell=True was used to prevent orphan processes
            if os.name == 'nt':
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(p.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                p.terminate()
        except Exception:
            pass
    print(f"{COLOR_ORCH} All systems stopped. Goodbye.")
    sys.exit(0)

# Register the signal handlers
signal.signal(signal.SIGINT, cleanup_and_exit)
signal.signal(signal.SIGTERM, cleanup_and_exit)

def start_backend():
    print(f"{COLOR_ORCH} Booting FastAPI Backend (Uvicorn) on port 8000...")
    env = os.environ.copy()
    env["PYTHONPATH"] = os.path.abspath(os.path.dirname(__file__))
    env["OS_API_KEY"] = "signverse_local_dev_key"
    
    p = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "core.deployment.api_gateway.gateway:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        env=env,
        cwd=os.path.abspath(os.path.dirname(__file__)),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    processes.append(p)
    
    t = threading.Thread(target=log_stream, args=(p.stdout, COLOR_BACK))
    t.daemon = True
    t.start()
    threads.append(t)

def start_gateway():
    print(f"{COLOR_ORCH} Compiling TypeScript for Fastify API Gateway...")
    cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend", "api-gateway"))
    # Run the compile step synchronously to build dist/index.js
    subprocess.run(["pnpm", "run", "build"], shell=True, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    print(f"{COLOR_ORCH} Booting Fastify API Gateway on port 3000...")
    p = subprocess.Popen(
        ["pnpm", "start"],
        shell=True,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    processes.append(p)
    
    t = threading.Thread(target=log_stream, args=(p.stdout, COLOR_GATE))
    t.daemon = True
    t.start()
    threads.append(t)

def start_dashboard():
    print(f"{COLOR_ORCH} Booting Vite React Dashboard on port 5173...")
    cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), "apps", "dashboard"))
    
    p = subprocess.Popen(
        ["pnpm", "run", "dev"],
        shell=True,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT
    )
    processes.append(p)
    
    t = threading.Thread(target=log_stream, args=(p.stdout, COLOR_DASH))
    t.daemon = True
    t.start()
    threads.append(t)

if __name__ == "__main__":
    # Enable ANSI escape sequences on Windows 10/11 command prompt
    if os.name == 'nt':
        os.system('color')
        
    print("==========================================================")
    print("        SIGNVERSE ROBOTICS SYSTEM ORCHESTRATOR            ")
    print("==========================================================")
    print("Starting all microservices concurrently...")
    print("Press Ctrl+C to stop all servers gracefully.\n")
    
    start_backend()
    time.sleep(2)  # Give python backend a moment to boot
    
    start_gateway()
    time.sleep(1.5)  # Give gateway a moment to start and connect
    
    start_dashboard()
    
    # Wait infinitely until interrupted
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup_and_exit(None, None)
