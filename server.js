
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const musicMetadata = require('music-metadata');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

let musicLibraryPath = null;
let albumArtCachePath = null;

app.post('/api/set_music_folder', async (req, res) => {
  const { path: newPath } = req.body;

  if (!newPath) {
    return res.status(400).json({ error: 'Path is required' });
  }

  try {
    const stats = await fs.stat(newPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Invalid directory path' });
    }
  } catch (error) {
    return res.status(400).json({ error: 'Invalid directory path' });
  }

  musicLibraryPath = newPath;
  albumArtCachePath = path.join(musicLibraryPath, '.amplitude_cache', 'album_art');
  await fs.mkdir(albumArtCachePath, { recursive: true });

  res.json({ message: `Music folder set to: ${newPath}` });
});

const getAudioMetadata = async (filePath) => {
  const metadata = {
    title: path.basename(filePath),
    artist: 'Unknown Artist',
    album: 'Unknown Album',
    duration: 0,
    filepath: path.relative(musicLibraryPath, filePath),
    album_art_url: null,
  };

  try {
    const fileMetadata = await musicMetadata.parseFile(filePath);
    const common = fileMetadata.common;

    metadata.title = common.title || metadata.title;
    metadata.artist = common.artist || metadata.artist;
    metadata.album = common.album || metadata.album;
    metadata.duration = fileMetadata.format.duration ? Math.round(fileMetadata.format.duration) : 0;

    let albumArtData = null;
    let albumArtMime = null;

    if (common.picture && common.picture.length > 0) {
      albumArtData = common.picture[0].data;
      albumArtMime = common.picture[0].format;
    } else {
      const audioFileDir = path.dirname(filePath);
      const potentialCovers = {
        'cover.jpg': 'image/jpeg',
        'cover.png': 'image/png',
        'folder.jpg': 'image/jpeg',
        'folder.png': 'image/png',
        'album.jpg': 'image/jpeg',
        'album.png': 'image/png',
      };

      for (const [coverName, mimeType] of Object.entries(potentialCovers)) {
        const coverPath = path.join(audioFileDir, coverName);
        try {
          await fs.access(coverPath);
          albumArtData = await fs.readFile(coverPath);
          albumArtMime = mimeType;
          break;
        } catch (error) {
          // File doesn't exist, continue
        }
      }
    }

    if (albumArtData && albumArtCachePath) {
      const uniqueId = crypto.createHash('md5').update(filePath).digest('hex');
      const artistSafe = metadata.artist.replace(/[^a-zA-Z0-9]/g, '_');
      const albumSafe = metadata.album.replace(/[^a-zA-Z0-9]/g, '_');
      
      let ext = 'jpg';
      if (albumArtMime) {
        if (albumArtMime.includes('png')) ext = 'png';
        else if (albumArtMime.includes('gif')) ext = 'gif';
      }

      const albumArtFilename = `${artistSafe}_${albumSafe}_${uniqueId}.${ext}`;
      const albumArtFilePath = path.join(albumArtCachePath, albumArtFilename);

      if (!fsSync.existsSync(albumArtFilePath)) {
        await fs.writeFile(albumArtFilePath, albumArtData);
      }
      
      metadata.album_art_url = `/api/album_art/${albumArtFilename}`;
    }
  } catch (error) {
    console.error(`Error reading metadata for ${filePath}:`, error);
  }

  return metadata;
};

app.get('/api/library', async (req, res) => {
  if (!musicLibraryPath) {
    return res.status(400).json({ error: 'Music folder not set' });
  }

  const musicFiles = [];
  const supportedExtensions = ['.mp3', '.flac', '.wav', '.ogg', '.m4a'];

  const walk = async (dir) => {
    const files = await fs.readdir(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        await walk(filePath);
      } else if (supportedExtensions.includes(path.extname(file).toLowerCase())) {
        const metadata = await getAudioMetadata(filePath);
        musicFiles.push(metadata);
      }
    }
  };

  try {
    await walk(musicLibraryPath);
    res.json(musicFiles);
  } catch (error) {
    console.error('Error scanning library:', error);
    res.status(500).json({ error: 'Failed to scan library' });
  }
});

app.get('/api/stream/:filepath(*)', (req, res) => {
  if (!musicLibraryPath) {
    return res.status(400).send('Music folder not set');
  }

  const filepath = req.params.filepath;
  const safePath = path.normalize(filepath).replace(/^(\.\.[/\\])+/, '');
  const absolutePath = path.join(musicLibraryPath, safePath);

  if (!fsSync.existsSync(absolutePath) || !fsSync.statSync(absolutePath).isFile()) {
      return res.status(404).send('File not found');
  }
  
  res.sendFile(absolutePath);
});

app.get('/api/album_art/:filename', (req, res) => {
  if (!albumArtCachePath) {
    return res.status(400).send('Album art cache not set');
  }

  const filename = req.params.filename;
  const safeFilename = path.normalize(filename).replace(/^(\.\.[/\\])+/, '');
  const absolutePath = path.join(albumArtCachePath, safeFilename);

  if (!fsSync.existsSync(absolutePath) || !fsSync.statSync(absolutePath).isFile()) {
    return res.status(404).send('Album art not found');
  }

  res.sendFile(absolutePath);
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
