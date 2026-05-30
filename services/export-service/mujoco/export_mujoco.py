import xml.etree.ElementTree as ET
import xml.dom.minidom

def generate_mujoco_xml(robot_profile):
    '''
    Generates a physically valid MuJoCo XML configuration representing the robot's kinematic link/joint structure.
    '''
    robot_name = robot_profile.get("robot_name", "robot_arm")
    mujoco = ET.Element('mujoco', model=robot_name)
    
    ET.SubElement(mujoco, 'compiler', angle='degree', coordinate='local')
    ET.SubElement(mujoco, 'option', gravity='0 0 -9.81')
    
    worldbody = ET.SubElement(mujoco, 'worldbody')
    ET.SubElement(worldbody, 'light', diffuse='.5 .5 .5', pos='0 0 3', dir='0 0 -1')
    ET.SubElement(worldbody, 'geom', type='plane', size='10 10 0.1', rgba='.9 .9 .9 1')
    
    # Pelvis Base
    pelvis = ET.SubElement(worldbody, 'body', name='pelvis', pos='0 0 0')
    ET.SubElement(pelvis, 'geom', type='cylinder', size='0.6 0.25', rgba='0.1 0.1 0.1 1')
    
    # Shoulder Link
    shoulder = ET.SubElement(pelvis, 'body', name='shoulder', pos='0 0.5 0')
    ET.SubElement(shoulder, 'joint', name='shoulder_pitch_r', type='hinge', axis='1 0 0', range='-180 180')
    ET.SubElement(shoulder, 'geom', type='cylinder', size='0.2 0.5', rgba='0.2 0.8 0.2 1')
    
    # Elbow Link
    elbow = ET.SubElement(shoulder, 'body', name='elbow', pos='0 1.0 0')
    ET.SubElement(elbow, 'joint', name='shoulder_roll_r', type='hinge', axis='0 1 0', range='-180 180')
    ET.SubElement(elbow, 'geom', type='box', size='0.1 0.5 0.1', rgba='0.2 0.2 0.8 1')
    
    # Hand / End Effector Link
    hand = ET.SubElement(elbow, 'body', name='hand', pos='0 1.0 0')
    ET.SubElement(hand, 'joint', name='elbow_pitch_r', type='hinge', axis='1 0 0', range='-180 180')
    ET.SubElement(hand, 'geom', type='sphere', size='0.15', rgba='0.9 0.6 0.1 1')
    
    xml_str = ET.tostring(mujoco, encoding='utf-8')
    parsed = xml.dom.minidom.parseString(xml_str)
    return parsed.toprettyxml(indent="    ")
