// Player para PC / navegador: <video> com hls.js (HLS/m3u8 no Chrome, Edge, Electron).
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Hls from 'hls.js';
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const stall = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const handleFail = (why: string) => {
    const r = fo.fail(why);
    if (r === 'retry') setReloadKey((k) => k + 1);
  };

  const armStall = () => {
    if (stall.current) clearTimeout(stall.current);
    stall.current = setTimeout(() => handleFail('travou'), STALL_MS);
  };
  const clearStall = () => {
    if (stall.current) clearTimeout(stall.current);
  };

  useEffect(() => {
    const video = videoRef.current;
    const s = fo.current;
    if (!video || !s) return;
    hlsRef.current?.destroy();
    hlsRef.current = null;
    const isHls = /\.m3u8(\?|$)/i.test(s.url) || /\/live\//.test(s.url);
    armStall();

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: !!live, backBufferLength: 30 });
      hlsRef.current = hls;
      hls.loadSource(s.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) handleFail(data.type);
      });
    } else {
      video.src = s.url;
    }
    const onCanPlay = () => {
      if (!live && startAt && video.currentTime < 1) video.currentTime = startAt;
      video.play().catch(() => {});
    };
    video.addEventListener('loadedmetadata', onCanPlay, { once: true });
    return () => {
      clearStall();
      video.removeEventListener('loadedmetadata', onCanPlay);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fo.current?.url, reloadKey]);

  useEffect(() => () => hlsRef.current?.destroy(), []);

  useImperativeHandle(ref, () => ({
    togglePlay: () => {
      const v = videoRef.current;
      if (!v) return;
      v.paused ? v.play().catch(() => {}) : v.pause();
    },
    seekBy: (sec) => {
      const v = videoRef.current;
      if (v && !live) v.currentTime = Math.max(0, v.currentTime + sec);
    },
    isPlaying: () => !!videoRef.current && !videoRef.current.paused,
  }));

  return (
    <View style={StyleSheet.absoluteFill}>
      <video
        ref={videoRef}
        style={{ width: '100%', height: '100%', background: '#000', objectFit: 'contain' }}
        playsInline
        onPlaying={() => {
          clearStall();
          fo.ok();
        }}
        onWaiting={() => armStall()}
        onError={() => !hlsRef.current && handleFail('erro')}
        onTimeUpdate={(e) => onTime?.(e.currentTarget.currentTime, e.currentTarget.duration || 0)}
        onEnded={() => onEnd?.()}
      />
      <FailoverNotice notice={fo.notice} exhausted={fo.exhausted} onRetry={fo.retryAll} />
    </View>
  );
});
