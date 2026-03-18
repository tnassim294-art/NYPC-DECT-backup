// ViewerSection.js
import React from "react";
import styled from "styled-components";
import ImageViewer from "./ImageViewer";
import { FaHome } from "react-icons/fa";

const MATERIALS = [
  "Cortical Bone",
  "Inner Bone",
  "50% CaCO3",
  "30% CaCO3",
  "Liver",
  "Brain",
  "Breast",
  "Adipose",
  "LN-450",
  "LN-350",
  "Solid Water",
];

const PHANTOM_OPTIONS = [
  { value: "head", label: "Head" },
  { value: "body", label: "Body" },
  { value: "3d-head 0-ring", label: "3D-Head 0-Ring" },
  { value: "3d-head 1-ring", label: "3D-Head 1-Ring" },
  { value: "3d-head 2-ring", label: "3D-Head 2-Ring" },
  { value: "3d-head 3-ring", label: "3D-Head 3-Ring" },
  { value: "3d-head 4-ring", label: "3D-Head 4-Ring" },
];

const ViewerSection = ({
  highImages,
  lowImages,
  currentIndex,
  handleNextImage,
  handlePreviousImage,
  cleanNoise,
  phantomType,
  setPhantomType,
  testPhantomType = null,
  setTestPhantomType = null,
  circleRadius,
  handleRadiusChange,
  selectedModel,
  setSelectedModel,
  models,
  handleCalculate,
  handleHome,
  // Circle placement props
  circleMode,
  setCircleMode,
  customCircles,
  isPlacingCircle,
  setIsPlacingCircle,
  selectedMaterial,
  setSelectedMaterial,
  selectedCircleId,
  setSelectedCircleId,
  onImageClick,
  onRemoveCircle,
  onClearCircles,
  isSECT,
  isTestViewer = false,
  isEnergyPairViewer = false,
  energyList = [],
  onCalibrationSweep,
}) => {
  const getTitle = () => {
    if (isEnergyPairViewer) return `Energy Pair Analysis (${energyList.join(", ")} kVp)`;
    if (isTestViewer) return "Test Scan - Adjust ROIs";
    return "Scan Visualizer";
  };

  return (
    <>
      <Header>
        <UtilityButton onClick={handleHome}>
          <FaHome />
        </UtilityButton>
        <h1>{getTitle()}</h1>
      </Header>
      <ImageViewer
        highImages={highImages}
        lowImages={lowImages}
        currentIndex={currentIndex}
        handleNextImage={handleNextImage}
        handlePreviousImage={handlePreviousImage}
        customCircles={customCircles}
        circleMode={circleMode}
        isPlacingCircle={isPlacingCircle}
        onImageClick={onImageClick}
        selectedCircleId={selectedCircleId}
        onCircleSelect={setSelectedCircleId}
      />
      {!isTestViewer && !isEnergyPairViewer && (
        <ButtonGroup>
          <SecondaryButton onClick={cleanNoise}>Clean Noise</SecondaryButton>
        </ButtonGroup>
      )}
      <ControlsContainer>
        <ControlGroup>
          {!isTestViewer && !isEnergyPairViewer && (
            <SelectContainer>
              <label>Circle Mode:</label>
              <Select
                value={circleMode}
                onChange={(e) => {
                  setCircleMode(e.target.value);
                  if (e.target.value === "preset") {
                    setIsPlacingCircle(false);
                  }
                }}
              >
                <option value="preset">Preset</option>
                <option value="custom">Custom</option>
              </Select>
            </SelectContainer>
          )}
          {circleMode === "preset" && !isTestViewer && !isEnergyPairViewer && (
            <SelectContainer>
              <label>Phantom Size:</label>
              <Select
                value={phantomType}
                onChange={(e) => setPhantomType(e.target.value)}
              >
                {PHANTOM_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </SelectContainer>
          )}
          {!isTestViewer && !isEnergyPairViewer && (
            <SelectContainer>
              <label>Model Selection:</label>
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </Select>
            </SelectContainer>
          )}
          {(isTestViewer || isEnergyPairViewer) && (
            <SelectContainer>
              <label>Model: {selectedModel}</label>
            </SelectContainer>
          )}
        </ControlGroup>

        {circleMode === "custom" && (
          <CircleControlsPanel>
            <ControlGroup>
              <SelectContainer>
                <label>Material:</label>
                <Select
                  value={selectedMaterial}
                  onChange={(e) => setSelectedMaterial(e.target.value)}
                >
                  {MATERIALS.map((mat) => (
                    <option key={mat} value={mat}>
                      {mat}
                    </option>
                  ))}
                </Select>
              </SelectContainer>
              <PlaceButton
                $active={isPlacingCircle}
                onClick={() => setIsPlacingCircle(!isPlacingCircle)}
              >
                {isPlacingCircle ? "Stop Placing" : "Start Placing"}
              </PlaceButton>
            </ControlGroup>
            <ControlGroup>
              <SmallButton
                onClick={() => {
                  if (selectedCircleId != null) onRemoveCircle(selectedCircleId);
                }}
                disabled={selectedCircleId == null}
              >
                Remove Selected
              </SmallButton>
              <SmallButton
                onClick={onClearCircles}
                disabled={customCircles.length === 0}
              >
                Clear All
              </SmallButton>
            </ControlGroup>
            {customCircles.length > 0 && (
              <CircleList>
                {customCircles.map((c) => (
                  <CircleItem
                    key={c.id}
                    $selected={c.id === selectedCircleId}
                    onClick={() => setSelectedCircleId(c.id)}
                  >
                    <span>
                      {c.material} ({c.x}, {c.y}) r={c.radius}
                    </span>
                    <RemoveBtn
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveCircle(c.id);
                      }}
                    >
                      x
                    </RemoveBtn>
                  </CircleItem>
                ))}
              </CircleList>
            )}
          </CircleControlsPanel>
        )}

        <ControlGroup>
          <SliderContainer>
            <label>Insert Radius: {circleRadius}px</label>
            <RadiusSlider
              type="range"
              min="1"
              max="100"
              value={circleRadius}
              onChange={handleRadiusChange}
            />
          </SliderContainer>
        </ControlGroup>
      </ControlsContainer>
      <ButtonGroup>
        <MainButton onClick={handleCalculate}>
          {isEnergyPairViewer
            ? "Run Energy Pair Analysis"
            : isTestViewer
            ? "Run Test Analysis"
            : "Calculate Stopping Power"}
        </MainButton>
        {!isTestViewer && !isSECT && onCalibrationSweep && (
          <SecondaryButton onClick={onCalibrationSweep}>
            Calibration Sweep
          </SecondaryButton>
        )}
      </ButtonGroup>
    </>
  );
};

