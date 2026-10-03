import { useState, useEffect } from 'react';

export const useTheme = () => {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
};

export const getAdaptiveColor = (hex, isDark) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return hex;
  const hexStr = hex.replace('#', '');
  if (hexStr.length !== 6 && hexStr.length !== 3) return hex;
  
  let r, g, b;
  if (hexStr.length === 3) {
    r = parseInt(hexStr[0] + hexStr[0], 16);
    g = parseInt(hexStr[1] + hexStr[1], 16);
    b = parseInt(hexStr[2] + hexStr[2], 16);
  } else {
    r = parseInt(hexStr.substring(0, 2), 16);
    g = parseInt(hexStr.substring(2, 4), 16);
    b = parseInt(hexStr.substring(4, 6), 16);
  }
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const isColorLight = luminance > 0.5;
  
  // Invert the color if it conflicts with the theme's background
  // Light theme + Light color -> Invert to dark
  if (!isDark && isColorLight) {
    return `#${(255 - r).toString(16).padStart(2, '0')}${(255 - g).toString(16).padStart(2, '0')}${(255 - b).toString(16).padStart(2, '0')}`;
  }
  // Dark theme + Dark color -> Invert to light
  if (isDark && !isColorLight) {
    return `#${(255 - r).toString(16).padStart(2, '0')}${(255 - g).toString(16).padStart(2, '0')}${(255 - b).toString(16).padStart(2, '0')}`;
  }
  
  return hex;
};
