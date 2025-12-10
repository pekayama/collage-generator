import React, { useState, useRef, useEffect, useCallback } from "react";
import { Download, Upload, Image as ImageIcon, Sparkles, RefreshCcw, Move, RotateCw, ZoomIn } from "lucide-react";
import { CollageConfig, ImageTransform } from "./types";

// Helper to load images safely
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
};

const INITIAL_TRANSFORM: ImageTransform = { x: 0, y: 0, scale: 1, rotation: 0 };

export default function App() {
  const [config, setConfig] = useState<CollageConfig>({
    name: "なまえ",
    furigana: "フリガナ",
    bgColor1: "#ffffff",
    bgColor2: "#fecdd3", // pastel pink
    characterImage: null,
    overlayImage: null,
    characterTransform: { ...INITIAL_TRANSFORM },
    overlayTransform: { ...INITIAL_TRANSFORM },
  });

  // State to hold loaded image elements for performance (avoids reloading on every frame)
  const [loadedImages, setLoadedImages] = useState<{ char: HTMLImageElement | null; overlay: HTMLImageElement | null }>({
    char: null,
    overlay: null,
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load Character Image
  useEffect(() => {
    if (!config.characterImage) {
      setLoadedImages((prev) => ({ ...prev, char: null }));
      return;
    }
    let active = true;
    const url = URL.createObjectURL(config.characterImage);
    loadImage(url).then((img) => {
      if (active) setLoadedImages((prev) => ({ ...prev, char: img }));
    }).catch(e => console.error("Failed to load char img", e));
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [config.characterImage]);

  // Load Overlay Image
  useEffect(() => {
    if (!config.overlayImage) {
      setLoadedImages((prev) => ({ ...prev, overlay: null }));
      return;
    }
    let active = true;
    const url = URL.createObjectURL(config.overlayImage);
    loadImage(url).then((img) => {
      if (active) setLoadedImages((prev) => ({ ...prev, overlay: img }));
    }).catch(e => console.error("Failed to load overlay img", e));
    return () => {
      active = false;
      URL.revokeObjectURL(url);
    };
  }, [config.overlayImage]);

  // Handle inputs
  const handleInputChange = (field: keyof CollageConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement>,
    field: "characterImage" | "overlayImage"
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleInputChange(field, file);
      // Reset transforms for new image
      if (field === "characterImage") setConfig(prev => ({ ...prev, characterTransform: { ...INITIAL_TRANSFORM } }));
      if (field === "overlayImage") setConfig(prev => ({ ...prev, overlayTransform: { ...INITIAL_TRANSFORM } }));
    }
  };

  const handleTransformChange = (
    target: "character" | "overlay",
    key: keyof ImageTransform,
    value: number
  ) => {
    setConfig((prev) => ({
      ...prev,
      [`${target}Transform`]: {
        ...prev[`${target}Transform` as keyof CollageConfig] as ImageTransform,
        [key]: value,
      },
    }));
  };

  const resetTransform = (target: "character" | "overlay") => {
    setConfig((prev) => ({
      ...prev,
      [`${target}Transform`]: { ...INITIAL_TRANSFORM },
    }));
  };

  // Main Drawing Logic
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Use synchronous drawing since images are pre-loaded
    // Canvas Settings
    canvas.width = 900;
    canvas.height = 1200;
    const width = canvas.width;
    const height = canvas.height;

    // 1. Fill Background 1
    ctx.fillStyle = config.bgColor1;
    ctx.fillRect(0, 0, width, height);

    // Define geometric properties for the diagonal strip
    const stripAngle = (-10 * Math.PI) / 180;
    const stripHeight = 300;
    const stripYOffset = 850;
    const stripXOffset = -100;

    // 2. Draw Background 2 (The Strip)
    ctx.save();
    ctx.translate(stripXOffset, stripYOffset);
    ctx.rotate(stripAngle);
    
    ctx.fillStyle = config.bgColor2;
    ctx.fillRect(0, -200, 1400, stripHeight); // Extended width to cover rotation

    // 3. Draw Overlay Pattern (if exists) inside the strip
    if (loadedImages.overlay) {
      const overlayImg = loadedImages.overlay;
      
      // Clip to the strip area
      ctx.beginPath();
      ctx.rect(0, -200, 1400, stripHeight);
      ctx.clip();

      // Calculate safe cover scale for height
      const coverScale = Math.max(1400 / overlayImg.width, stripHeight / overlayImg.height);
      const baseW = overlayImg.width * coverScale;
      const baseH = overlayImg.height * coverScale;

      ctx.save();
      // Move to center of strip area to apply transforms
      ctx.translate(700, -50); 
      
      // Apply User Transforms
      ctx.translate(config.overlayTransform.x, config.overlayTransform.y);
      ctx.rotate((config.overlayTransform.rotation * Math.PI) / 180);
      ctx.scale(config.overlayTransform.scale, config.overlayTransform.scale);

      // Apply Effects
      ctx.filter = "grayscale(100%) opacity(0.5)";
      ctx.globalCompositeOperation = "multiply";
      
      // Draw centered relative to transform point
      ctx.drawImage(overlayImg, -baseW / 2, -baseH / 2, baseW, baseH);
      
      ctx.restore();
    }
    ctx.restore(); // Restore context (remove clip, rotation, filters of the strip)

    // 4. Draw Character
    if (loadedImages.char) {
        const charImg = loadedImages.char;

        const margin = 80;
        const maxCharWidth = width - (margin * 2);
        const maxCharHeight = height - (margin * 2);

        // Calculate aspect ratio fit (Base Scale)
        const baseScale = Math.min(
          maxCharWidth / charImg.width,
          maxCharHeight / charImg.height
        );
        const baseDrawW = charImg.width * baseScale;
        const baseDrawH = charImg.height * baseScale;

        const cx = width / 2;
        const cy = height / 2;

        ctx.save();
        
        // 1. Translate to center + User Offset
        ctx.translate(cx + config.characterTransform.x, cy + config.characterTransform.y);
        
        // 2. User Rotate
        ctx.rotate((config.characterTransform.rotation * Math.PI) / 180);
        
        // 3. User Scale
        ctx.scale(config.characterTransform.scale, config.characterTransform.scale);

        // Drop shadow for character
        ctx.shadowColor = "rgba(0,0,0,0.2)";
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 10;

        // Draw centered at (0,0) which is now the transformed center
        ctx.drawImage(charImg, -baseDrawW / 2, -baseDrawH / 2, baseDrawW, baseDrawH);
        
        ctx.restore();
    }

    // 5. Draw Text
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw Furigana
    if (config.furigana) {
        ctx.font = "bold 40px 'M PLUS Rounded 1c'";
        ctx.lineWidth = 6;
        ctx.strokeStyle = "white";
        ctx.strokeText(config.furigana, width / 2, 80);
        
        ctx.fillStyle = "#555";
        ctx.fillText(config.furigana, width / 2, 80);
    }

    // Draw Name
    if (config.name) {
        ctx.font = "800 120px 'M PLUS Rounded 1c'";
        ctx.lineWidth = 15;
        ctx.strokeStyle = "white";
        ctx.lineJoin = "round";
        ctx.strokeText(config.name, width / 2, 180);

        ctx.fillStyle = "#333";
        ctx.fillText(config.name, width / 2, 180);
    }
    ctx.restore();

  }, [config, loadedImages]);

  // Redraw when config or loaded images change
  // Since we pre-load images, we can redraw immediately without flickering
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const link = document.createElement("a");
      link.download = `collage-${config.name}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center">
      
      {/* Header */}
      <header className="mb-8 text-center bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-xl border-4 border-white w-full max-w-4xl">
        <h1 className="text-3xl md:text-5xl font-extrabold text-pink-500 tracking-tight flex items-center justify-center gap-3">
          <Sparkles className="w-8 h-8 md:w-12 md:h-12 text-yellow-400 fill-yellow-400 animate-pulse" />
          推しコラージュMaker
          <Sparkles className="w-8 h-8 md:w-12 md:h-12 text-blue-400 fill-blue-400 animate-pulse" />
        </h1>
        <p className="text-gray-500 mt-2 font-bold text-sm md:text-lg">あなただけの可愛い画像を作ろう！</p>
      </header>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white/90 backdrop-blur-md rounded-[2rem] p-6 shadow-lg border border-pink-100">
            
            {/* Text Inputs */}
            <div className="space-y-4 mb-8">
              <h2 className="text-xl font-bold text-gray-700 border-l-4 border-pink-400 pl-3">
                1. お名前
              </h2>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">キャラクター名</label>
                <input
                  type="text"
                  className="w-full p-3 rounded-xl border-2 border-pink-100 bg-pink-50 focus:border-pink-400 focus:outline-none transition-colors text-gray-700 font-bold"
                  value={config.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="例：山田 太郎"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-500 mb-1">フリガナ</label>
                <input
                  type="text"
                  className="w-full p-3 rounded-xl border-2 border-pink-100 bg-pink-50 focus:border-pink-400 focus:outline-none transition-colors text-gray-700 font-bold"
                  value={config.furigana}
                  onChange={(e) => handleInputChange("furigana", e.target.value)}
                  placeholder="例：やまだ たろう"
                />
              </div>
            </div>

            {/* Colors */}
            <div className="space-y-4 mb-8">
              <h2 className="text-xl font-bold text-gray-700 border-l-4 border-blue-400 pl-3">
                2. カラー設定
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-500 mb-1">メイン背景</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.bgColor1}
                      onChange={(e) => handleInputChange("bgColor1", e.target.value)}
                      className="w-12 h-12 rounded-full cursor-pointer border-2 border-gray-200 overflow-hidden"
                    />
                    <span className="text-xs text-gray-400 font-mono">{config.bgColor1}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-500 mb-1">アクセント背景</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.bgColor2}
                      onChange={(e) => handleInputChange("bgColor2", e.target.value)}
                      className="w-12 h-12 rounded-full cursor-pointer border-2 border-gray-200 overflow-hidden"
                    />
                    <span className="text-xs text-gray-400 font-mono">{config.bgColor2}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Image Uploads & Transforms */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-700 border-l-4 border-purple-400 pl-3">
                3. 画像と調整
              </h2>
              
              {/* Character Section */}
              <div className="bg-pink-50/50 rounded-2xl p-4 border border-pink-100">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-pink-500 flex items-center gap-2">
                        <Upload size={16}/> キャラクター
                    </h3>
                </div>
                
                <div className="relative group mb-4">
                    <label className="block w-full p-3 border-2 border-dashed border-pink-300 rounded-xl hover:bg-pink-50 cursor-pointer transition-colors text-center bg-white">
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, "characterImage")}
                    />
                    <div className="flex items-center justify-center gap-2">
                        <span className="font-bold text-gray-600 text-sm">
                        {config.characterImage ? "画像を変更" : "画像をアップロード"}
                        </span>
                    </div>
                    </label>
                </div>

                {config.characterImage && (
                    <TransformControls 
                        values={config.characterTransform}
                        onChange={(k, v) => handleTransformChange("character", k, v)}
                        onReset={() => resetTransform("character")}
                        color="pink"
                    />
                )}
              </div>

              {/* Overlay Section */}
              <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-blue-500 flex items-center gap-2">
                        <ImageIcon size={16}/> 背景パターン
                    </h3>
                </div>
                
                <div className="relative group mb-4">
                    <label className="block w-full p-3 border-2 border-dashed border-blue-300 rounded-xl hover:bg-blue-50 cursor-pointer transition-colors text-center bg-white">
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, "overlayImage")}
                    />
                    <div className="flex items-center justify-center gap-2">
                        <span className="font-bold text-gray-600 text-sm">
                        {config.overlayImage ? "画像を変更" : "画像をアップロード"}
                        </span>
                    </div>
                    </label>
                </div>

                {config.overlayImage && (
                    <TransformControls 
                        values={config.overlayTransform}
                        onChange={(k, v) => handleTransformChange("overlay", k, v)}
                        onReset={() => resetTransform("overlay")}
                        color="blue"
                    />
                )}
              </div>
            </div>

            <button
                onClick={downloadImage}
                className="mt-8 w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-2xl font-black text-xl shadow-lg shadow-pink-200 transform transition hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-3"
            >
                <Download />
                画像を保存する
            </button>

          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-7 sticky top-8">
            <div className="bg-white/90 backdrop-blur rounded-[2rem] p-4 shadow-2xl border border-white">
                <div className="flex items-center justify-between mb-4 px-2">
                    <h3 className="font-bold text-gray-500 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></span>
                        プレビュー
                    </h3>
                </div>
                
                {/* Canvas Container */}
                <div className="relative w-full aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden shadow-inner border-2 border-gray-200">
                    {!config.characterImage && (
                         <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none z-10">
                            <ImageIcon size={64} className="opacity-20 mb-2"/>
                            <p className="font-bold opacity-40">ここにプレビューが表示されます</p>
                        </div>
                    )}
                    <canvas 
                        ref={canvasRef} 
                        className="w-full h-full object-contain bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"
                    />
                </div>
                <p className="text-center text-xs text-gray-400 mt-3 font-bold">
                    ※ 実際の保存サイズは 900x1200px です
                </p>
            </div>
        </div>

      </div>
    </div>
  );
}

// Sub-component for Transform Controls
const TransformControls = ({ 
    values, 
    onChange, 
    onReset,
    color
}: { 
    values: ImageTransform, 
    onChange: (key: keyof ImageTransform, val: number) => void,
    onReset: () => void,
    color: "pink" | "blue"
}) => {
    const sliderClass = `w-full h-2 rounded-lg appearance-none cursor-pointer bg-${color}-200 accent-${color}-500`;

    return (
        <div className="space-y-3 bg-white p-3 rounded-xl border border-gray-100">
            {/* Position */}
            <div className="grid grid-cols-2 gap-3">
                 <div>
                    <label className="flex items-center justify-between text-xs font-bold text-gray-500 mb-1">
                        <span className="flex items-center gap-1"><Move size={12}/> X (横)</span>
                        <span>{Math.round(values.x)}</span>
                    </label>
                    <input 
                        type="range" min="-400" max="400" 
                        value={values.x} 
                        onChange={(e) => onChange('x', Number(e.target.value))}
                        className={sliderClass}
                    />
                </div>
                <div>
                    <label className="flex items-center justify-between text-xs font-bold text-gray-500 mb-1">
                        <span className="flex items-center gap-1"><Move size={12} className="rotate-90"/> Y (縦)</span>
                        <span>{Math.round(values.y)}</span>
                    </label>
                    <input 
                        type="range" min="-400" max="400" 
                        value={values.y} 
                        onChange={(e) => onChange('y', Number(e.target.value))}
                        className={sliderClass}
                    />
                </div>
            </div>

            {/* Scale & Rotate */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="flex items-center justify-between text-xs font-bold text-gray-500 mb-1">
                        <span className="flex items-center gap-1"><ZoomIn size={12}/> サイズ</span>
                        <span>{values.scale.toFixed(1)}x</span>
                    </label>
                    <input 
                        type="range" min="0.1" max="3" step="0.1"
                        value={values.scale} 
                        onChange={(e) => onChange('scale', Number(e.target.value))}
                        className={sliderClass}
                    />
                </div>
                <div>
                    <label className="flex items-center justify-between text-xs font-bold text-gray-500 mb-1">
                        <span className="flex items-center gap-1"><RotateCw size={12}/> 回転</span>
                        <span>{Math.round(values.rotation)}°</span>
                    </label>
                    <input 
                        type="range" min="-180" max="180" 
                        value={values.rotation} 
                        onChange={(e) => onChange('rotation', Number(e.target.value))}
                        className={sliderClass}
                    />
                </div>
            </div>

            <button 
                onClick={onReset}
                className="w-full text-xs text-gray-400 hover:text-gray-600 font-bold py-1 border border-dashed border-gray-300 rounded hover:bg-gray-50 flex items-center justify-center gap-1"
            >
                <RefreshCcw size={10} /> リセット
            </button>
        </div>
    );
}