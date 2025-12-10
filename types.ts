export interface ImageTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface CollageConfig {
  name: string;
  furigana: string;
  bgColor1: string;
  bgColor2: string;
  characterImage: File | null;
  overlayImage: File | null;
  characterTransform: ImageTransform;
  overlayTransform: ImageTransform;
}
