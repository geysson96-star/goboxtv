import React from 'react';
import { View } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { Button, T } from './ui';

export function FailoverNotice({ notice, exhausted, onRetry }: { notice: string | null; exhausted: boolean; onRetry: () => void }) {
  if (!notice) return null;
  return (
    <View style={{ position: 'absolute', top: 24, left: 0, right: 0, alignItems: 'center' }} pointerEvents="box-none">
      <GlassSurface strength="strong" style={{ borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <T style={{ fontWeight: '700' }}>{notice}</T>
        {exhausted ? <Button small variant="primary" label="Tentar de novo" onPress={onRetry} autoFocus /> : null}
      </GlassSurface>
    </View>
  );
}
