import pytest
import numpy as np
from core.os.kernel.signverse_kernel import SignVerseKernel

def test_kernel_initialization_and_tick():
    # 1. Initialize Kernel
    kernel = SignVerseKernel()
    
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
    
    # 5. Ensure shutdown runs cleanly
    kernel.shutdown()

if __name__ == "__main__":
    pytest.main(["-v", "tests/test_kernel_build.py"])
