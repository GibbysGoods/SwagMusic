/* ─────────────────────────────
   current app.jsx
───────────────────────────── */

import { useEffect, useRef, useState } from 'react'

import './App.css'

import QueuePanel from './components/QueuePanel'

import SearchResult from './components/SearchResult'

const API_URL = ''

const GUILD_ID = import.meta.env.VITE_DISCORD_GUILD_ID

function App() {
  const [searchQuery, setSearchQuery] = useState('')

  const [queue, setQueue] = useState([])

  const [currentTrack, setCurrentTrack] = useState(null)

  const [playbackPosition, setPlaybackPosition] = useState(0)

  const [playbackDuration, setPlaybackDuration] = useState(0)

  const [paused, setPaused] = useState(false)

  const [apiStatus, setApiStatus] = useState('checking')

  const [searchResults, setSearchResults] = useState([])

  const [searchFocused, setSearchFocused] = useState(false)

  const [playlists, setPlaylists] = useState([])

  const [activePanel, setActivePanel] = useState('queue')

  const [selectedPlaylist, setSelectedPlaylist] = useState(null)

  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false)

  const [newPlaylistName, setNewPlaylistName] = useState('')

  const [playlistTracks, setPlaylistTracks] = useState([])

  const [draggedTrackId, setDraggedTrackId] = useState(null)

  const playlistItemRefs = useRef(new Map())
  const playlistDragRef = useRef(null)

  const [playlistDragState, setPlaylistDragState] = useState(null)
  const [stickyPlaylist, setStickyPlaylist] = useState(null)
  const [playlistNotification, setPlaylistNotification] = useState(null)
  const [playlistPickerOpen, setPlaylistPickerOpen] = useState(false)
  const [playlistTrackToAdd, setPlaylistTrackToAdd] = useState(null)
  const [lastAddedPlaylistTrack, setLastAddedPlaylistTrack] = useState(null)
  const [playlistAddConfirmOpen, setPlaylistAddConfirmOpen] = useState(false)
  const [playlistPlayConfirmOpen, setPlaylistPlayConfirmOpen] = useState(false)
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(false)

  const [renamePlaylistOpen, setRenamePlaylistOpen] = useState(false)

  const [renamePlaylistName, setRenamePlaylistName] = useState('')

  const [deletePlaylistConfirmOpen, setDeletePlaylistConfirmOpen] = useState(false)

  const searchWrapperRef = useRef(null)

  const [showBackToTop, setShowBackToTop] = useState(false)

  const nowPlayingRef = useRef(null)

  const [authUser, setAuthUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((response) => response.json())
      .then((data) => {
        setApiStatus(data.status)
      })
      .catch(() => {
        setApiStatus('offline')
      })
  }, [])

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`)
        const data = await response.json()

        if (response.ok && data.authenticated) {
          setAuthUser(data.user)
        } else {
          setAuthUser(null)
        }
      } catch (error) {
        console.error('[AUTH] Failed to check session:', error)
        setAuthUser(null)
      } finally {
        setAuthLoading(false)
      }
    }

  checkAuth()
}, [])

  useEffect(() => {
    loadQueue()
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchMusic(searchQuery)
    }, 300)

    return () => {
      clearTimeout(timer)
    }
  }, [searchQuery])

  useEffect(() => {
    const interval = setInterval(() => {
      loadQueue()
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!authUser) {
      setPlaylists([])
      setSelectedPlaylist(null)
      setPlaylistTracks([])
      return
    }

    loadPlaylists()

    const interval = setInterval(() => {
      loadPlaylists()
    }, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [authUser])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchWrapperRef.current &&
        !searchWrapperRef.current.contains(event.target)
      ) {
        setSearchFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      )
    }
  }, [])


  const loadQueue = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/player/${GUILD_ID}/queue`
      )

      const data = await response.json()

      if (!response.ok) {
        console.error('[QUEUE] Failed to load queue:', data)
        return
      }

      setCurrentTrack(data.currentTrack)
      setPlaybackPosition(data.position ?? 0)
      setPlaybackDuration(data.duration ?? 0)
      setPaused(data.paused ?? false)
      setQueue(data.queue)
    } catch (error) {
      console.error(
        '[QUEUE] Failed to connect to API:',
        error
      )
    }
  }

  const createNewPlaylist = async () => {
    const name = newPlaylistName.trim()

    if (!name || !authUser) {
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('[PLAYLISTS] Failed to create playlist:', data)
        return
      }

      setPlaylists((currentPlaylists) => [
        ...currentPlaylists,
        data.playlist,
      ])

      setSelectedPlaylist(data.playlist)
      setPlaylistTracks([])
      setNewPlaylistName('')
      setCreatePlaylistOpen(false)
    } catch (error) {
      console.error(
        '[PLAYLISTS] Failed to connect to API:',
        error
      )
    }
  }

  const renameSelectedPlaylist = async () => {
    const name = renamePlaylistName.trim()

    if (!selectedPlaylist || !name) {
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/api/playlists/${selectedPlaylist.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error(
          '[PLAYLIST] Failed to rename playlist:',
          data
        )
        return
      }

      setPlaylists((currentPlaylists) =>
        currentPlaylists.map((playlist) =>
          playlist.id === data.playlist.id
            ? data.playlist
            : playlist
        )
      )

      setSelectedPlaylist(data.playlist)
      setRenamePlaylistName('')
      setRenamePlaylistOpen(false)
    } catch (error) {
      console.error(
        '[PLAYLIST] Failed to connect to API:',
        error
      )
    }
  }

  const deleteSelectedPlaylist = async () => {
    if (!selectedPlaylist) {
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/api/playlists/${selectedPlaylist.id}`,
        {
          method: 'DELETE',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error(
          '[PLAYLIST] Failed to delete playlist:',
          data
        )
        return
      }

      const deletedPlaylistId = selectedPlaylist.id

      setPlaylists((currentPlaylists) =>
        currentPlaylists.filter(
          (playlist) => playlist.id !== deletedPlaylistId
        )
      )

      setSelectedPlaylist(null)
      setPlaylistTracks([])
      setDeletePlaylistConfirmOpen(false)
    } catch (error) {
      console.error(
        '[PLAYLIST] Failed to connect to API:',
        error
      )
    }
  }

  const loadPlaylists = async () => {
    if (!authUser) {
      setPlaylists([])
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/api/users/${authUser.id}/playlists`
      )

      const data = await response.json()

      if (!response.ok) {
        console.error('[PLAYLISTS] Failed to load playlists:', data)
        return
      }

      setPlaylists(data.playlists)
    } catch (error) {
      console.error(
        '[PLAYLISTS] Failed to connect to API:',
        error
      )
    }
  }

  const loadPlaylistTracks = async (playlistId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/playlists/${playlistId}/tracks`
      )

      const data = await response.json()

      if (!response.ok) {
        console.error(
          '[PLAYLIST] Failed to load tracks:',
          data
        )
        return
      }

      setPlaylistTracks(data.tracks)
    } catch (error) {
      console.error(
        '[PLAYLIST] Failed to connect to API:',
        error
      )
    }
  }

  const searchMusic = async (query) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/api/search?q=${encodeURIComponent(query)}&guildId=${encodeURIComponent(GUILD_ID)}`
      )

      const data = await response.json()

      if (!response.ok) {
        console.error('[SEARCH] Failed to search:', data)
        setSearchResults([])
        return
      }

      setSearchResults(data.results)
    } catch (error) {
      console.error(
        '[SEARCH] Failed to connect to API:',
        error
      )

      setSearchResults([])
    }
  }

  const moveQueueTrack = async (fromIndex, toIndex) => {
    if (
      !Number.isInteger(fromIndex) ||
      !Number.isInteger(toIndex) ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= queue.length ||
      toIndex >= queue.length ||
      fromIndex === toIndex
    ) {
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/api/player/${GUILD_ID}/queue`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fromIndex,
            toIndex,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error('[QUEUE] Failed to move track:', data)
        return
      }

      await loadQueue()
    } catch (error) {
      console.error(
        '[QUEUE] Failed to connect to API:',
        error
      )
    }
  }

  const removeQueueTrack = async (index) => {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= queue.length
    ) {
      return
    }

    try {
      const response = await fetch(
        `${API_URL}/api/player/${GUILD_ID}/queue`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            index,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error('[QUEUE] Failed to remove track:', data)
        return
      }

      await loadQueue()
    } catch (error) {
      console.error(
        '[QUEUE] Failed to connect to API:',
        error
      )
    }
  }

  const addToQueue = async (track) => {
    try {
      const response = await fetch(
        `${API_URL}/api/player/${GUILD_ID}/queue`,
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
          },

          body: JSON.stringify({
            query: `${track.artist} ${track.title}`,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error('[QUEUE] Failed to add track:', data)
        return
      }

      console.log('[QUEUE] Added track:', data)

      await loadQueue()
    } catch (error) {
      console.error(
        '[QUEUE] Failed to connect to API:',
        error
      )
    }
  }

  const addPlaylistTrackToQueue = async (track) => {
    try {
      const response = await fetch(
        `${API_URL}/api/player/${GUILD_ID}/queue`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: track.uri,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error(
          '[PLAYLIST] Failed to add track to queue:',
          data
        )
        return
      }

      console.log('[PLAYLIST] Added track:', data)

      await loadQueue()
    } catch (error) {
      console.error(
        '[PLAYLIST] Failed to connect to API:',
        error
      )
    }
  }

  const addPlaylistToQueue = async () => {
    if (!playlistTracks.length) {
      return
    }

    try {
      for (const track of playlistTracks) {
        const response = await fetch(
          `${API_URL}/api/player/${GUILD_ID}/queue`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: track.uri,
            }),
          }
        )

        const data = await response.json()

        if (!response.ok) {
          console.error(
            '[PLAYLIST] Failed to add playlist track:',
            data
          )

          return
        }
      }

      await loadQueue()
    } catch (error) {
      console.error(
        '[PLAYLIST] Failed to add playlist to queue:',
        error
      )
    } finally {
      setPlaylistAddConfirmOpen(false)
    }
  }

  const playPlaylist = async () => {
    if (!playlistTracks.length) {
      return
    }

    try {
      setPlaylistPlayConfirmOpen(false)

      const stopResponse = await fetch(
        `${API_URL}/api/player/${GUILD_ID}/stop`,
        {
          method: 'POST',
        }
      )

      const stopData = await stopResponse.json()

      if (!stopResponse.ok) {
        console.error(
          '[PLAYLIST] Failed to clear current player:',
          stopData
        )

        return
      }

      for (const track of playlistTracks) {
        const response = await fetch(
          `${API_URL}/api/player/${GUILD_ID}/queue`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: track.uri,
            }),
          }
        )

        const data = await response.json()

        if (!response.ok) {
          console.error(
            '[PLAYLIST] Failed to add playlist track:',
            data
          )

          return
        }
      }

      await loadQueue()
    } catch (error) {
      console.error(
        '[PLAYLIST] Failed to play playlist:',
        error
      )
    } finally {
      setPlaylistPlayConfirmOpen(false)
    }
  }

  const handlePlayPlaylist = () => {
    if (!playlistTracks.length) {
      return
    }

    setPlaylistPlayConfirmOpen(true)
  }

  const handleAddPlaylistToQueue = () => {
    if (!playlistTracks.length) {
      return
    }

    if (playlistTracks.length > 10) {
      setPlaylistAddConfirmOpen(true)
      return
    }

    addPlaylistToQueue()
  }

  const addSearchTrackToPlaylist = async (
    track,
    playlist
  ) => {
    if (!playlist) {
      return false
    }

    try {
      const response = await fetch(
        `${API_URL}/api/playlists/${playlist.id}/tracks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: track.title,
            artist: track.artist ?? null,
            album: track.album ?? null,
            artworkUrl: track.artwork ?? null,
            uri: track.uri,
            duration: track.duration ?? 0,
          }),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error(
          '[PLAYLIST] Failed to add search result:',
          data
        )

        return false
      }

      console.log(
        '[PLAYLIST] Added search result:',
        data
      )

      setStickyPlaylist(playlist)

      setLastAddedPlaylistTrack({
        trackId: data.track.id,
        playlistId: playlist.id,
        track,
      })

      setPlaylistNotification({
        trackTitle: track.title,
        playlistName: playlist.name,
      })

      setTimeout(() => {
        setPlaylistNotification(null)
      }, 4000)

      setPlaylistPickerOpen(false)

      return true
    } catch (error) {
      console.error(
        '[PLAYLIST] Failed to connect to API:',
        error
      )

      return false
    }
  }

  const handleAddSearchTrackToPlaylist = async (
    track,
    playlist = null
  ) => {
    if (playlist) {
      await addSearchTrackToPlaylist(
        track,
        playlist
      )

      return
    }

    if (stickyPlaylist) {
      await addSearchTrackToPlaylist(
        track,
        stickyPlaylist
      )

      return
    }

    setPlaylistTrackToAdd(track)
    setPlaylistPickerOpen(true)
  }

  const handleSelectStickyPlaylist = async (
    playlist
  ) => {
    if (!playlistTrackToAdd) {
      setStickyPlaylist(playlist)
      setPlaylistPickerOpen(false)
      return
    }

    await addSearchTrackToPlaylist(
      playlistTrackToAdd,
      playlist
    )

    setPlaylistTrackToAdd(null)
  }

  const handleChangeStickyPlaylist = () => {
    setPlaylistTrackToAdd(null)
    setPlaylistPickerOpen(true)
  }

  const moveLastAddedTrackToPlaylist = async (
    playlist
  ) => {
    if (!lastAddedPlaylistTrack) {
      setStickyPlaylist(playlist)
      setPlaylistPickerOpen(false)
      return
    }

    const {
      trackId,
      playlistId,
      track,
    } = lastAddedPlaylistTrack

    if (playlist.id === playlistId) {
      setStickyPlaylist(playlist)
      setPlaylistPickerOpen(false)
      return
    }

    try {
      const deleteResponse = await fetch(
        `${API_URL}/api/playlists/${playlistId}/tracks/${trackId}`,
        {
          method: 'DELETE',
        }
      )

      const deleteData =
        await deleteResponse.json()

      if (!deleteResponse.ok) {
        console.error(
          '[PLAYLIST] Failed to remove track from old playlist:',
          deleteData
        )
        return
      }

      const addResponse = await fetch(
        `${API_URL}/api/playlists/${playlist.id}/tracks`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: track.title,
            artist: track.artist ?? null,
            album: track.album ?? null,
            artworkUrl: track.artwork ?? null,
            uri: track.uri,
            duration: track.duration ?? 0,
          }),
        }
      )

      const addData =
        await addResponse.json()

      if (!addResponse.ok) {
        console.error(
          '[PLAYLIST] Failed to add track to new playlist:',
          addData
        )
        return
      }

      setStickyPlaylist(playlist)

      setLastAddedPlaylistTrack({
        trackId: addData.track.id,
        playlistId: playlist.id,
        track,
      })

      setPlaylistNotification({
        trackTitle: track.title,
        playlistName: playlist.name,
      })

      setPlaylistPickerOpen(false)

      setTimeout(() => {
        setPlaylistNotification(null)
      }, 4000)
    } catch (error) {
      console.error(
        '[PLAYLIST] Failed to move track:',
        error
      )
    }
  }

  const removePlaylistTrack = async (trackId) => {
    try {
      const response = await fetch(
        `${API_URL}/api/playlists/${selectedPlaylist.id}/tracks/${trackId}`,
        {
          method: 'DELETE',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error(
          '[PLAYLIST] Failed to remove track:',
          data
        )
        return
      }

      setPlaylistTracks((tracks) =>
        tracks.filter((track) => track.id !== trackId)
      )
    } catch (error) {
      console.error(
        '[PLAYLIST] Failed to connect to API:',
        error
      )
    }
  }

const getPlaylistTargetIndex = (
  pointerY,
  draggedIndex
) => {
  const otherItems = playlistTracks
    .map((track, index) => ({
      track,
      index,
      element: playlistItemRefs.current.get(
        index
      ),
    }))
    .filter(
      ({ index, element }) =>
        index !== draggedIndex && element
    )

  for (const item of otherItems) {
    const rect =
      item.element.getBoundingClientRect()

    const midpoint =
      rect.top + rect.height / 2

    if (pointerY < midpoint) {
      return item.index
    }
  }

  return playlistTracks.length - 1
}

const handlePlaylistPointerDown = (
  event,
  index
) => {
  if (event.button !== 0) {
    return
  }

  const element = event.currentTarget
  const rect = element.getBoundingClientRect()

  const offsetX =
    event.clientX - rect.left

  const offsetY =
    event.clientY - rect.top

  playlistDragRef.current = {
    index,
    offsetX,
    offsetY,
    x: event.clientX,
    y: event.clientY,
    targetIndex: index,
  }

  element.setPointerCapture(event.pointerId)

  setDraggedTrackId(
    playlistTracks[index]?.id ?? null
  )

  setPlaylistDragState({
    index,
    x: event.clientX,
    y: event.clientY,
    offsetX,
    offsetY,
    width: rect.width,
    height: rect.height,
    targetIndex: index,
  })

  document.body.style.userSelect = 'none'
}

const handlePlaylistPointerMove = (
  event
) => {
  const drag =
    playlistDragRef.current

  if (!drag) {
    return
  }

  const targetIndex =
    getPlaylistTargetIndex(
      event.clientY,
      drag.index
    )

  drag.x = event.clientX
  drag.y = event.clientY
  drag.targetIndex = targetIndex

  setPlaylistDragState({
    index: drag.index,
    x: drag.x,
    y: drag.y,
    offsetX: drag.offsetX,
    offsetY: drag.offsetY,
    width:
      playlistDragState?.width ?? 0,
    height:
      playlistDragState?.height ?? 0,
    targetIndex,
  })
}

  const handlePlaylistPointerUp = async (
    event
  ) => {
    const drag =
      playlistDragRef.current

    if (!drag) {
      return
    }

    const fromIndex = drag.index
    const toIndex = drag.targetIndex

    playlistDragRef.current = null
    document.body.style.userSelect = ''

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      )
    } catch {
      // Pointer capture may already be released.
    }

    setPlaylistDragState(null)
    setDraggedTrackId(null)

    if (
      Number.isInteger(toIndex) &&
      fromIndex !== toIndex
    ) {
      const reorderedTracks = [
        ...playlistTracks,
      ]

      const [draggedTrack] =
        reorderedTracks.splice(
          fromIndex,
          1
        )

      reorderedTracks.splice(
        toIndex,
        0,
        draggedTrack
      )

      setPlaylistTracks(
        reorderedTracks
      )

      await movePlaylistTrack(
        draggedTrack.id,
        toIndex + 1
      )
    }
  }

  const movePlaylistTrack = async (trackId, newPosition) => {
  try {
    const response = await fetch(
      `${API_URL}/api/playlists/${selectedPlaylist.id}/tracks/${trackId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          position: newPosition,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error(
        '[PLAYLIST] Failed to move track:',
        data
      )
      return
    }

    await loadPlaylistTracks(selectedPlaylist.id)
  } catch (error) {
    console.error(
      '[PLAYLIST] Failed to connect to API:',
      error
    )
  }
}

  const togglePause = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/player/${GUILD_ID}/pause`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error(
          '[PLAYER] Failed to pause/resume:',
          data
        )
        return
      }

      setPaused(data.paused)
    } catch (error) {
      console.error(
        '[PLAYER] Failed to connect to API:',
        error
      )
    }
  }

  const skipTrack = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/player/${GUILD_ID}/skip`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error(
          '[PLAYER] Failed to skip track:',
          data
        )
        return
      }

      console.log('[PLAYER] Skipped track:', data)

      await loadQueue()
    } catch (error) {
      console.error(
        '[PLAYER] Failed to connect to API:',
        error
      )
    }
  }

  const backTrack = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/player/${GUILD_ID}/back`,
        {
          method: 'POST',
        }
      )

      const data = await response.json()

      if (!response.ok) {
        console.error(
          '[PLAYER] Failed to go back:',
          data
        )
        return
      }

      console.log('[PLAYER] Went back:', data)

      await loadQueue()
    } catch (error) {
      console.error(
        '[PLAYER] Failed to connect to API:',
        error
      )
    }
  }

  const progressPercentage =
    playbackDuration > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (playbackPosition / playbackDuration) * 100
          )
        )
      : 0

  const formatTime = (milliseconds) => {
      const totalSeconds = Math.floor(
          Math.max(0, milliseconds ?? 0) / 1000
      )

      const minutes = Math.floor(
          totalSeconds / 60
      )

      const seconds = String(
          totalSeconds % 60
      ).padStart(2, '0')

      return `${minutes}:${seconds}`
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">♫</div>

          <span>SwagMusic /Web</span>
        </div>

        <button
          className="profile-button"
          type="button"
          onClick={async () => {
            if (!authUser) {
              window.location.href = `${API_URL}/auth/discord`
              return
            }

            try {
              const response = await fetch(`${API_URL}/api/auth/logout`, {
                method: 'POST',
              })

              if (response.ok) {
                setAuthUser(null)
              }
            } catch (error) {
              console.error('[AUTH] Logout failed:', error)
            }
          }}
        >
          <div className="profile-avatar">
            {authUser?.username?.charAt(0)?.toUpperCase() || 'J'}
          </div>

          <span>{authUser ? authUser.username : 'Login with Discord'}</span>
        </button>
      </header>

      <main className="main-content">
        {/* ─────────────────────────────
            Hero / Search
        ───────────────────────────── */}

        <section className="hero-section">
          <p className="eyebrow">YOUR MUSIC</p>

          <h1>
            Swag
            <br />
            Music.
          </h1>

          <p className="hero-description">
            Search for music, build playlists, and listen together.
          </p>

          <div
            className="search-wrapper"
            ref={searchWrapperRef}
          >
            <div
              className={`search-container ${
                searchQuery ? 'has-value' : ''
              }`}
            >
              <span className="search-icon">⌕</span>

              <input
                type="text"
                placeholder="Search for songs, artists, or albums..."
                aria-label="Search for songs, artists, or albums"
                value={searchQuery}
                onFocus={() => {
                  setSearchFocused(true)
                }}
                onChange={(event) => {
                  const value = event.target.value

                  setSearchQuery(value)
                  setSearchFocused(true)
                }}
              />

              <kbd>⌘ K</kbd>
            </div>

            {searchFocused && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map((track, index) => (
                  <SearchResult
                    key={`${track.title}-${index}`}
                    title={track.title}
                    artist={track.artist}
                    album={track.album}
                    artwork={track.artwork}
                    uri={track.uri}
                    duration={track.duration}
                    playlists={playlists}
                    stickyPlaylist={stickyPlaylist}
                    onAdd={addToQueue}
                    onAddToPlaylist={handleAddSearchTrackToPlaylist}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ─────────────────────────────
            Now Playing
        ───────────────────────────── */}

        <div
            className="now-playing"
            ref={nowPlayingRef}
        >
          {currentTrack?.artwork && (
            <div className="now-playing-art">
              <img
                src={currentTrack.artwork}
                alt=""
              />
            </div>
          )}

          {currentTrack?.artwork && (
            <div className="now-playing-cover">
              <img
                src={currentTrack.artwork}
                alt=""
              />
            </div>
          )}

          <div className="now-playing-overlay" />

          <div className="now-playing-content">
            <div className="now-playing-info">
              {currentTrack ? (
                <>
                  <strong>{currentTrack.title}</strong>

                  <span>{currentTrack.artist}</span>
                </>
              ) : (
                <>
                  <strong>Nothing playing</strong>

                  <span>Add a song to get started</span>
                </>
              )}
            </div>

            <div className="player-controls">
              <button
                type="button"
                aria-label="Previous track"
                onClick={backTrack}
              >
                ◀◀
              </button>

              <button
                className="play-button"
                type="button"
                aria-label={
                  paused
                    ? 'Resume playback'
                    : 'Pause playback'
                }
                onClick={togglePause}
              >
                {paused ? '▶' : 'Ⅱ'}
              </button>

              <button
                type="button"
                aria-label="Next track"
                onClick={skipTrack}
              >
                ▶▶
              </button>
            </div>

            <div className="player-progress">
              <div className="player-progress-track">
                <div
                  className="player-progress-fill"
                  style={{
                    width: `${progressPercentage}%`,
                    transition: paused
                      ? 'none'
                      : 'width 1000ms linear',
                  }}
                />
              </div>
            </div>

            <div className="player-time">
                <span>{formatTime(playbackPosition)}</span>
                <span>/</span>
                <span>{formatTime(playbackDuration)}</span>
            </div>

          </div>
        </div>

        {/* ─────────────────────────────
            Queue / Playlists
        ───────────────────────────── */}

        <div className="media-panel-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activePanel === 'queue'}
            className={`media-panel-tab ${
              activePanel === 'queue' ? 'active' : ''
            }`}
            onClick={() => setActivePanel('queue')}
          >
            Queue
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activePanel === 'playlists'}
            className={`media-panel-tab ${
              activePanel === 'playlists' ? 'active' : ''
            }`}
            onClick={() => setActivePanel('playlists')}
          >
            Playlists
          </button>
        </div>

        <div className="media-panel">

          {/* ─────────────────────────────
              Queue
          ───────────────────────────── */}

        <section
          className={`media-panel-view ${
            activePanel === 'queue' ? 'is-active' : ''
          }`}
          aria-hidden={activePanel !== 'queue'}
        >
          <div className="media-panel-content">
            <QueuePanel
              queue={queue}
              onMoveTrack={moveQueueTrack}
              onRemoveTrack={removeQueueTrack}
            />
          </div>
        </section>

          {/* ─────────────────────────────
              Playlists
          ───────────────────────────── */}

          <section
            className={`media-panel-view ${
              activePanel === 'playlists' ? 'is-active' : ''
            }`}
            aria-hidden={activePanel !== 'playlists'}
          >
            <div className="media-panel-content">

            {/* ─────────────────────────────
                Library
            ───────────────────────────── */}

            <section className="library-section">

              <div className="section-header">

                <h2>Your playlists</h2>

                <button
                  className="text-button"
                  type="button"
                >
                  View all
                </button>

              </div>

              <div className="playlist-grid">

                {playlists.map((playlist) => (

                  <button
                    key={playlist.id}
                    className="playlist-card"
                    type="button"
                    onClick={() => {
                      setSelectedPlaylist(playlist)
                      loadPlaylistTracks(playlist.id)
                    }}
                  >

                    <div className="playlist-card-art">
                      <span>♫</span>
                    </div>

                    <div className="playlist-card-info">
                      <strong>{playlist.name}</strong>
                      <span>Playlist</span>
                    </div>

                  </button>

                ))}

                <button
                  className="create-playlist"
                  type="button"
                  onClick={() => {
                    setNewPlaylistName('')
                    setCreatePlaylistOpen(true)
                  }}
                >
                  <span className="create-icon">+</span>
                  <span>Create playlist</span>
                </button>

              </div>

            </section>

            {selectedPlaylist && (

              <section className="playlist-view">

                <div className="playlist-header">

                  <div>

                    <p className="section-label">
                      PLAYLIST
                    </p>

                    <h2>{selectedPlaylist.name}</h2>

                  </div>

                  <div className="playlist-actions">

                    <button
                      type="button"
                      className="playlist-action playlist-action-secondary"
                      onClick={() => handleAddPlaylistToQueue()}
                    >
                      Add to Queue
                    </button>

                    <button
                      type="button"
                      className="playlist-action playlist-action-primary"
                      onClick={() => handlePlayPlaylist()}
                    >
                      Play Playlist
                    </button>

                    <button
                      type="button"
                      className="playlist-menu-button"
                      aria-label="Playlist options"
                      aria-expanded={playlistMenuOpen}
                      onClick={() => {
                        setPlaylistMenuOpen((open) => !open)
                      }}
                    >
                      <span />
                      <span />
                      <span />
                    </button>

                    {playlistMenuOpen && (

                      <div className="playlist-menu">

                        <button
                          type="button"
                          className="playlist-menu-item"
                          onClick={() => {
                            setRenamePlaylistName(
                              selectedPlaylist?.name ?? ''
                            )
                            setPlaylistMenuOpen(false)
                            setRenamePlaylistOpen(true)
                          }}
                        >
                          <span>Rename</span>
                        </button>

                        <button
                          type="button"
                          className="playlist-menu-item playlist-menu-item-danger"
                          onClick={() => {
                            setPlaylistMenuOpen(false)
                            setDeletePlaylistConfirmOpen(true)
                          }}
                        >
                          <span>Delete</span>
                        </button>

                      </div>

                    )}

                  </div>

                </div>

                {playlistAddConfirmOpen && (

                  <div className="playlist-add-confirm">

                    <span>Are you sure?</span>

                    <div className="playlist-add-confirm-actions">

                      <button
                        type="button"
                        className="playlist-add-confirm-cancel"
                        onClick={() =>
                          setPlaylistAddConfirmOpen(false)
                        }
                        aria-label="Cancel adding playlist to queue"
                      >
                        ×
                      </button>

                      <button
                        type="button"
                        className="playlist-add-confirm-accept"
                        onClick={addPlaylistToQueue}
                        aria-label="Confirm adding playlist to queue"
                      >
                        ✓
                      </button>

                    </div>

                  </div>

                )}

                <div className="playlist-tracks">

                  {playlistTracks.map((track, index) => (

                    <div
                      key={track.id}
                      ref={(element) => {

                        if (element) {

                          playlistItemRefs.current.set(
                            index,
                            element
                          )

                        } else {

                          playlistItemRefs.current.delete(
                            index
                          )

                        }

                      }}
                      className={`playlist-track ${
                        draggedTrackId === track.id
                          ? 'dragging'
                          : ''
                      }`}
                      style={
                        playlistDragState?.index === index
                          ? {
                              position: 'fixed',
                              left:
                                playlistDragState.x -
                                playlistDragState.offsetX,
                              top:
                                playlistDragState.y -
                                playlistDragState.offsetY,
                              width:
                                playlistDragState.width,
                              height:
                                playlistDragState.height,
                              zIndex: 1000,
                              pointerEvents: 'none',
                              cursor: 'grabbing',
                              transition: 'none',
                              transform: 'scale(1.02)',
                            }
                          : undefined
                      }
                      onPointerDown={(event) =>
                        handlePlaylistPointerDown(
                          event,
                          index
                        )
                      }
                      onPointerMove={
                        handlePlaylistPointerMove
                      }
                      onPointerUp={
                        handlePlaylistPointerUp
                      }
                      onPointerCancel={
                        handlePlaylistPointerUp
                      }
                    >

                      <div className="playlist-track-button">

                        <div className="playlist-track-art">

                          {track.artwork_url && (

                            <img
                              src={track.artwork_url}
                              alt=""
                            />

                          )}

                        </div>

                        <div className="playlist-track-info">

                          <strong>{track.title}</strong>
                          <span>{track.artist}</span>

                        </div>

                      </div>

                      <div className="playlist-track-actions">

                        <button
                          type="button"
                          className="playlist-track-add"
                          onPointerDown={(event) =>
                            event.stopPropagation()
                          }
                          onClick={() =>
                            addPlaylistTrackToQueue(track)
                          }
                          aria-label={`Add ${track.title} to queue`}
                        >
                          +
                        </button>

                        <button
                          type="button"
                          className="playlist-track-remove"
                          onPointerDown={(event) =>
                            event.stopPropagation()
                          }
                          onClick={() =>
                            removePlaylistTrack(track.id)
                          }
                          aria-label={`Remove ${track.title} from playlist`}
                        >
                          ×
                        </button>

                      </div>

                    </div>

                  ))}

                </div>

              </section>

            )}
            
          </div>
          </section>

        </div>

        {deletePlaylistConfirmOpen && (
          <div
            className="create-playlist-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setDeletePlaylistConfirmOpen(false)
              }
            }}
          >
            <div
              className="create-playlist-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-playlist-modal-title"
            >
              <div className="create-playlist-modal-icon">
                ×
              </div>

              <h2 id="delete-playlist-modal-title">
                Delete playlist?
              </h2>

              <p>
                This will permanently delete{' '}
                <strong>{selectedPlaylist?.name}</strong> and all of
                its tracks.
              </p>

              <div className="create-playlist-modal-actions">
                <button
                  type="button"
                  className="create-playlist-modal-cancel"
                  onClick={() => {
                    setDeletePlaylistConfirmOpen(false)
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="create-playlist-modal-confirm delete-playlist-confirm"
                  onClick={deleteSelectedPlaylist}
                >
                  Delete playlist
                </button>
              </div>
            </div>
          </div>
        )}

        {renamePlaylistOpen && (
          <div
            className="create-playlist-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setRenamePlaylistOpen(false)
              }
            }}
          >
            <div
              className="create-playlist-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="rename-playlist-modal-title"
            >
              <div className="create-playlist-modal-icon">
                ✎
              </div>

              <h2 id="rename-playlist-modal-title">
                Rename playlist
              </h2>

              <p>
                Choose a new name for your playlist.
              </p>

              <input
                type="text"
                value={renamePlaylistName}
                onChange={(event) => {
                  setRenamePlaylistName(event.target.value)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    renameSelectedPlaylist()
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setRenamePlaylistOpen(false)
                  }
                }}
                placeholder="Playlist name"
                maxLength={100}
                autoFocus
              />

              <div className="create-playlist-modal-actions">
                <button
                  type="button"
                  className="create-playlist-modal-cancel"
                  onClick={() => {
                    setRenamePlaylistOpen(false)
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="create-playlist-modal-confirm"
                  onClick={renameSelectedPlaylist}
                  disabled={!renamePlaylistName.trim()}
                >
                  Rename playlist
                </button>
              </div>
            </div>
          </div>
        )}

        {createPlaylistOpen && (
          <div
            className="create-playlist-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setCreatePlaylistOpen(false)
              }
            }}
          >
            <div
              className="create-playlist-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-playlist-modal-title"
            >
              <div className="create-playlist-modal-icon">
                +
              </div>

              <h2 id="create-playlist-modal-title">
                Create playlist
              </h2>

              <p>
                Give your new playlist a name.
              </p>

              <input
                type="text"
                value={newPlaylistName}
                onChange={(event) => {
                  setNewPlaylistName(event.target.value)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    createNewPlaylist()
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setCreatePlaylistOpen(false)
                  }
                }}
                placeholder="Playlist name"
                maxLength={100}
                autoFocus
              />

              <div className="create-playlist-modal-actions">
                <button
                  type="button"
                  className="create-playlist-modal-cancel"
                  onClick={() => {
                    setCreatePlaylistOpen(false)
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="create-playlist-modal-confirm"
                  onClick={createNewPlaylist}
                  disabled={!newPlaylistName.trim()}
                >
                  Create playlist
                </button>
              </div>
            </div>
          </div>
        )}

        {playlistNotification && (
          <div className="playlist-notification">
            <div className="playlist-notification-content">
              <span className="playlist-notification-check">
                ✓
              </span>

              <div className="playlist-notification-text">
                <strong>
                  Added {playlistNotification.trackTitle}
                </strong>

                <span>
                  to "{playlistNotification.playlistName}"
                </span>
              </div>
            </div>

            <button
              type="button"
              className="playlist-notification-change"
              onClick={handleChangeStickyPlaylist}
            >
              Change playlist
            </button>
          </div>
        )}

        {playlistPickerOpen && (
          <div className="playlist-change-picker">
            <div className="playlist-change-picker-title">
              Choose playlist
            </div>

            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                className="playlist-change-picker-option"
                onClick={() =>
                  moveLastAddedTrackToPlaylist(playlist)
                }
              >
                {playlist.name}
              </button>
            ))}
          </div>
        )}

        {playlistPlayConfirmOpen && (
          <div className="playlist-play-modal-backdrop">
            <div
              className="playlist-play-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="playlist-play-modal-title"
            >
              <div className="playlist-play-modal-icon">
                ▶
              </div>

              <h2 id="playlist-play-modal-title">
                Play this playlist?
              </h2>

              <p>
                This will clear the current queue and start
                playing all {playlistTracks.length} tracks in
                "{selectedPlaylist?.name}".
              </p>

              <div className="playlist-play-modal-actions">
                <button
                  type="button"
                  className="playlist-play-modal-cancel"
                  onClick={() =>
                    setPlaylistPlayConfirmOpen(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="playlist-play-modal-confirm"
                  onClick={playPlaylist}
                >
                  Play Playlist
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      <button
        type="button"
        className={`back-to-top ${
          showBackToTop ? 'visible' : ''
        }`}
        aria-label="Back to top"
        onClick={() => {
          window.scrollTo({
            top: 0,
            behavior: 'smooth',
          })
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M6 14L12 8L18 14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

    </div>
  )
}

export default App