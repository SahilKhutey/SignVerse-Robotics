import cv2
import mediapipe as mp
import numpy as np

mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles
mp_holistic = mp.solutions.holistic

class SkeletonRenderer:
    def __init__(self):
        '''
        High-performance OpenCV renderer for raw 2D visualization
        '''
        pass
        
    def draw_landmarks(self, image_bgr, landmarks_dict):
        '''
        Draws the pose, hands, and face over a cv2 image.
        landmarks_dict is expected to be a raw MediaPipe results object for the MVP.
        In a decoupled architecture, this reconstructs the NormalizedLandmarkList.
        '''
        annotated_image = image_bgr.copy()
        
        if landmarks_dict is None:
            return annotated_image

        # Since we decoupled Mediapipe in perception worker, we re-build standard arrays here
        # or just assume the input is the raw MediaPipe results for the visualization worker.
        results = landmarks_dict 
        
        # Draw face mesh
        if hasattr(results, 'face_landmarks') and results.face_landmarks:
            mp_drawing.draw_landmarks(
                annotated_image,
                results.face_landmarks,
                mp_holistic.FACEMESH_TESSELATION,
                landmark_drawing_spec=None,
                connection_drawing_spec=mp_drawing_styles.get_default_face_mesh_tesselation_style())
                
        # Draw pose
        if hasattr(results, 'pose_landmarks') and results.pose_landmarks:
            mp_drawing.draw_landmarks(
                annotated_image,
                results.pose_landmarks,
                mp_holistic.POSE_CONNECTIONS,
                landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style())
                
        # Draw left hand
        if hasattr(results, 'left_hand_landmarks') and results.left_hand_landmarks:
            mp_drawing.draw_landmarks(
                annotated_image,
                results.left_hand_landmarks,
                mp_holistic.HAND_CONNECTIONS)
                
        # Draw right hand
        if hasattr(results, 'right_hand_landmarks') and results.right_hand_landmarks:
            mp_drawing.draw_landmarks(
                annotated_image,
                results.right_hand_landmarks,
                mp_holistic.HAND_CONNECTIONS)

        return annotated_image
