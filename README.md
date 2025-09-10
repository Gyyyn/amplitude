# Amplitude

Amplitude is a full-stack local music player application. It features a React frontend and a Flask backend to provide a seamless music listening experience.

**Key features include:**

*   **Music Library Management:** Users can set a local directory as their music folder. The application scans this folder and its subdirectories to build a comprehensive music library, extracting metadata such as title, artist, album, and duration from various audio file formats (MP3, FLAC, WAV, OGG, M4A).
*   **Intuitive User Interface:** The React frontend offers a clean and responsive interface for browsing and playing music. It includes a setup view for initially configuring the music folder and a main player view.
*   **Playback Controls:** Users can play, pause, seek within tracks, and adjust the volume.
*   **Search and Filtering:** The application allows users to search for songs, artists, or albums using a search bar. Additionally, a sidebar provides options to filter the music library by unique artists and albums, enhancing discoverability.
*   **Audio Streaming:** The Flask backend handles the streaming of audio files from the user's local music folder to the frontend player.

This project essentially provides a self-hosted solution for managing and playing a local music collection with a modern web interface.

## Installation

To set up the project locally, follow these steps:

1. Clone the repository
2. Install the dependencies:

```bash
npm install
```

3. Setup the venv (optional, but recommended):

```bash
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

4. Install Python requirements

```bash
pip install -r requirements.txt
```

5. Run the project:

## Usage

### Development Server

To run the development server, start both the Flask server and the Frontend React app:

```bash
# Make sure venv is activated
python src/app.py
npm start
```