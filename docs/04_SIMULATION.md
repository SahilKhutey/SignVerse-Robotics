# MuJoCo Sim2Real

A perfectly mathematically solved motion might still fail in reality due to gravity, momentum, or collision. 
The simulation service loads the target `.xml` robot and physically "plays" the AI's joint commands into the actuators. The `collision_checker.py` analyzes `data.ncon` to ensure the robot does not physically intersect itself.
