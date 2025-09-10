import React, { useState, useEffect, useRef } from 'react';

function MusicPlayer() {
  // State variables
  const [library, setLibrary] = useState([]);
  const [activeView, setActiveView] = useState('setup'); // 'setup' or 'player'
  const [musicFolder, setMusicFolder] = useState(localStorage.getItem('musicFolder') || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [uniqueArtists, setUniqueArtists] = useState([]);
  const [uniqueAlbums, setUniqueAlbums] = useState([]);

  const audioRef = useRef(null);
  const searchInputRef = useRef(null);
  const BACKEND_URL = 'http://127.0.0.1:5000';

  // Start the player after fetching library
  const startPlayer = (path) => {
    fetch(`${BACKEND_URL}/api/set_music_folder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    })
    .then(response => {
      if (!response.ok) throw new Error('Error setting folder');
      localStorage.setItem('musicFolder', path); // Save the path to localStorage
      setMusicFolder(path);
      return fetchLibrary();
    })
    .then(() => setActiveView('player'))
    .catch(error => console.error('Error:', error));
  };

  // Effect to load music folder from localStorage on mount
  useEffect(() => {
    if (musicFolder) {
      startPlayer(musicFolder);
    }
  }, [musicFolder]);

  // Effect for keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Effect to extract unique artists and albums
  useEffect(() => {
    const artists = [...new Set(library.map(song => song.artist))].sort();
    const albums = [...new Set(library.map(song => song.album))].sort();
    setUniqueArtists(artists);
    setUniqueAlbums(albums);
  }, [library]);

  // Fetch music library from backend
  const fetchLibrary = () => {
    return fetch(`${BACKEND_URL}/api/library`)
      .then(response => {
        if (!response.ok) throw new Error('Failed to fetch library');
        return response.json();
      })
      .then(data => {
        setLibrary(data);
        if (!currentTrack && data.length > 0) {
          setCurrentTrack(data[0]);
        }
      });
  };

  // Handle play/pause functionality
  const togglePlayback = () => {
    if (!currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.error('Play error:', e));
    }
    setIsPlaying(!isPlaying);
  };

  // Update progress as audio plays
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  // Handle seeking in track
  const handleSeek = (e) => {
    const seekTime = Number(e.target.value);
    setProgress(seekTime);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
    }
  };

  // Handle volume change
  const handleVolumeChange = (value) => {
    setVolume(value);
    if (audioRef.current) {
      audioRef.current.volume = value;
    }
  };

  // Filter tracks based on search query, selected artist, and selected album
  const filteredLibrary = library.filter(song => {
    const matchesSearch = song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          song.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          song.album.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesArtist = selectedArtist ? song.artist === selectedArtist : true;
    const matchesAlbum = selectedAlbum ? song.album === selectedAlbum : true;

    return matchesSearch && matchesArtist && matchesAlbum;
  });

  // Format time from seconds to MM:SS
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSecs = Math.floor(seconds % 60);
    return `${minutes}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white bg-cover bg-center w-[100vw]">
      <div className="min-h-screen bg-black bg-opacity-50 backdrop-blur-3xl">
        {/* Conditional Setup View */}
        {activeView === 'setup' && (
          <div className="flex flex-col items-center justify-center h-screen p-8">
            <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-lg shadow-2xl border border-white border-opacity-20">
              <div className="flex items-center justify-center mb-6">
                <img src="/logo.jpg" alt="Amplitude Logo" className="h-12 mr-4" />
                <h1 className="text-4xl font-bold text-green-400">Amplitude</h1>
              </div>
              <p className="text-gray-300 text-center mb-8">
                Enter the path to your local music library to begin.
              </p>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="e.g., /Users/YourName/Music"
                  className="w-full px-4 py-3 bg-white bg-opacity-5 rounded-lg focus:ring-2 focus:ring-green-400 focus:outline-none border border-white border-opacity-10 transition"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') startPlayer(e.target.value);
                  }}
                />
                <button
                  className="w-full py-3 bg-green-500 hover:bg-green-600 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-green-500/50"
                  onClick={(e) => startPlayer(e.target.previousElementSibling.value)}
                >
                  Scan Library
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Player View */}
        {activeView === 'player' && (
          <div className="flex flex-col h-screen">
            {/* Top Navigation */}
            <div className="bg-black bg-opacity-20 backdrop-blur-xl p-4 flex-shrink-0 border-b border-white border-opacity-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center justify-center">
                  <img src="/logo.jpg" alt="Amplitude Logo" className="h-8 mr-3" />
                  <h1 className="text-xl font-bold text-green-400">Amplitude</h1>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className="px-3 py-1.5 bg-white bg-opacity-10 rounded-lg hover:bg-opacity-20 transition-colors"
                    title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
                  >
                    {isSidebarOpen ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7"></path></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    )}
                  </button>
                  <button
                    onClick={() => setActiveView('setup')}
                    className="px-3 py-1.5 bg-white bg-opacity-10 rounded-lg hover:bg-opacity-20 transition-colors text-sm"
                  >
                    Change Folder
                  </button>
                </div>
              </div>
              {/* Search Bar */}
              <div className="mt-4">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search for songs, artists, or albums (CMD/CTRL+K to focus)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white bg-opacity-5 rounded-lg placeholder-gray-400 focus:ring-2 focus:ring-green-400 focus:outline-none border border-white border-opacity-10 transition"
                />
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar */}
              <div className={`transform transition-all duration-300 ease-in-out
                          ${isSidebarOpen ? 'w-72 p-6' : 'w-0 p-0 overflow-hidden'}
                          bg-black bg-opacity-10 hidden md:block border-r border-white border-opacity-10`}>
                <div className={`${isSidebarOpen ? 'block' : 'hidden'} overflow-y-auto h-full`}>
                  <div className="space-y-2">
                    <button
                      onClick={() => { setSelectedArtist(null); setSelectedAlbum(null); }}
                      className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${
                        !selectedArtist && !selectedAlbum
                          ? 'bg-green-500 bg-opacity-70 text-white'
                          : 'bg-white bg-opacity-5 hover:bg-opacity-10'
                      }`}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2zm12-3c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2z" /></svg>
                      <span>All Tracks</span>
                    </button>
                  </div>

                  <h2 className="text-xl font-semibold mt-6 mb-4">Artists</h2>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedArtist(null)}
                      className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${
                        !selectedArtist
                          ? 'bg-green-500 bg-opacity-70 text-white'
                          : 'bg-white bg-opacity-5 hover:bg-opacity-10'
                      }`}
                    >
                      <span>All Artists</span>
                    </button>
                    {uniqueArtists.map(artist => (
                      <button
                        key={artist}
                        onClick={() => setSelectedArtist(artist)}
                        className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${
                          selectedArtist === artist
                            ? 'bg-green-500 bg-opacity-70 text-white'
                            : 'bg-white bg-opacity-5 hover:bg-opacity-10'
                        }`}
                      >
                        <span>{artist}</span>
                      </button>
                    ))}
                  </div>

                  <h2 className="text-xl font-semibold mt-6 mb-4">Albums</h2>
                  <div className="space-y-2">
                    <button
                      onClick={() => setSelectedAlbum(null)}
                      className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${
                        !selectedAlbum
                          ? 'bg-green-500 bg-opacity-70 text-white'
                          : 'bg-white bg-opacity-5 hover:bg-opacity-10'
                      }`}
                    >
                      <span>All Albums</span>
                    </button>
                    {uniqueAlbums.map(album => (
                      <button
                        key={album}
                        onClick={() => setSelectedAlbum(album)}
                        className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${
                          selectedAlbum === album
                            ? 'bg-green-500 bg-opacity-70 text-white'
                            : 'bg-white bg-opacity-5 hover:bg-opacity-10'
                        }`}
                      >
                        <span>{album}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Music Library Grid */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                  {filteredLibrary.map((song, index) => (
                    <div
                      key={index}
                      className={`flex md:flex-col bg-white bg-opacity-5 backdrop-blur-md p-4 rounded-2xl cursor-pointer transition-all border border-white border-opacity-10 ${
                        currentTrack?.filepath === song.filepath
                          ? 'ring-2 ring-green-400 scale-105 shadow-lg shadow-green-500/20'
                          : 'hover:scale-105 hover:bg-opacity-10'
                      }`}
                      onClick={() => {
                        setCurrentTrack(song);
                        setIsPlaying(true);
                        setTimeout(() => audioRef.current?.play(), 100);
                      }}
                    >
                      <div className="relative h-20 w-20 aspect-square md:w-auto md:h-auto md:me-0 rounded-lg mb-4 me-4 overflow-hidden">
                        {song.album_art_url ? (
                            <img src={`${BACKEND_URL}${song.album_art_url}`} alt={`${song.album} album art`} className="w-full h-full object-cover"/>
                        ) : (
                            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                                <svg className="h-12 w-12 opacity-30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                            </div>
                        )}
                        {currentTrack?.filepath === song.filepath && isPlaying && (
                          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-teal-500 opacity-70 flex items-center justify-center">
                            <div className="flex space-x-1">
                              <div className="h-12 w-2 bg-white animate-pulse"></div>
                              <div className="h-8 w-2 bg-white animate-pulse animation-delay-200"></div>
                              <div className="h-10 w-2 bg-white animate-pulse animation-delay-100"></div>
                              <div className="h-6 w-2 bg-white animate-pulse animation-delay-300"></div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className='w-full md:w-auto'>
                        <h3 className="font-semibold truncate">{song.title}</h3>
                        <p className="text-gray-400 text-sm truncate">{song.artist}</p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-500">{song.album}</span>
                          <span className="text-sm text-gray-500">{formatTime(song.duration)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredLibrary.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <p className="text-2xl font-light">No Songs Found</p>
                    <p className="mt-2">Try a different search or check your music folder.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Player Controls */}
            <div className="bg-black bg-opacity-30 backdrop-blur-xl border-t border-white border-opacity-10 p-4 flex flex-col">
              {currentTrack ? (
                <div className="flex flex-col md:flex-row items-center">
                  {/* Track Info */}
                  <div className="flex items-center w-full md:w-1/4 mb-4 md:mb-0">
                    <div className="h-14 w-14 rounded-lg mr-3 flex-shrink-0 overflow-hidden">
                      {currentTrack.album_art_url ? (
                          <img src={`${BACKEND_URL}${currentTrack.album_art_url}`} alt={`${currentTrack.album} album art`} className="w-full h-full object-cover"/>
                      ) : (
                          <div className="bg-gray-700 h-full w-full flex items-center justify-center">
                              <svg className="h-8 w-8 opacity-30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                          </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium truncate">{currentTrack.title}</h4>
                      <p className="text-sm text-gray-400 truncate">{currentTrack.artist}</p>
                    </div>
                  </div>

                  {/* Playback Controls */}
                  <div className="flex-1 flex flex-col items-center">
                    <div className="flex items-center space-x-6 mb-2">
                      <button title="Previous Track" className="text-gray-300 bg-white bg-opacity-5 hover:bg-opacity-10 hover:text-white transition-colors"><svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"></path></svg></button>
                      <button
                        onClick={togglePlayback}
                        className="bg-green-500 rounded-full p-3 hover:bg-green-600 transition-all transform hover:scale-110 shadow-lg hover:shadow-green-500/50"
                      >
                        {isPlaying ? (
                          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 1.1.9 2 2 2zm6-12v10c0 1.1.9 2 2 2s2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2z"></path></svg>
                        ) : (
                          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
                        )}
                      </button>
                      <button title="Next Track" className="text-gray-300 bg-white bg-opacity-5 hover:bg-opacity-10 hover:text-white transition-colors"><svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path></svg></button>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full max-w-2xl flex items-center">
                      <span className="text-xs text-gray-400 w-10 text-center">{formatTime(progress)}</span>
                      <input type="range" min="0" max={currentTrack?.duration || 100} value={progress} onChange={handleSeek} className="flex-1 mx-2 h-1.5 rounded-lg appearance-none cursor-pointer bg-white bg-opacity-20 transition" />
                      <span className="text-xs text-gray-400 w-10 text-center">{formatTime(currentTrack?.duration || 0)}</span>
                    </div>
                  </div>

                  {/* Volume Control */}
                  <div className="hidden md:flex items-center justify-end space-x-2 w-1/4">
                    <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>
                    <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => handleVolumeChange(parseFloat(e.target.value))} className="w-24 h-1.5 rounded-lg appearance-none cursor-pointer bg-white bg-opacity-20" />
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-gray-500">
                  Select a song to begin your journey.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hidden audio player */}
        <audio
          ref={audioRef}
          src={currentTrack ? `${BACKEND_URL}/api/stream/${encodeURIComponent(currentTrack.filepath)}` : ""}
          onTimeUpdate={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
        />
      </div>
    </div>
  );
}

export default MusicPlayer;