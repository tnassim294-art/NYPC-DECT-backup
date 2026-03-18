import React, { useState, useEffect, useRef, useCallback } from "react";
import styled from "styled-components";

const ImageWithOverlay = ({
  src,
  alt,
  customCircles,
  circleMode,
  isPlacingCircle,
  onImageClick,
  selectedCircleId,
  onCircleSelect,
}) => {
  const containerRef = useRef(null);
  const imgRef = useRef(null);
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [nativeSize, setNativeSize] = useState({ width: 512, height: 512 });

  const updateSize = useCallback(() => {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      setDisplaySize({ width: rect.width, height: rect.height });
      // Use actual image dimensions — works for any DICOM resolution
      if (imgRef.current.naturalWidth > 0) {
        setNativeSize({
          width: imgRef.current.naturalWidth,
          height: imgRef.current.naturalHeight,
        });
      }
    }
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    img.addEventListener("load", updateSize);
    window.addEventListener("resize", updateSize);
    // Also measure if already loaded
    if (img.complete) updateSize();
    return () => {
      img.removeEventListener("load", updateSize);
      window.removeEventListener("resize", updateSize);
    };
  }, [updateSize]);

  const scaleX = displaySize.width > 0 ? displaySize.width / nativeSize.width : 1;
  const scaleY = displaySize.height > 0 ? displaySize.height / nativeSize.height : 1;

  const handleSvgClick = (e) => {
    if (!isPlacingCircle || circleMode !== "custom") return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const displayX = e.clientX - svgRect.left;
    const displayY = e.clientY - svgRect.top;
    const nativeX = Math.round(displayX / scaleX);
    const nativeY = Math.round(displayY / scaleY);
    onImageClick(nativeX, nativeY);
  };

  const showCircles = circleMode === "custom" && customCircles.length > 0;

  return (
    <OverlayContainer ref={containerRef}>
      <Image ref={imgRef} src={src} alt={alt} draggable={false} />
      {displaySize.width > 0 && (
        <SvgOverlay
          width={displaySize.width}
          height={displaySize.height}
          $isPlacing={isPlacingCircle && circleMode === "custom"}
          onClick={handleSvgClick}
        >
          {showCircles &&
            customCircles.map((circle) => {
              const cx = circle.x * scaleX;
              const cy = circle.y * scaleY;
              const r = circle.radius * scaleX;
              const isSelected = circle.id === selectedCircleId;
              return (
                <g
                  key={circle.id}
                  onClick={(e) => {
                    if (!isPlacingCircle) {
                      e.stopPropagation();
                      onCircleSelect(circle.id);
                    }
                  }}
                  style={{ cursor: isPlacingCircle ? "crosshair" : "pointer" }}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r}
                    fill="none"
                    stroke={isSelected ? "#ffeb3b" : "#00ff88"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  <text
                    x={cx}
                    y={cy - r - 4}
                    textAnchor="middle"
                    fill={isSelected ? "#ffeb3b" : "#00ff88"}
                    fontSize={Math.max(9, 11 * scaleX)}
                    fontWeight="600"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {circle.material}
                  </text>
                </g>
              );
            })}
        </SvgOverlay>
      )}
    </OverlayContainer>
  );
};

const ImageViewer = ({
  highImages,
  lowImages,
  currentIndex = 0,
  setImageIndex,
  customCircles = [],
  circleMode = "preset",
  isPlacingCircle = false,
  onImageClick = () => {},
  selectedCircleId = null,
  onCircleSelect = () => {},
}) => {
  const [activeIndex, setActiveIndex] = useState(currentIndex);

  const totalImages = highImages ? highImages.length : 0;
  const isSECT = !lowImages || lowImages.length === 0;
  const baseURL = "http://127.0.0.1:5050";

  useEffect(() => {
    setActiveIndex(currentIndex);
  }, [currentIndex]);

  const onSliderChange = (e) => {
    const newIndex = parseInt(e.target.value, 10);
    setActiveIndex(newIndex);
    if (setImageIndex) {
      setImageIndex(newIndex);
    }
  };

  if (totalImages === 0) return <p>No images available.</p>;

  const safeIndex = Math.min(activeIndex, totalImages - 1);

  const progressPercent =
    totalImages > 1 ? (safeIndex / (totalImages - 1)) * 100 : 0;

  return (
    <ViewerCard>
      <ImageDisplayArea>
        <ImageWithOverlay
          src={`${baseURL}${highImages[safeIndex]}`}
          alt="High kVp"
          customCircles={customCircles}
          circleMode={circleMode}
          isPlacingCircle={isPlacingCircle}
          onImageClick={onImageClick}
          selectedCircleId={selectedCircleId}
          onCircleSelect={onCircleSelect}
        />
        {!isSECT && (
          <ImageWithOverlay
            src={`${baseURL}${lowImages[safeIndex]}`}
            alt="Low kVp"
            customCircles={customCircles}
            circleMode={circleMode}
            isPlacingCircle={isPlacingCircle}
            onImageClick={onImageClick}
            selectedCircleId={selectedCircleId}
            onCircleSelect={onCircleSelect}
          />
        )}
      </ImageDisplayArea>

      <ControlsBar>
        <SliderContainer>
          <Slider
            $progress={progressPercent}
            min="0"
            max={totalImages - 1}
            value={safeIndex}
            onChange={onSliderChange}
          />
        </SliderContainer>
        <CounterPill>
          {safeIndex + 1} / {totalImages}
        </CounterPill>
      </ControlsBar>
    </ViewerCard>
  );
};

export default ImageViewer;

const OverlayContainer = styled.div`
  position: relative;
  display: inline-block;
  margin: 0 10px;
`;

const SvgOverlay = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: ${(props) => (props.$isPlacing ? "auto" : "auto")};
  cursor: ${(props) => (props.$isPlacing ? "crosshair" : "default")};
`;

const ViewerCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 24px;
  padding: 30px;
  max-width: 700px;
`;

const ImageDisplayArea = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-bottom: 10px;
`;

const Image = styled.img`
  max-width: 280px;
  max-height: 280px;
  border-radius: 16px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  user-select: none;
  display: block;
`;

const ControlsBar = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 10px;
`;

const SliderContainer = styled.div`
  flex-grow: 1;
  display: flex;
  align-items: center;
`;

const CounterPill = styled.div`
  background: #f0f2f5;
  color: #666;
  font-size: 14px;
  font-weight: 600;
  padding: 8px 16px;
  border-radius: 20px;
  white-space: nowrap;
`;

const Slider = styled.input.attrs({ type: "range" })`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 10px;
  outline: none;
  cursor: pointer;

  background: linear-gradient(
    to right,
    #ff6bcb 0%,
    #ff6bcb ${(props) => props.$progress}%,
    #e0e0e0 ${(props) => props.$progress}%,
    #e0e0e0 100%
  );

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    background: #ff6bcb;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
    margin-top: -3px;
  }

  &::-webkit-slider-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(255, 107, 203, 0.5);
  }

  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    background: #ff6bcb;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
    box-sizing: border-box;
  }

  &::-moz-range-thumb:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(255, 107, 203, 0.5);
  }
`;
