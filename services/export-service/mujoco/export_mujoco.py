import xml.etree.ElementTree as ET
import xml.dom.minidom

def generate_mujoco_xml(robot_profile):
    mujoco = ET.Element('mujoco', model=robot_profile.get("robot_name", "humanoid"))
    
    compiler = ET.SubElement(mujoco, 'compiler', angle='degree', coordinate='local')
    option = ET.SubElement(mujoco, 'option', gravity='0 0 -9.81')
    
    worldbody = ET.SubElement(mujoco, 'worldbody')
    ET.SubElement(worldbody, 'light', diffuse='.5 .5 .5', pos='0 0 3', dir='0 0 -1')
    ET.SubElement(worldbody, 'geom', type='plane', size='10 10 0.1', rgba='.9 .9 .9 1')
    
    # Construct base root body
    root = ET.SubElement(worldbody, 'body', name='root', pos='0 0 1')
    ET.SubElement(root, 'geom', type='capsule', size='0.1 0.2', rgba='0.8 0.2 0.2 1')
    
    # Very basic serialization of remaining joints could occur here.
    
    xml_str = ET.tostring(mujoco, encoding='utf-8')
    parsed = xml.dom.minidom.parseString(xml_str)
    return parsed.toprettyxml(indent="    ")
