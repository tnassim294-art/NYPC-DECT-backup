import React, { useState, useEffect } from "react";
import styled from "styled-components";
import TestResultsTable from "./TestResultsTable";
import CalibrationCurvePlot from "./CalibrationCurvePlot";
import { FaHome } from "react-icons/fa";

const TestResultsSection = ({
  results,
  selectedModel,
  handleBack,
  handleHome,
  downloadResultsAsCSV,
  sprMapUrls,
  onErrorSweep,
  rmse,
  calCurve,
  sprParams,
}) => {
  const [currentSlice, setCurrentSlice] = useState(0);

  useEffect(() => {
    setCurrentSlice(0);
  }, [sprMapUrls]);

  const handleSliderChange = (e) => {
    setCurrentSlice(Number(e.target.value));
  };

  return (
    <ResultsContainer>
      <ButtonGroup>
        <UtilityButton onClick={handleBack}>←</UtilityButton>
        <UtilityButton onClick={handleHome}>
          <FaHome />
        </UtilityButton>
        <UtilityButton onClick={downloadResultsAsCSV}>💾</UtilityButton>
      </ButtonGroup>
      {onErrorSweep && (
        <ErrorSweepButton onClick={onErrorSweep}>
          Error Sweep
        </ErrorSweepButton>
      )}

      {sprMapUrls && sprMapUrls.length > 0 && (
        <SprCard>
          <SprHeader>
            <SprTitle>SPR Map</SprTitle>
            <SliceCounter>
              Slice {currentSlice + 1} / {sprMapUrls.length}
            </SliceCounter>
          </SprHeader>

          <ViewerContainer>
            <MainImageWrapper>
              <SprImg
                src={sprMapUrls[currentSlice]}
                alt={`SPR Map slice ${currentSlice + 1}`}
              />
            </MainImageWrapper>

            {sprMapUrls.length > 1 && (
              <SliderWrapper>
                <VerticalSlider
                  type="range"
                  min="0"
                  max={sprMapUrls.length - 1}
                  value={currentSlice}
                  onChange={handleSliderChange}
                />
              </SliderWrapper>
            )}
          </ViewerContainer>
        </SprCard>
      )}

      {(calCurve || sprParams) && selectedModel === "Schneider" && (
        <CalibrationCurvePlot calCurve={calCurve} sprParams={sprParams} />
      )}
      {rmse != null && (
        <RmseBox>RMSE: {rmse}</RmseBox>
      )}
      <TestResultsTable results={results} selectedModel={selectedModel} rmse={rmse} />
    </ResultsContainer>
  );
};

export default TestResultsSection;

const ResultsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 20px;
  align-items: center;
  width: 100%;
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

const RmseBox = styled.div`
  background: rgba(255, 107, 203, 0.15);
  border: 1px solid #ff6bcb;
  border-radius: 10px;
  padding: 10px 24px;
  color: #ff6bcb;
  font-size: 16px;
  font-weight: 600;
`;

const ErrorSweepButton = styled.button`
  background: #6bbaff;
  color: white;
  padding: 12px 24px;
  font-size: 15px;
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

const SprCard = styled.div`
  width: 100%;
  max-width: 600px; 
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const SprHeader = styled.div`
  display: flex;
  justify-content: space-between;
  width: 100%;
  align-items: center;
  margin-bottom: 15px;
  padding: 0 10px;
`;

const SprTitle = styled.h3`
  margin: 0;
  color: #ff6bcb;
  font-weight: 600;
`;

const SliceCounter = styled.span`
  color: #e0eafc;
  font-size: 14px;
  opacity: 0.8;
`;

const ViewerContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 15px;
  width: 100%;
  height: 400px;
`;

const MainImageWrapper = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  overflow: hidden;
`;

const SprImg = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
`;

const SliderWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  background: rgba(0, 0, 0, 0.1);
  border-radius: 15px;
  padding: 10px 0;
`;

const VerticalSlider = styled.input`
  -webkit-appearance: slider-vertical;
  width: 8px;
  height: 100%;
  outline: none;
  cursor: pointer;

  transform: rotate(180deg);

  accent-color: #ff6bcb;
`;
