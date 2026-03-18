import React from "react";
import styled from "styled-components";

const EnergyPairUploadSection = ({ handleFolderChange, uploadStatus, handleBack }) => {
  return (
    <>
      <BackButton onClick={handleBack}>←</BackButton>
      <Title>Energy Pair Analysis</Title>
      <Subtitle>
        Compare how different kVp energy pairings affect SPR calibration accuracy.
      </Subtitle>
      <Instructions>
        Upload a parent folder containing one subfolder per energy level.
        Each subfolder should hold the DICOM slices for that energy.
      </Instructions>
      <FolderStructure>
        <code>
          parent_folder/<br />
          &nbsp;&nbsp;scan_80/<br />
          &nbsp;&nbsp;&nbsp;&nbsp;slice001.dcm, slice002.dcm, ...<br />
          &nbsp;&nbsp;scan_100/<br />
          &nbsp;&nbsp;&nbsp;&nbsp;slice001.dcm, slice002.dcm, ...<br />
          &nbsp;&nbsp;scan_120/<br />
          &nbsp;&nbsp;&nbsp;&nbsp;...<br />
        </code>
      </FolderStructure>
      <UploadButton
        onClick={() => document.getElementById("energyFolderInput").click()}
      >
        Upload Multi-Energy Folder
      </UploadButton>
      <input
        type="file"
        id="energyFolderInput"
        webkitdirectory="true"
        directory="true"
        style={{ display: "none" }}
        onChange={handleFolderChange}
      />
      {uploadStatus && <StatusMessage>{uploadStatus}</StatusMessage>}
    </>
  );
};

export default EnergyPairUploadSection;

const BackButton = styled.button`
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

const Title = styled.h1`
  font-size: 28px;
  color: #e0eafc;
  margin-bottom: 10px;
`;

const Subtitle = styled.h2`
  font-size: 16px;
  font-weight: 300;
  color: #a0b9e4;
  margin-bottom: 10px;
`;

const Instructions = styled.p`
  font-size: 14px;
  color: #8899bb;
  margin-bottom: 15px;
`;

const FolderStructure = styled.div`
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 15px 20px;
  margin-bottom: 25px;
  text-align: left;
  display: inline-block;
  font-size: 13px;
  color: #a0f0c0;
  line-height: 1.6;
`;

const UploadButton = styled.button`
  background: #4ecdc4;
  color: white;
  padding: 15px 25px;
  font-size: 16px;
  border: none;
  border-radius: 50px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0px 8px 15px rgba(78, 205, 196, 0.4);
  margin-bottom: 10px;

  &:hover {
    transform: translateY(-3px);
    box-shadow: 0px 12px 20px rgba(78, 205, 196, 0.6);
  }
`;

const StatusMessage = styled.p`
  color: #ff6bcb;
  margin-top: 20px;
`;
