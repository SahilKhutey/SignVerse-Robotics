import cv2
import mediapipe as mp

mp_holistic = mp.solutions.holistic
holistic_model = mp_holistic.Holistic(
    static_image_mode=True,
    model_complexity=2,
    enable_segmentation=False,
    refine_face_landmarks=True
)

def extract_fullbody(frame_path):
    image = cv2.imread(frame_path)
    if image is None:
        return None
    
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    results = holistic_model.process(image_rgb)
    
    pose = []
    if results.pose_landmarks:
        for lm in results.pose_landmarks.landmark:
            pose.append({"x": lm.x, "y": lm.y, "z": lm.z, "visibility": lm.visibility})
            
    left_hand = []
    if results.left_hand_landmarks:
        for lm in results.left_hand_landmarks.landmark:
            left_hand.append({"x": lm.x, "y": lm.y, "z": lm.z})
            
    right_hand = []
    if results.right_hand_landmarks:
        for lm in results.right_hand_landmarks.landmark:
            right_hand.append({"x": lm.x, "y": lm.y, "z": lm.z})
            
    face = []
    if results.face_landmarks:
        for lm in results.face_landmarks.landmark:
            face.append({"x": lm.x, "y": lm.y, "z": lm.z})
            
    return {
        "pose": pose,
        "left_hand": left_hand,
        "right_hand": right_hand,
        "face": face
    }
