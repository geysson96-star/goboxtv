// Troca automática de fonte: se o link atual falhar ou travar, passa para o próximo.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { StreamSource } from './types';
import { useSettings } from '../store/settings';

export const STALL_MS = 12000;

export function useFailover(streams: StreamSource[]) {
  const auto = useSettings((s) => s.autoFailover);
  const [index, setIndex] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const key = streams.map((s) => s.url).join('|');
  const triesRef = useRef(0);

  useEffect(() => {
    setIndex(0);
    setExhausted(false);
    setNotice(null);
    triesRef.current = 0;
  }, [key]);

  const fail = useCallback(
    (reason: string) => {
      // 1ª falha: tenta o mesmo link de novo (às vezes é só um soluço da rede).
      if (triesRef.current === 0) {
        triesRef.current = 1;
        setNotice('Reconectando…');
        return 'retry' as const;
      }
      triesRef.current = 0;
      if (!auto) {
        setExhausted(true);
        setNotice(`Fonte indisponível (${reason}).`);
        return 'stop' as const;
      }
      if (index + 1 < streams.length) {
        setNotice(`Trocando de fonte… (${index + 2} de ${streams.length})`);
        setIndex(index + 1);
        return 'next' as const;
      }
      setExhausted(true);
      setNotice('Nenhuma fonte deste conteúdo respondeu agora.');
      return 'stop' as const;
    },
    [auto, index, streams.length],
  );

  const ok = useCallback(() => {
    triesRef.current = 0;
    setNotice(null);
  }, []);

  const retryAll = useCallback(() => {
    setExhausted(false);
    setNotice(null);
    triesRef.current = 0;
    setIndex(0);
  }, []);

  return { current: streams[index], index, total: streams.length, notice, exhausted, fail, ok, retryAll };
}
