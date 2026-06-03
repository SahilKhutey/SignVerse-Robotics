import pytest
import os
import tempfile
import h5py
from fastapi.testclient import TestClient
from core.deployment.api_gateway.gateway import app, API_KEY

def test_export_endpoints():
    with TestClient(app) as client:
        # Test 1: HDF5 export format
        response = client.get("/api/sessions/1/export?format=hdf5", headers={"X-API-Key": API_KEY})
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/x-hdf5"
        
        # Save temporary h5 file
        with tempfile.NamedTemporaryFile(suffix=".h5", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name
            
        try:
            with h5py.File(tmp_path, "r") as f:
                # Assert datasets exist
                assert "joint_angles" in f
                assert "timestamps" in f
                assert "observations" in f
                assert "rewards" in f
                assert "session_metadata" in f
                
                # Check shapes and structures
                joint_angles = f["joint_angles"][:]
                assert joint_angles.ndim == 2
                assert joint_angles.shape[1] == 7
                
                timestamps = f["timestamps"][:]
                assert timestamps.ndim == 1
                
                meta = f["session_metadata"]
                assert meta.attrs["id"] == "1"
        finally:
            os.remove(tmp_path)
            
        # Test 2: RLDS export format
        response = client.get("/api/sessions/1/export?format=rlds", headers={"X-API-Key": API_KEY})
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/x-hdf5"
        
        with tempfile.NamedTemporaryFile(suffix=".h5", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name
            
        try:
            with h5py.File(tmp_path, "r") as f:
                # Assert datasets exist
                assert "observation" in f
                assert "action" in f
                assert "reward" in f
                assert "discount" in f
                assert "is_first" in f
                assert "is_last" in f
                assert "is_terminal" in f
                assert "session_metadata" in f
                
                # Check shapes and structures
                action = f["action"][:]
                assert action.ndim == 2
                assert action.shape[1] == 7
                
                observation = f["observation"][:]
                assert observation.ndim == 2
                assert observation.shape[1] == 63
                
                is_first = f["is_first"][:]
                assert is_first[0] == True
                assert all(is_first[1:] == False)
                
                is_last = f["is_last"][:]
                assert is_last[-1] == True
                assert all(is_last[:-1] == False)
        finally:
            os.remove(tmp_path)

def test_export_unsupported_format():
    with TestClient(app) as client:
        response = client.get("/api/sessions/1/export?format=unsupported", headers={"X-API-Key": API_KEY})
        assert response.status_code == 400

