import { useState, useEffect, useCallback } from 'react';

interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface ExtractedColors extends BrandColors {
  isExtracted: boolean;
}

// Extract dominant colors from an image using canvas
export const extractColorsFromImage = (imageUrl: string): Promise<BrandColors> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        // Use smaller size for performance
        const maxSize = 100;
        const scale = Math.min(maxSize / img.width, maxSize / img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Collect color samples
        const colorMap: Map<string, { r: number; g: number; b: number; count: number }> = new Map();
        
        for (let i = 0; i < data.length; i += 4) {
          const r = Math.round(data[i] / 10) * 10;
          const g = Math.round(data[i + 1] / 10) * 10;
          const b = Math.round(data[i + 2] / 10) * 10;
          const a = data[i + 3];
          
          // Skip transparent pixels and very light/dark colors
          if (a < 128) continue;
          const brightness = (r + g + b) / 3;
          if (brightness < 20 || brightness > 235) continue;
          
          const key = `${r},${g},${b}`;
          const existing = colorMap.get(key);
          if (existing) {
            existing.count++;
          } else {
            colorMap.set(key, { r, g, b, count: 1 });
          }
        }
        
        // Sort by frequency and filter for distinct colors
        const sortedColors = Array.from(colorMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 20);
        
        if (sortedColors.length === 0) {
          resolve({
            primary: '#3b82f6',
            secondary: '#6366f1',
            accent: '#8b5cf6'
          });
          return;
        }
        
        // Get primary (most frequent)
        const primary = sortedColors[0];
        
        // Get secondary (distinct from primary)
        let secondary = sortedColors.find(c => 
          Math.abs(c.r - primary.r) > 30 || 
          Math.abs(c.g - primary.g) > 30 || 
          Math.abs(c.b - primary.b) > 30
        ) || sortedColors[1] || primary;
        
        // Get accent (complementary or distinct)
        let accent = sortedColors.find(c => 
          c !== secondary && (
            Math.abs(c.r - primary.r) > 50 || 
            Math.abs(c.g - primary.g) > 50 || 
            Math.abs(c.b - primary.b) > 50
          )
        ) || sortedColors[2] || secondary;
        
        const toHex = (c: { r: number; g: number; b: number }) => 
          '#' + [c.r, c.g, c.b].map(x => x.toString(16).padStart(2, '0')).join('');
        
        resolve({
          primary: toHex(primary),
          secondary: toHex(secondary),
          accent: toHex(accent)
        });
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
};

// Convert hex to HSL for CSS variables
export const hexToHsl = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '0 0% 0%';
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

// Hook to use brand colors
export const useBrandColors = (
  logoUrl: string | null | undefined,
  savedColors?: {
    primary?: string | null;
    secondary?: string | null;
    accent?: string | null;
  }
): ExtractedColors & { loading: boolean; extractColors: () => Promise<BrandColors | null> } => {
  const [colors, setColors] = useState<ExtractedColors>({
    primary: '#3b82f6',
    secondary: '#6366f1', 
    accent: '#8b5cf6',
    isExtracted: false
  });
  const [loading, setLoading] = useState(false);
  const [hasExtracted, setHasExtracted] = useState(false);
  
  // Check if saved colors are available
  const hasSavedColors = !!(savedColors?.primary && savedColors?.secondary && savedColors?.accent);
  
  // Use saved colors if available
  useEffect(() => {
    if (hasSavedColors) {
      setColors({
        primary: savedColors.primary!,
        secondary: savedColors.secondary!,
        accent: savedColors.accent!,
        isExtracted: false
      });
      setHasExtracted(true); // Prevent auto-extraction when we have saved colors
    }
  }, [hasSavedColors, savedColors?.primary, savedColors?.secondary, savedColors?.accent]);
  
  // Auto-extract colors from logo if no saved colors are available
  useEffect(() => {
    if (!hasSavedColors && logoUrl && !hasExtracted && !loading) {
      setLoading(true);
      extractColorsFromImage(logoUrl)
        .then((extracted) => {
          setColors({ ...extracted, isExtracted: true });
          setHasExtracted(true);
        })
        .catch((error) => {
          console.error('Failed to auto-extract colors:', error);
          setHasExtracted(true); // Prevent retry loop
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [logoUrl, hasSavedColors, hasExtracted, loading]);
  
  const extractColors = useCallback(async (): Promise<BrandColors | null> => {
    if (!logoUrl) return null;
    
    setLoading(true);
    try {
      const extracted = await extractColorsFromImage(logoUrl);
      setColors({ ...extracted, isExtracted: true });
      setHasExtracted(true);
      return extracted;
    } catch (error) {
      console.error('Failed to extract colors:', error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [logoUrl]);
  
  return { ...colors, loading, extractColors };
};

export default useBrandColors;
