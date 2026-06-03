import subprocess
import sys
import os
import time
import signal

# List of all background processes
processes = []

def cleanup_and_exit(signum, frame):
    """Gracefully terminates all child processes to prevent zombie ports."""
    print("\n[OS Orchestrator] Shutting down SignVerse Ecosystem...")
    for p in processes:
        try:
            print(f"Terminating Process ID: {p.pid}")
            p.terminate()
        except Exception:
            pass
    print("[OS Orchestrator] Goodbye.")
    sys.exit(0)

# Register the signal handlers
signal.signal(signal.SIGINT, cleanup_and_exit)
signal.signal(signal.SIGTERM, cleanup_and_exit)

def start_backend():
    print("[OS Orchestrator] Booting FastAPI Backend (Uvicorn)...")
    env = os.environ.copy()
    env["PYTHONPATH"] = os.path.abspath(os.path.dirname(__file__))
    
    p = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "core.deployment.api_gateway.gateway:app", "--reload"],
        env=env,
        cwd=os.path.abspath(os.path.dirname(__file__))
    )
    processes.append(p)
    
if __name__ == "__main__":
    print("=============================================")
    print("     SIGNVERSE ROBOTICS OS ORCHESTRATOR      ")
    print("=============================================")
    print("Press Ctrl+C to stop all servers gracefully.\n")
    
    start_backend()
    

    
    # Wait infinitely until interrupted
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        cleanup_and_exit(None, None)
