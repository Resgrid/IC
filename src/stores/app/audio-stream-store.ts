import { type AudioPlayer, type AudioStatus, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { getDepartmentAudioStreams } from '@/api/voice';
import { logger } from '@/lib/logging';
import { type DepartmentAudioResultStreamData } from '@/models/v4/voice/departmentAudioResultStreamData';

interface AudioStreamState {
  // Available streams
  availableStreams: DepartmentAudioResultStreamData[];
  isLoadingStreams: boolean;

  // Current stream
  currentStream: DepartmentAudioResultStreamData | null;
  soundObject: AudioPlayer | null;
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;

  // UI state
  isBottomSheetVisible: boolean;

  // Actions
  setAvailableStreams: (streams: DepartmentAudioResultStreamData[]) => void;
  setIsLoadingStreams: (loading: boolean) => void;
  setCurrentStream: (stream: DepartmentAudioResultStreamData | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setIsBuffering: (buffering: boolean) => void;
  setIsBottomSheetVisible: (visible: boolean) => void;

  // Stream operations
  fetchAvailableStreams: () => Promise<void>;
  playStream: (stream: DepartmentAudioResultStreamData) => Promise<void>;
  stopStream: () => Promise<void>;
  cleanup: () => Promise<void>;
}

/**
 * Publishes the player to the OS media session: an Android media-style notification with a
 * play/pause control (plus the lock screen), and Now Playing / Control Center on iOS.
 *
 * On Android this is what starts expo-audio's `AudioControlsService`, the `mediaPlayback`
 * foreground service declared by the expo-audio config plugin. Without it a backgrounded
 * stream keeps playing with no user-visible transport control — which is what Google Play
 * rejected — and the OS kills the playback after roughly three minutes anyway.
 *
 * `isLiveStream` drops the scrub bar and seek buttons: a scanner feed has no duration and
 * nothing buffered to seek into.
 */
const activateMediaControls = (player: AudioPlayer, stream: DepartmentAudioResultStreamData) => {
  try {
    player.setActiveForLockScreen(
      true,
      { title: stream.Name ?? '' },
      {
        isLiveStream: true,
        showSeekForward: false,
        showSeekBackward: false,
      }
    );
  } catch (error) {
    // Playback still works without the notification, so never fail the stream over this.
    logger.warn({
      message: 'Failed to activate audio stream media controls',
      context: { error, streamName: stream.Name },
    });
  }
};

/** Tears down the media notification / Now Playing entry before the player is released. */
const releaseMediaControls = (player: AudioPlayer) => {
  try {
    player.clearLockScreenControls();
  } catch (error) {
    logger.warn({
      message: 'Failed to clear audio stream media controls',
      context: { error },
    });
  }
};

let latestPlayRequestId = 0;

export const useAudioStreamStore = create<AudioStreamState>((set, get) => ({
  availableStreams: [],
  isLoadingStreams: false,
  currentStream: null,
  soundObject: null,
  isPlaying: false,
  isLoading: false,
  isBuffering: false,
  isBottomSheetVisible: false,

  setAvailableStreams: (streams) => set({ availableStreams: streams }),
  setIsLoadingStreams: (loading) => set({ isLoadingStreams: loading }),
  setCurrentStream: (stream) => set({ currentStream: stream }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setIsBuffering: (buffering) => set({ isBuffering: buffering }),
  setIsBottomSheetVisible: (visible) => set({ isBottomSheetVisible: visible }),

  fetchAvailableStreams: async () => {
    try {
      set({ isLoadingStreams: true });
      const response = await getDepartmentAudioStreams();
      set({ availableStreams: response.Data || [] });

      logger.debug({
        message: 'Audio streams fetched successfully',
        context: { count: response.Data?.length || 0 },
      });
    } catch (error) {
      logger.error({
        message: 'Failed to fetch audio streams',
        context: { error },
      });
      set({ availableStreams: [] });
    } finally {
      set({ isLoadingStreams: false });
    }
  },

  playStream: async (stream: DepartmentAudioResultStreamData) => {
    // Audio streaming is native-only
    if (Platform.OS === 'web') {
      logger.debug({ message: 'Audio streaming not supported on web' });
      return;
    }

    const streamUrl = stream?.Url?.trim();
    if (!streamUrl) {
      logger.error({
        message: 'Cannot play audio stream without a URL',
        context: { streamId: stream?.Id, streamName: stream?.Name },
      });
      return;
    }

    const requestId = ++latestPlayRequestId;

    try {
      const { soundObject: currentSound, stopStream } = get();

      // Stop current stream if playing
      if (currentSound) {
        await stopStream();
      }

      set({ isLoading: true, isBuffering: true });

      logger.debug({
        message: 'Starting audio stream',
        context: { streamName: stream.Name, streamUrl },
      });

      // Configure audio mode for streaming
      await setAudioModeAsync({
        allowsRecording: false,
        shouldPlayInBackground: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
        shouldRouteThroughEarpiece: false,
      });

      const sound = createAudioPlayer(streamUrl, {
        updateInterval: 1000,
        keepAudioSessionActive: true,
        preferredForwardBufferDuration: 5,
      });
      sound.loop = false;
      sound.volume = 1.0;
      sound.muted = false;

      // A newer playStream may have started while audio mode was being set up.
      // Release this superseded player without touching shared store state.
      if (requestId !== latestPlayRequestId) {
        try {
          sound.remove();
        } catch {
          // The player may already have been released.
        }
        return;
      }

      set({ soundObject: sound, currentStream: stream });

      // Register with the OS media session before playback starts so the notification and
      // its pause control exist from the first frame of audio.
      activateMediaControls(sound, stream);

      sound.addListener('playbackStatusUpdate', (status: AudioStatus) => {
        if (get().soundObject !== sound) {
          return;
        }

        if (status.error) {
          logger.error({
            message: 'Audio playback error',
            context: { error: status.error, streamName: stream.Name },
          });
          releaseMediaControls(sound);
          sound.remove();
          set({
            soundObject: null,
            currentStream: null,
            isPlaying: false,
            isLoading: false,
            isBuffering: false,
          });
          return;
        }

        const { isPlaying, isBuffering } = get();
        if (status.playing !== isPlaying) {
          set({ isPlaying: status.playing });
        }
        if (status.isBuffering !== isBuffering) {
          set({ isBuffering: status.isBuffering });
        }

        if (status.didJustFinish) {
          logger.info({
            message: 'Audio stream finished',
            context: { streamName: stream.Name },
          });

          setTimeout(async () => {
            const { currentStream, soundObject } = get();
            if (currentStream?.Id !== stream.Id || soundObject !== sound) {
              return;
            }

            try {
              await sound.seekTo(0);
              sound.play();
            } catch (replayError) {
              logger.error({
                message: 'Failed to restart audio stream',
                context: { error: replayError, streamName: stream.Name },
              });
            }
          }, 1000);
        }
      });

      // Start playing
      sound.play();

      logger.info({
        message: 'Audio stream started successfully',
        context: { streamName: stream.Name },
      });

      set({
        soundObject: sound,
        currentStream: stream,
        isPlaying: true,
        isLoading: false,
        isBuffering: false,
      });
    } catch (error) {
      logger.error({
        message: 'Failed to play audio stream',
        context: { error, streamName: stream.Name },
      });

      if (requestId !== latestPlayRequestId) {
        return;
      }

      const { soundObject } = get();
      if (soundObject) {
        try {
          releaseMediaControls(soundObject);
          soundObject.remove();
        } catch {
          // The player may already have been released by an error event.
        }
      }

      set({
        soundObject: null,
        currentStream: null,
        isPlaying: false,
        isLoading: false,
        isBuffering: false,
      });
    }
  },

  stopStream: async () => {
    try {
      const { soundObject, currentStream } = get();

      if (soundObject) {
        try {
          soundObject.pause();
        } finally {
          // Drop the media notification and stop the mediaPlayback foreground service before
          // the player goes away, otherwise a dead notification lingers in the shade.
          releaseMediaControls(soundObject);
          soundObject.remove();
        }

        logger.info({
          message: 'Audio stream stopped',
          context: { streamName: currentStream?.Name },
        });
      }
    } catch (error) {
      logger.error({
        message: 'Failed to stop audio stream',
        context: { error },
      });
    } finally {
      set({
        soundObject: null,
        currentStream: null,
        isPlaying: false,
        isLoading: false,
        isBuffering: false,
      });
    }
  },

  cleanup: async () => {
    try {
      const { stopStream } = get();
      await stopStream();

      logger.debug({
        message: 'Audio stream store cleaned up',
      });
    } catch (error) {
      logger.error({
        message: 'Failed to cleanup audio stream store',
        context: { error },
      });
    }
  },
}));
