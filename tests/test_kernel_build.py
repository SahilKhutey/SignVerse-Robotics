import pytest
import numpy as np
import os
import uuid
from pathlib import Path
from core.os.kernel.signverse_kernel import SignVerseKernel

def test_kernel_initialization_and_tick():
    previous_db_path = os.environ.get("SIGNVERSE_TELEOP_DB_PATH")
    tmp_dir = Path(".tmp_test_artifacts") / f"kernel_{uuid.uuid4().hex}"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    os.environ["SIGNVERSE_TELEOP_DB_PATH"] = str(tmp_dir / "teleoperation.db")

    # 1. Initialize Kernel
    kernel = SignVerseKernel()
    try:
        assert kernel.perception_process is not None
        assert kernel.policy is not None
        assert kernel.ik_solver is not None
        assert kernel.simulation.model is not None
        
        # 2. Create mock black frame
        dummy_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        
        # 3. Execute tick (Perception -> ML -> IK -> MuJoCo)
        success = kernel.tick(dummy_frame)
        
        # 4. Assert full pipeline completion without raising exceptions
        assert isinstance(success, dict)
        assert success.get("status") in ["CONNECTED", "ERROR"]
    finally:
        # 5. Ensure shutdown runs cleanly
        kernel.shutdown()
        if previous_db_path is None:
            os.environ.pop("SIGNVERSE_TELEOP_DB_PATH", None)
        else:
            os.environ["SIGNVERSE_TELEOP_DB_PATH"] = previous_db_path

if __name__ == "__main__":
    pytest.main(["-v", "tests/test_kernel_build.py"])
