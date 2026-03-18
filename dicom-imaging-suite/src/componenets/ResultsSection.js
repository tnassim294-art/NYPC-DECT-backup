import React, { useState } from "react";
import styled from "styled-components";
import ResultsTable from "./ResultsTable";
import ComparisonTable from "./ComparisonTable";
import { FaHome } from "react-icons/fa";

const ResultsSection = ({
  results,
  selectedModel,
  comparisonResults,
  comparisonModel,
  showCompareMenu,
  setShowCompareMenu,
  setShowCompareResults,
  handleBack,
  handleHome,
  downloadResultsAsCSV,
  models,
  setComparisonModel,
  comparisonRadius,
  setComparisonRadius,
  handleCompare,
  showCompareResults,
  sprMapUrls,
}) => {
  const [mapIndex, setMapIndex] = useState(0);

  const downloadCalibration = () => {
    if (!results || Object.keys(results).length === 0) {
      window.alert("No calibration results to save.");
      return;
    }

    const calibrationData = {
      model: selectedModel,
      ...(selectedModel === "Tanaka" && {
        alpha: results.alpha,
        gamma: results.gamma,
        a: results.a,
        b: results.b,
        c0: results.c0,
        c1: results.c1,
      }),
      ...(selectedModel === "Saito" && {
        alpha: results.alpha,
        a: results.a,
        b: results.b,
        r: results.r,
        gamma: results.gamma,
      }),
      ...(selectedModel === "Hunemohr" && {
        c: results.c,
        d_e: results.d_e,
      }),
      rho_rmse: results.error_metrics?.rho?.RMSE || "N/A",
      z_rmse: results.error_metrics?.z?.RMSE || "N/A",
      rho_r2: results.error_metrics?.rho?.R2 || "N/A",
      z_r2: results.error_metrics?.z?.R2 || "N/A",
      reference_spr_values: results.reference_spr_values || {},
    };

    const jsonContent = JSON.stringify(calibrationData, null, 2);
    const blob = new Blob([jsonContent], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${selectedModel}_calibration.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <ResultsContainer>
      <ButtonGroup>
        <UtilityButton onClick={handleBack}>←</UtilityButton>
        <UtilityButton onClick={handleHome}>
          <FaHome />
        </UtilityButton>
        <UtilityButton onClick={downloadResultsAsCSV}>💾</UtilityButton>
        <UtilityButton onClick={downloadCalibration}>📥</UtilityButton>
      </ButtonGroup>

      {/* Container for Side-by-Side Layout */}
      <TopContent>
        {/* Left Side: SPR Map */}
        <MapColumn>
          {sprMapUrls && sprMapUrls.length > 0 ? (
            <SprCard>
              <SprTitle>
                SPR Map (Slice {mapIndex + 1}/{sprMapUrls.length})
              </SprTitle>
              <SprImg src={sprMapUrls[mapIndex]} alt="SPR Map" />

              {sprMapUrls.length > 1 && (
                <SliderContainer>
                  <RadiusSlider
                    type="range"
                    min="0"
                    max={sprMapUrls.length - 1}
                    value={mapIndex}
                    onChange={(e) => setMapIndex(Number(e.target.value))}
                  />
                </SliderContainer>
              )}
            </SprCard>
          ) : (
            <PlaceholderText>No SPR Map Available</PlaceholderText>
          )}
        </MapColumn>

        {/* Right Side: Results Table */}
        <TableColumn>
          <ResultsTable results={results} selectedModel={selectedModel} />
        </TableColumn>
      </TopContent>

      <ToggleCompareButton
        onClick={() => {
          setShowCompareMenu(!showCompareMenu);
          setShowCompareResults(!showCompareResults);
        }}
      >
        {showCompareMenu
          ? "Cancel Comparison"
          : "🔍 Compare with Another Model"}
      </ToggleCompareButton>
      {showCompareMenu && (
        <AnimatedCompareMenu>
          <h3 style={{ color: "#ff6bcb" }}>Run Comparison</h3>
          <SelectContainer>
            <label>Choose Another Model:</label>
            <Select
              value={comparisonModel}
              onChange={(e) => setComparisonModel(e.target.value)}
            >
              {models.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name}
                </option>
              ))}
            </Select>
          </SelectContainer>
          <SliderContainer>
            <label>Comparison Radius: {comparisonRadius}px</label>
            <RadiusSlider
              type="range"
              min="1"
              max="100"
              value={comparisonRadius}
              onChange={(e) => setComparisonRadius(e.target.value)}
            />
          </SliderContainer>
          <MainButton onClick={handleCompare}>Run Comparison</MainButton>
        </AnimatedCompareMenu>
      )}
      {comparisonResults.length > 0 && showCompareResults && (
        <ComparisonTable
          comparisonResults={comparisonResults}
          comparisonModel={comparisonModel}
        />
      )}
    </ResultsContainer>
  );
};

export default ResultsSection;

const ResultsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 20px;
  align-items: center;
  width: 100%;
`;

const TopContent = styled.div`
  display: flex;
  flex-direction: row;
  gap: 30px; /* Reduced gap slightly for tighter look */
  width: 100%;
  justify-content: center; /* Centers the block of map+table */
  align-items: flex-start;
  flex-wrap: wrap;
`;

const MapColumn = styled.div`
  /* flex: 0 0 auto; ensures it wraps only the content size, preventing huge gaps */
  flex: 0 0 auto;
  width: 100%;
  max-width: 500px; /* Constraints width so map isn't too huge */
  display: flex;
  justify-content: center;
`;

const TableColumn = styled.div`
  flex: 0 0 auto;
  width: 100%;
  max-width: 600px; /* Constraints width for readability */
  display: flex;
  justify-content: center;
`;

const PlaceholderText = styled.div`
  color: #aaa;
  font-style: italic;
  margin-top: 50px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 20px;
`;

const UtilityButton = styled.button`
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

const ToggleCompareButton = styled.button`
  margin-top: 20px;
  background: #ffb347;
  color: #1f2a48;
  padding: 10px 20px;
  font-size: 15px;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  transition: background 0.2s;
  &:hover {
    background: #ffa500;
  }
`;

const AnimatedCompareMenu = styled.div`
  margin-top: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #ff6bcb;
  border-radius: 15px;
  animation: fadeIn 0.3s ease-in-out;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

const SelectContainer = styled.div`
  margin: 20px 0;
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

const SliderContainer = styled.div`
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #ff6bcb;
  width: 100%;
`;

const RadiusSlider = styled.input`
  width: 80%;
  margin-top: 10px;
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

const SprCard = styled.div`
  width: 100%;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 12px 12px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* Added margin-top to match the ResultsTable's internal margin */
  margin-top: 20px;
`;

const SprTitle = styled.h3`
  margin: 6px 0 12px;
  color: #ff6bcb;
  font-weight: 600;
  font-size: 18px;
`;

const SprImg = styled.img`
  width: 100%;
  height: auto;
  border-radius: 12px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
`;
