import mediapipe as mp
import cv2

mp_pose = mp.solutions.pose

pose = mp_pose.Pose()

def detect_pose(frame_path):

    frame = cv2.imread(frame_path)

    rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    results = pose.process(rgb)

    output = []

    if results.pose_landmarks:

        for idx, landmark in enumerate(
            results.pose_landmarks.landmark
        ):

            output.append({
                "joint_id": idx,
                "x": landmark.x,
                "y": landmark.y,
                "z": landmark.z,
                "visibility": landmark.visibility
            })

    return output
