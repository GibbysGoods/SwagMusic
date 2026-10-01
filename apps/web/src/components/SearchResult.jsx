import { useEffect, useRef, useState } from 'react'

function SearchResult({
  title,
  artist,
  album,
  artwork,
  uri,
  duration,
  playlists,
  stickyPlaylist,
  onAdd,
  onAddToPlaylist,
}) {
  const [added, setAdded] = useState(false)
  const [playlistOpen, setPlaylistOpen] =
    useState(false)

  const playlistRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        playlistRef.current &&
        !playlistRef.current.contains(event.target)
      ) {
        setPlaylistOpen(false)
      }
    }

    if (playlistOpen) {
      document.addEventListener(
        'mousedown',
        handleClickOutside
      )
    }

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside
      )
    }
  }, [playlistOpen])

  const track = {
    title,
    artist,
    album,
    artwork,
    uri,
    duration,
  }

  const handlePlaylistButtonClick = () => {
    if (stickyPlaylist) {
      onAddToPlaylist(track)
      return
    }

    if (!playlists?.length) {
      return
    }

    setPlaylistOpen((open) => !open)
  }

  const handlePlaylistSelect = async (
    playlist
  ) => {
    setPlaylistOpen(false)

    await onAddToPlaylist(
      track,
      playlist
    )
  }

  return (
    <div className="search-result">

      <div className="search-result-art">
        {artwork && (
          <img
            src={artwork}
            alt=""
          />
        )}
      </div>

      <div className="search-result-info">
        <strong>{title}</strong>
        <span>
          {artist} · {album}
        </span>
      </div>

      <div
        className="search-result-playlist-wrapper"
        ref={playlistRef}
      >
        <button
          type="button"
          className={`search-result-playlist ${
            stickyPlaylist
              ? 'active'
              : ''
          }`}
          onClick={
            handlePlaylistButtonClick
          }
          aria-label={
            stickyPlaylist
              ? `Add to ${stickyPlaylist.name}`
              : 'Add to playlist'
          }
          aria-expanded={
            !stickyPlaylist &&
            playlistOpen
          }
        >
          {stickyPlaylist ? '♡' : '♡'}
        </button>

        {!stickyPlaylist &&
          playlistOpen && (
            <div className="search-result-playlist-picker">
              {playlists?.length ? (
                playlists.map(
                  (playlist) => (
                    <button
                      key={playlist.id}
                      type="button"
                      className="search-result-playlist-option"
                      onClick={() =>
                        handlePlaylistSelect(
                          playlist
                        )
                      }
                    >
                      <span>
                        {playlist.name}
                      </span>
                    </button>
                  )
                )
              ) : (
                <div className="search-result-playlist-empty">
                  No playlists yet
                </div>
              )}
            </div>
          )}
      </div>

      <button
        type="button"
        className={`search-result-add ${
          added ? 'added' : ''
        }`}
        onClick={() => {
          onAdd(track)

          setAdded(true)

          setTimeout(() => {
            setAdded(false)
          }, 700)
        }}
        aria-label={
          added
            ? 'Added to queue'
            : 'Add to queue'
        }
      >
        {added ? '✓' : '+'}
      </button>

    </div>
  )
}

export default SearchResult