export default ViewerSection;

const Header = styled.div`
  margin-bottom: 20px;
  position: relative;
  width: 100%;
`;

const UtilityButton = styled.button`
  position: absolute;
  top: 10px;
  left: 20px;
  background: #f0f0f0;
  color: #1f2a48;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.2);
  transition: background 0.3s, transform 0.2s;

  &:hover {
    background: #e0e0e0;
    transform: scale(1.1);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 20px;
  justify-content: center;
`;

const MainButton = styled.button`
  background: #ff6bcb;
  color: white;
  padding: 15px 25px;
  font-size: 16px;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0px 8px 15px rgba(255, 107, 203, 0.4);

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0px 12px 20px rgba(255, 107, 203, 0.6);
  }
`;

const SecondaryButton = styled.button`
  background: #6bbaff;
  color: white;
  padding: 15px 25px;
  font-size: 16px;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0px 8px 15px rgba(107, 154, 255, 0.4);

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0px 12px 20px rgba(107, 154, 255, 0.6);
  }
`;

const ControlsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 20px;
  width: 100%;
`;

const ControlGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: center;
  align-items: center;
`;

const SliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #ff6bcb;
  min-width: 250px;
`;

const RadiusSlider = styled.input`
  width: 100%;
  max-width: 200px;
  margin-top: 10px;
`;

const SelectContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #ff6bcb;
`;

const Select = styled.select`
  padding: 5px;
  border-radius: 5px;
  border: 1px solid #ff6bcb;
  color: #ff6bcb;
  background-color: #fff;
  font-size: 16px;
`;

const CircleControlsPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #f8f9fc;
  border-radius: 16px;
  border: 1px solid #e0e0e0;
`;

const PlaceButton = styled.button`
  background: ${(props) => (props.$active ? "#ff4444" : "#00c853")};
  color: white;
  padding: 8px 18px;
  font-size: 14px;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0px 4px 10px
    ${(props) =>
      props.$active ? "rgba(255,68,68,0.4)" : "rgba(0,200,83,0.4)"};

  &:hover {
    transform: translateY(-2px);
  }
`;

const SmallButton = styled.button`
  background: #888;
  color: white;
  padding: 6px 14px;
  font-size: 13px;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
  pointer-events: ${(props) => (props.disabled ? "none" : "auto")};
  transition: background 0.2s;

  &:hover {
    background: #666;
  }
`;

const CircleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
`;

const CircleItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: #333;
  background: ${(props) => (props.$selected ? "#fff3cd" : "#fff")};
  border: 1px solid ${(props) => (props.$selected ? "#ffeb3b" : "#e0e0e0")};
  cursor: pointer;

  &:hover {
    background: ${(props) => (props.$selected ? "#fff3cd" : "#f5f5f5")};
  }
`;

const RemoveBtn = styled.button`
  background: none;
  border: none;
  color: #ff4444;
  font-weight: bold;
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;

  &:hover {
    color: #cc0000;
  }
`;
