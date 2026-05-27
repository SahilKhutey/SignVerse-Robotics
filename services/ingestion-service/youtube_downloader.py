import yt_dlp
import os
import uuid

def download_youtube_video(url, output_dir="uploads"):
    os.makedirs(output_dir, exist_ok=True)
    video_id = str(uuid.uuid4())
    output_path = os.path.join(output_dir, f"{video_id}.%(ext)s")
    
    ydl_opts = {
        'format': 'bestvideo[height<=720]+bestaudio/best[height<=720]', # Limit to 720p for speed
        'outtmpl': output_path,
        'merge_output_format': 'mp4',
        'quiet': True,
        'no_warnings': True
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            print(f"Downloading YouTube URL: {url}")
            ydl.download([url])
            
        final_path = os.path.join(output_dir, f"{video_id}.mp4")
        if os.path.exists(final_path):
            return final_path
        else:
            raise Exception("File downloaded but mp4 not found")
            
    except Exception as e:
        print(f"Error downloading YouTube video: {e}")
        return None
