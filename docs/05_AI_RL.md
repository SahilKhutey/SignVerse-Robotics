# AI & Reinforcement Learning

Sign-Verse utilizes a dual-memory system (Short Term Ring Buffers & Long Term Vector Databases) alongside a PyTorch Transformer Decoder.
The system auto-regressively predicts the $T+1$ kinematic frame using a triangular mask to prevent future-peeking. The PPO Agent then optimizes this prediction against an external reward function.
