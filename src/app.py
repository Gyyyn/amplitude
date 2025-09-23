from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
from mutagen import File
import json
import io # New import
import hashlib # New import

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Global variable to store music library path
music_library_path = None
# Global variable for album art cache path
album_art_cache_path = None # New global

@app.route('/api/set_music_folder', methods=['POST'])
def set_music_folder():
    """Endpoint to set the music library path"""
    global music_library_path
    data = request.get_json()
    path = data.get('path')
    
    if not path or not os.path.isdir(path):
        return jsonify({'error': 'Invalid directory path'}), 400
    
    music_library_path = path
    # Set up album art cache path
    global album_art_cache_path # Use global
    album_art_cache_path = os.path.join(music_library_path, '.amplitude_cache', 'album_art')
    os.makedirs(album_art_cache_path, exist_ok=True) # Create the directory if it doesn't exist

    return jsonify({'message': f'Music folder set to: {path}'}), 200

def get_audio_metadata(file_path):
    """Extract audio metadata using mutagen"""
    audio = File(file_path)
    metadata = {
        'title': os.path.basename(file_path),
        'artist': 'Unknown Artist',
        'album': 'Unknown Album',
        'duration': 0,
        'filepath': os.path.relpath(file_path, music_library_path),
        'album_art_url': None # New field
    }

    # Extract available metadata fields
    if audio is not None:
        if 'title' in audio and audio['title']:
            metadata['title'] = str(audio['title'][0])
        elif 'TIT2' in audio and audio['TIT2']:
            metadata['title'] = str(audio['TIT2'][0])
            
        if 'artist' in audio and audio['artist']:
            metadata['artist'] = str(audio['artist'][0])
        elif 'TPE1' in audio and audio['TPE1']:
            metadata['artist'] = str(audio['TPE1'][0])
            
        if 'album' in audio and audio['album']:
            metadata['album'] = str(audio['album'][0])
        elif 'TALB' in audio and audio['TALB']:
            metadata['album'] = str(audio['TALB'][0])
            
        if hasattr(audio.info, 'length'):
            metadata['duration'] = int(audio.info.length)

        # Extract album art
        album_art_data = None
        album_art_mime = None
        
        # Try ID3 (MP3) tags first
        if audio.tags and 'APIC:' in audio.tags:
            for tag in audio.tags.getall('APIC:'):
                if tag.data:
                    album_art_data = tag.data
                    album_art_mime = tag.mime
                    break
        
            
        # Try VorbisComment (FLAC, OGG)
        if album_art_data is None and audio.tags and 'pictures' in audio.tags:
            for pic in audio.tags['pictures']:
                if pic.data:
                    album_art_data = pic.data
                    album_art_mime = pic.mime
                    break

        # If no embedded album art, try to find an external image file in the same directory
        if album_art_data is None:
            audio_file_dir = os.path.dirname(file_path)
            # Common album art filenames and their corresponding MIME types
            potential_covers = {
                'cover.jpg': 'image/jpeg',
                'cover.png': 'image/png',
                'folder.jpg': 'image/jpeg',
                'folder.png': 'image/png',
                'album.jpg': 'image/jpeg',
                'album.png': 'image/png',
            }
            
            for cover_name, mime_type in potential_covers.items():
                cover_path = os.path.join(audio_file_dir, cover_name)
                if os.path.isfile(cover_path):
                    try:
                        with open(cover_path, 'rb') as f:
                            album_art_data = f.read()
                        album_art_mime = mime_type
                        break
                    except Exception as e:
                        print(f"Error reading external album art {cover_path}: {e}")

        if album_art_data and album_art_cache_path:
            # This helps avoid collisions and provides a somewhat descriptive name
            unique_id = hashlib.md5(file_path.encode('utf-8')).hexdigest()
            
            # Sanitize artist and album names for filenames
            artist_safe = ''.join(c if c.isalnum() else '_' for c in metadata['artist'])
            album_safe = ''.join(c if c.isalnum() else '_' for c in metadata['album'])

            filename_base = f"{artist_safe}_{album_safe}_{unique_id}"
            
            # Determine file extension based on MIME type
            ext = 'jpg' # Default
            if album_art_mime:
                if 'jpeg' in album_art_mime or 'jpg' in album_art_mime:
                    ext = 'jpg'
                elif 'png' in album_art_mime:
                    ext = 'png'
                elif 'gif' in album_art_mime:
                    ext = 'gif'
            
            album_art_filename = f"{filename_base}.{ext}"
            album_art_file_path = os.path.join(album_art_cache_path, album_art_filename)

            # Save the album art if it doesn't exist
            if not os.path.exists(album_art_file_path):
                try:
                    with open(album_art_file_path, 'wb') as f:
                        f.write(album_art_data)
                except Exception as e:
                    print(f"Error saving album art for {file_path}: {e}")
                    album_art_filename = None # Don't provide a URL if saving failed
            
            if album_art_filename:
                metadata['album_art_url'] = f'/api/album_art/{album_art_filename}'

    return metadata

@app.route('/api/library', methods=['GET'])
def get_library():
    """Endpoint to retrieve music library"""
    global music_library_path
    if not music_library_path:
        return jsonify({'error': 'Music folder not set'}), 400
    
    music_files = []
    supported_extensions = ['.mp3', '.flac', '.wav', '.ogg', '.m4a']
    
    # Scan directory and subdirectories
    for root, _, files in os.walk(music_library_path):
        for file in files:
            if any(file.lower().endswith(ext) for ext in supported_extensions):
                file_path = os.path.join(root, file)
                metadata = get_audio_metadata(file_path)
                music_files.append(metadata)
                    
    return jsonify(music_files)

@app.route('/api/stream/<path:filepath>')
def stream(filepath):
    """Endpoint to stream audio files"""
    global music_library_path
    if not music_library_path:
        return 'Music folder not set', 400
    
    # Prevent directory traversal attacks
    safe_path = os.path.normpath(filepath)
    if safe_path.startswith('..') or safe_path.startswith('/'):
        return 'Invalid file path', 400
    
    absolute_path = os.path.join(music_library_path, safe_path)
    if not os.path.isfile(absolute_path):
        return 'File not found', 404
    
    return send_file(absolute_path)

# New endpoint for serving album art
@app.route('/api/album_art/<filename>')
def get_album_art(filename):
    """Endpoint to serve album art images"""
    global album_art_cache_path
    if not album_art_cache_path:
        return 'Album art cache not set', 400

    # Prevent directory traversal attacks
    safe_filename = os.path.normpath(filename)
    if safe_filename.startswith('..') or safe_filename.startswith('/'):
        return 'Invalid file path', 400
    
    absolute_path = os.path.join(album_art_cache_path, safe_filename)
    if not os.path.isfile(absolute_path):
        return 'Album art not found', 404
    
    return send_file(absolute_path)

if __name__ == '__main__':
    app.run(debug=True)
