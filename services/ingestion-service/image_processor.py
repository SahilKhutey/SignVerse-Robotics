import os
import uuid
import shutil

def process_static_image(image_file, output_dir="uploads/images"):
    '''
    Saves an uploaded static image and prepares it for the perception queue.
    image_file is a FastAPI UploadFile object.
    '''
    os.makedirs(output_dir, exist_ok=True)
    image_id = str(uuid.uuid4())
    
    ext = os.path.splitext(image_file.filename)[1]
    if not ext: ext = ".jpg"
    
    file_path = os.path.join(output_dir, f"{image_id}{ext}")
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image_file.file, buffer)
        
    return file_path
