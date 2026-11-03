// Detecta o tipo de tela: celular (pequena, toque) ou TV/PC (grande, controle/teclado).
import { useWindowDimensions } from 'react-native';

export const PHONE_MAX_WIDTH = 760;

export function useIsPhone() {
  const { width, height } = useWindowDimensions();
  // Celular deitado também conta como celular (altura pequena).
  return width < PHONE_MAX_WIDTH || Math.min(width, height) < 500;
}
