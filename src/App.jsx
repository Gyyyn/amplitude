import React, { useState, useEffect, useRef, useMemo } from 'react';

function MusicPlayer() {
  // State variables
  const [library, setLibrary] = useState([]);
  const [activeView, setActiveView] = useState('setup'); // 'setup' or 'player'
  const [musicFolder, setMusicFolder] = useState(localStorage.getItem('musicFolder') || '');
  const [backendUrl, setBackendUrl] = useState(localStorage.getItem('backendUrl') || 'http://localhost:5000');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [mainView, setMainView] = useState('tracks'); // 'tracks', 'albums', 'artists'

  const audioRef = useRef(null);
  const searchInputRef = useRef(null);

  const albums = useMemo(() => {
    if (mainView !== 'albums' && selectedAlbum === null) return [];
    const albumMap = library.reduce((acc, song) => {
      if (!acc[song.album]) {
        acc[song.album] = {
          name: song.album,
          artist: song.artist,
          album_art_url: song.album_art_url,
          tracks: [],
        };
      }
      acc[song.album].tracks.push(song);
      return acc;
    }, {});
    return Object.values(albumMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [library, mainView, selectedAlbum]);

  const artists = useMemo(() => {
    if (mainView !== 'artists' && selectedArtist === null) return [];
    const artistMap = library.reduce((acc, song) => {
      if (!acc[song.artist]) {
        acc[song.artist] = {
          name: song.artist,
          // Use the art from the first album we find for this artist as a fallback.
          album_art_url: song.album_art_url,
        };
      }
      return acc;
    }, {});
    return Object.values(artistMap).sort((a, b) => a.name.localeCompare(b.name));
  }, [library, mainView, selectedArtist]);

  // Start the player after fetching library
  const startPlayer = (path, url) => {
    fetch(`${url}/api/set_music_folder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    })
    .then(response => {
      if (!response.ok) throw new Error('Error setting folder. Check backend URL and folder path.');
      localStorage.setItem('musicFolder', path);
      localStorage.setItem('backendUrl', url);
      setMusicFolder(path);
      setBackendUrl(url);
      return fetchLibrary(url);
    })
    .then(() => setActiveView('player'))
    .catch(error => {
      console.error('Error:', error);
      alert(error.message); // Provide feedback to the user
    });
  };

  // Effect to load music folder from localStorage on mount
  useEffect(() => {
    const storedFolder = localStorage.getItem('musicFolder');
    const storedUrl = localStorage.getItem('backendUrl');
    if (storedFolder && storedUrl) {
      setMusicFolder(storedFolder);
      setBackendUrl(storedUrl);
      startPlayer(storedFolder, storedUrl);
    }
  }, []);

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

  // Fetch music library from backend
  const fetchLibrary = (url) => {
    return fetch(`${url}/api/library`)
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

  const filteredLibrary = useMemo(() => {
    const lowerCaseQuery = searchQuery.toLowerCase();
    return library.filter(song => {
      const matchesSearch = song.title.toLowerCase().includes(lowerCaseQuery) ||
                            song.artist.toLowerCase().includes(lowerCaseQuery) ||
                            song.album.toLowerCase().includes(lowerCaseQuery);

      const matchesArtist = selectedArtist ? song.artist === selectedArtist : true;
      const matchesAlbum = selectedAlbum ? song.album === selectedAlbum : true;

      return matchesSearch && matchesArtist && matchesAlbum;
    });
  }, [library, searchQuery, selectedArtist, selectedAlbum]);

  // Format time from seconds to MM:SS
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSecs = Math.floor(seconds % 60);
    return `${minutes}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const handleNextTrack = () => {
    if (!currentTrack || filteredLibrary.length === 0) return;

    const currentIndex = filteredLibrary.findIndex(song => song.filepath === currentTrack.filepath);
    const nextIndex = (currentIndex + 1) % filteredLibrary.length;
    
    setCurrentTrack(filteredLibrary[nextIndex]);
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play().catch(e => console.error("Play error:", e)), 100);
  };

  const handlePreviousTrack = () => {
    if (!currentTrack || filteredLibrary.length === 0) return;

    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Play error:", e));
      }
      return;
    }

    const currentIndex = filteredLibrary.findIndex(song => song.filepath === currentTrack.filepath);
    const prevIndex = (currentIndex - 1 + filteredLibrary.length) % filteredLibrary.length;

    setCurrentTrack(filteredLibrary[prevIndex]);
    setIsPlaying(true);
    setTimeout(() => audioRef.current?.play().catch(e => console.error("Play error:", e)), 100);
  };

  const handleSetupSubmit = () => {
    const pathInput = document.getElementById('music-folder-input');
    const urlInput = document.getElementById('backend-url-input');
    if (pathInput.value && urlInput.value) {
      startPlayer(pathInput.value, urlInput.value);
    }
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
                Enter the path to your music library and the backend server address.
              </p>
              <div className="space-y-4">
                <input
                  id="music-folder-input"
                  type="text"
                  defaultValue={musicFolder}
                  placeholder="e.g., /Users/YourName/Music"
                  className="w-full px-4 py-3 bg-white bg-opacity-5 rounded-lg focus:ring-2 focus:ring-green-400 focus:outline-none border border-white border-opacity-10 transition"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSetupSubmit();
                  }}
                />
                <input
                  id="backend-url-input"
                  type="text"
                  defaultValue={backendUrl}
                  placeholder="e.g., http://192.168.1.10:5000"
                  className="w-full px-4 py-3 bg-white bg-opacity-5 rounded-lg focus:ring-2 focus:ring-green-400 focus:outline-none border border-white border-opacity-10 transition"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSetupSubmit();
                  }}
                />
                <button
                  className="w-full py-3 bg-green-500 hover:bg-green-600 rounded-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-green-500/50"
                  onClick={handleSetupSubmit}
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
                      onClick={() => { setMainView('tracks'); setSelectedArtist(null); setSelectedAlbum(null); }}
                      className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${
                        mainView === 'tracks'
                          ? 'bg-green-500 bg-opacity-70 text-white'
                          : 'bg-white bg-opacity-5 hover:bg-opacity-10'
                      }`}
                      title="All Tracks"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2zm12-3c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2z" /></svg>
                      <span>All Tracks</span>
                    </button>
                    <button
                      onClick={() => { setMainView('artists'); setSelectedArtist(null); setSelectedAlbum(null); }}
                      className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${
                        mainView === 'artists'
                          ? 'bg-green-500 bg-opacity-70 text-white'
                          : 'bg-white bg-opacity-5 hover:bg-opacity-10'
                      }`}
                      title="All Artists"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                      <span>All Artists</span>
                    </button>
                    <button
                      onClick={() => { setMainView('albums'); setSelectedArtist(null); setSelectedAlbum(null); }}
                      className={`flex items-center space-x-3 w-full p-3 rounded-lg transition-colors ${
                        mainView === 'albums'
                          ? 'bg-green-500 bg-opacity-70 text-white'
                          : 'bg-white bg-opacity-5 hover:bg-opacity-10'
                      }`}
                      title="All Albums"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M22 13v-2h-2v2h2zm-2-4V7h2v2h-2zm-2-4V3h2v2h-2zM12 3v10.55c-.59-.34-1.27-.55-2-.55c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2s2 .9 2 2s-.9 2-2 2z"/></svg>
                      <span>All Albums</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto p-6">
                {mainView === 'tracks' && (
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
                              <img src={`${backendUrl}${song.album_art_url}`} alt={`${song.album} album art`} className="w-full h-full object-cover"/>
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
                )}

                {mainView === 'albums' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                    {albums.map(album => (
                      <div
                        key={album.name}
                        className="flex md:flex-col bg-white bg-opacity-5 backdrop-blur-md p-4 rounded-2xl cursor-pointer transition-all border border-white border-opacity-10 hover:scale-105 hover:bg-opacity-10"
                        onClick={() => { setSelectedAlbum(album.name); setMainView('tracks'); }}
                      >
                        <div className="relative h-20 w-20 aspect-square md:w-auto md:h-auto md:me-0 rounded-lg mb-4 me-4 overflow-hidden">
                          {album.album_art_url ? (
                            <img src={`${backendUrl}${album.album_art_url}`} alt={`${album.name} album art`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                              <svg className="h-12 w-12 opacity-30" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M22 13v-2h-2v2h2zm-2-4V7h2v2h-2zm-2-4V3h2v2h-2zM12 3v10.55c-.59-.34-1.27-.55-2-.55c-2.21 0-4 1.79-4 4s1.79 4 4 4s4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2s2 .9 2 2s-.9 2-2 2z"/></svg>
                            </div>
                          )}
                        </div>
                        <div className='w-full md:w-auto'>
                          <h3 className="font-semibold truncate">{album.name}</h3>
                          <p className="text-gray-400 text-sm truncate">{album.artist}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {mainView === 'artists' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
                    {artists.map(artist => (
                      <div
                        key={artist.name}
                        className="flex md:flex-col bg-white bg-opacity-5 backdrop-blur-md p-4 rounded-2xl cursor-pointer transition-all border border-white border-opacity-10 hover:scale-105 hover:bg-opacity-10"
                        onClick={() => { setSelectedArtist(artist.name); setMainView('tracks'); }}
                      >
                        <div className="relative h-20 w-20 aspect-square md:w-auto md:h-auto md:me-0 rounded-lg mb-4 me-4 overflow-hidden">
                          {artist.album_art_url ? (
                            <img src={`${backendUrl}${artist.album_art_url}`} alt={`${artist.name} album art`} className="w-full h-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                            </div>
                          )}
                        </div>
                        <div className='w-full md:w-auto'>
                          <h3 className="font-semibold truncate">{artist.name}</h3>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {filteredLibrary.length === 0 && mainView === 'tracks' && (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mb-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <p className="text-2xl font-light">No Results Found</p>
                    <p className="mt-2">Try a different search or filter.</p>
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
                          <img src={`${backendUrl}${currentTrack.album_art_url}`} alt={`${currentTrack.album} album art`} className="w-full h-full object-cover"/>
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
                    <div class="flex items-center space-x-6 mb-2">
                      <button onClick={handlePreviousTrack} title="Previous Track" class="text-gray-300 bg-white bg-opacity-5 hover:bg-opacity-10 hover:text-white transition-colors"><svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"></path></svg></button>
                      <button
                        onClick={togglePlayback}
                        class="bg-green-500 rounded-full p-3 hover:bg-green-600 transition-all transform hover:scale-110 shadow-lg hover:shadow-green-500/50"
                      >
                        {isPlaying ? (
                          <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 19c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2v10c0 1.1.9 2 2 2zm6-12v10c0 1.1.9 2 2 2s2-.9 2-2V7c0-1.1-.9-2-2-2s-2 .9-2 2z"></path></svg>
                        ) : (
                          <svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
                        )}
                      </button>
                      <button onClick={handleNextTrack} title="Next Track" class="text-gray-300 bg-white bg-opacity-5 hover:bg-opacity-10 hover:text-white transition-colors"><svg class="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"></path></svg></button>
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
          src={currentTrack ? `${backendUrl}/api/stream/${encodeURIComponent(currentTrack.filepath)}` : ""}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleNextTrack}
        />
      </div>
    </div>
  );
}

export default MusicPlayer;