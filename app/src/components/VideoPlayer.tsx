// Player para Android / Android TV / iOS (expo-video: ExoPlayer/Media3 por baixo,
// com decodificação por hardware). Inclui troca automática de fonte.
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import type { StreamSource } from '../lib/types';
import { STALL_MS, useFailover } from '../lib/failover';
import { FailoverNotice } from './FailoverNotice';

export interface PlayerHandle {
  togglePlay: () => void;
  seekBy: (sec: number) => void;
  isPlaying: () => boolean;
}

interface Props {
  streams: StreamSource[];
  live?: boolean;
  startAt?: number;
  onTime?: (pos: number, dur: number) => void;
  onEnd?: () => void;
}

export const VideoPlayer = forwardRef<PlayerHandle, Props>(function VideoPlayer({ streams, live, startAt, onTime, onEnd }, ref) {
  const fo = useFailover(streams);
  const player = useVideoPlayer(null, (p) => {
    p.timeUpdateEventInterval = 1;
    p.staysActiveInBackground = false;
  });
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);

  const load = () => {
    const s = fo.current;
    if (!s) return;
    started.current = false;
    const src = { uri: s.url, headers: s.headers };
    const anyP = player as any;
    (anyP.replaceAsync ? anyP.replaceAsync(src) : Promise.resolve(player.replace(src))).then(() => {
      if (!live && startAt) player.currentTime = startAt;
      player.play();
    });
    armStall();
  };

  const armStall = () => {
    if (stallTimer.current) clearTimeout(stallTimer.current);
    stallTimer.current = setTimeout(() => {
      if (!started.current) handleFail('travou');
    }, STALL_MS);
  };

  const handleFail = (why: string) => {
    const r = fo.fail(why);
    if (r === 'retry') load();
  };

  // Carrega quando muda a fonte atual.
  useEffect(() => {
    load();
    return () => {
      if (stallTimer.current) clearTimeout(stallTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fo.current?.url]);

  const { status, error } = useEvent(player, 'statusChange', { status: player.status, error: undefined as any });
  useEffect(() => {
    if (status === 'readyToPlay') {
      started.current = true;
      fo.ok();
    } else if (status === 'error') {
      handleFail(error?.message ? 'erro' : 'erro');
    } else if (status === 'loading' && started.current) {
      // travou no meio: espera um pouco antes de trocar
      started.current = false;
      armStall();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const t = player.addListener('timeUpdate', (e: any) => onTime?.(e.currentTime, player.duration || 0));
    const end = player.addListener('playToEnd', () => onEnd?.());
    return () => {
      t.remove();
      end.remove();
    };
  }, [player, onTime, onEnd]);

  useImperativeHandle(ref, () => ({
    togglePlay: () => (player.playing ? player.pause() : player.play()),
    seekBy: (sec) => {
      if (!live) player.seekBy(sec);
    },
    isPlaying: () => player.playing,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" allowsPictureInPicture />
      <FailoverNotice notice={fo.notice} exhausted={fo.exhausted} onRetry={fo.retryAll} />
    </View>
  );
});
