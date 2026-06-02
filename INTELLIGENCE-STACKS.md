# SignVerse Motion Intelligence Stack

This document details the machine learning models, statistical tokenizers, and physical derivatives pipelines.

For a comprehensive specifications layout across all 10 system layers, see [SYSTEMS.md](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/SYSTEMS.md).

---

## 1. Physical Estimators

*   **Derivatives Resolver**: Uses backward differences smoothed via Exponential Moving Averages (EMA) to compute velocities inside [velocity_estimator.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/kinematics/velocity_estimator.py) and accelerations inside [acceleration_estimator.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/kinematics/acceleration_estimator.py).
*   **Kinetic Energy Segmenter**: Breaks continuous movement streams into discrete actions inside [action_segmenter.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/motion_intelligence/action_segmenter.py) by evaluating cumulative joint kinetic energy peaks.

---

## 2. Machine Learning & Symbolic Features

*   **Motion Tokenizer**: Quantizes continuous joints into discrete tokens inside [motion_tokenizer.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/ai/tokenization/motion_tokenizer.py) via discrete bins.
*   **128D Statistical Embedder**: Synthesizes joint moments into 128-dimensional unit normalized vectors inside [motion_embeddings.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/motion_intelligence/motion_embeddings.py).
*   **Skill Classifier**: Maps joint-speed segments into primitive movements (`approach`, `reach`, `grasp`, `lift`) inside [skill_tokenizer.py](file:///c:/Users/User/Documents/SignVerse-Robotics/sign-verse-robotics/services/semantic-service/segmentation/skill_tokenizer.py).
