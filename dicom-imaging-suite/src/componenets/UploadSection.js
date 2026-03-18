// UploadSection.js
import React from "react";
import styled from "styled-components";
import HelpModal from "./HelpModal";
import { AiOutlineQuestionCircle } from "react-icons/ai";
import { FaBrain } from "react-icons/fa";

const UploadSection = ({
  handleFolderChange,
  uploadStatus,
  setShowHelp,
  showHelp,
  setIsTestMode,
  setIsEnergyPairMode,
  setIsScanTestMode,
  setIsPhantomRobustnessMode,
}) => {
  return (
    <>
      <BrainIcon />
      <Title>SPR-Net</Title>
      <Subtitle>Analyze and process DECT scans with ease</Subtitle>
      <p>
        Welcome to the DECT-SPR Calibration Suite! This tool lets you analyze
        Dual-Energy CT (DECT) scans to determine Stopping Power Ratios (SPRs).
        To begin, you can either <b>upload a DICOM series to calibrate a model,</b>
        or if you already have a calibration file, you can <b>test it on a new
        dataset</b>
      </p>
      <ButtonGroup>
        <UploadButton
          onClick={() => document.getElementById("folderInput").click()}
        >
          Calibrate Series
        </UploadButton>
        <TestButton onClick={() => setIsTestMode(true)}>
          Test Calibration
        </TestButton>
        <EnergyPairButton onClick={() => setIsEnergyPairMode(true)}>
          Energy Pair Analysis
        </EnergyPairButton>
        <ScanTestButton onClick={() => setIsScanTestMode(true)}>
          Test with Scan
        </ScanTestButton>
        <RobustnessButton onClick={() => setIsPhantomRobustnessMode(true)}>
          Phantom Size Robustness
        </RobustnessButton>
      </ButtonGroup>
      <input
        type="file"
        id="folderInput"
        webkitdirectory="true"
        directory="true"
        style={{ display: "none" }}
        onChange={handleFolderChange}
      />
      {uploadStatus && <StatusMessage>{uploadStatus}</StatusMessage>}
      <HelpButton onClick={() => setShowHelp(true)}>
        <AiOutlineQuestionCircle size={24} />
      </HelpButton>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  );
};

export default UploadSection;

// Styled components
const BrainIcon = styled(FaBrain)`
  color: #ff6bcb;
  font-size: 80px;
  margin-bottom: 20px;
  animation: rotate 6s infinite linear;

  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;

const Title = styled.h1`
  font-size: 28px;
  color: #e0eafc;
  margin-bottom: 10px;
`;

const Subtitle = styled.h2`
  font-size: 16px;
  font-weight: 300;
  color: #a0b9e4;
  margin-bottom: 30px;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 15px;
  margin-top: 20px;
  justify-content: center;
`;

const UploadButton = styled.button`
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

const TestButton = styled(UploadButton)`
  background: #ffb347;
  color: #1f2a48;
  box-shadow: 0px 8px 15px rgba(255, 179, 71, 0.4);

  &:hover {
    box-shadow: 0px 12px 20px rgba(255, 179, 71, 0.6);
  }
`;

const EnergyPairButton = styled(UploadButton)`
  background: #4ecdc4;
  box-shadow: 0px 8px 15px rgba(78, 205, 196, 0.4);

  &:hover {
    box-shadow: 0px 12px 20px rgba(78, 205, 196, 0.6);
  }
`;

const ScanTestButton = styled(UploadButton)`
  background: #7b68ee;
  box-shadow: 0px 8px 15px rgba(123, 104, 238, 0.4);

  &:hover {
    box-shadow: 0px 12px 20px rgba(123, 104, 238, 0.6);
  }
`;

const RobustnessButton = styled(UploadButton)`
  background: #2ecc71;
  box-shadow: 0px 8px 15px rgba(46, 204, 113, 0.4);

  &:hover {
    box-shadow: 0px 12px 20px rgba(46, 204, 113, 0.6);
  }
`;

const StatusMessage = styled.p`
  color: #ff6bcb;
  margin-top: 20px;
`;

const HelpButton = styled.button`
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: none;
  border: none;
  cursor: pointer;
  color: #ff6bcb;
  font-size: 24px;
  transition: transform 0.2s;

  &:hover {
    transform: scale(1.1);
  }
`;
