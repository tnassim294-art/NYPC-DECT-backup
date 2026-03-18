import React, { useState } from "react";
import styled from "styled-components";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
  LabelList,
} from "recharts";

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <TooltipBox>
        <strong>Calibrated with: {d.calibration_material}</strong>
        <br />
        Z_eff: {d.z_eff}
        <br />
        c: {d.c} | d_e: {d.d_e}
        <br />
        Mean Relative Error: {d.mean_relative_error}%
      </TooltipBox>
    );
  }
  return null;
};

const ErrorSweepPlot = ({ data, onClose }) => {
  const [expandedMat, setExpandedMat] = useState(null);

  if (!data || data.length === 0) return null;

  const bestPoint = data.reduce(
    (best, d) => (d.mean_relative_error < best.mean_relative_error ? d : best),
    data[0]
  );

  return (
    <Overlay onClick={onClose}>
      <PlotContainer onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Calibration Error Sweep</Title>
          <CloseButton onClick={onClose}>X</CloseButton>
        </Header>
        <Subtitle>
          Mean relative SPR error when each material is used as the calibration
          reference
        </Subtitle>

        <ChartWrapper>
          <ChartTitle>Mean Relative Error (%) vs Calibration Material Z_eff</ChartTitle>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis
                dataKey="z_eff"
                type="number"
                domain={["auto", "auto"]}
                stroke="#aaa"
              >
                <Label
                  value="Calibration Material Z_eff"
                  position="bottom"
                  offset={10}
                  style={{ fill: "#ccc" }}
                />
              </XAxis>
              <YAxis
                dataKey="mean_relative_error"
                type="number"
                stroke="#aaa"
              >
                <Label
                  value="Mean Relative Error (%)"
                  angle={-90}
                  position="insideLeft"
                  offset={-10}
                  style={{ fill: "#ccc" }}
                />
              </YAxis>
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={data} fill="#ff6bcb" strokeWidth={0}>
                <LabelList
                  dataKey="calibration_material"
                  position="top"
                  style={{ fill: "#ddd", fontSize: 10 }}
                  offset={8}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartWrapper>

        <BestBadge>
          Best: <strong>{bestPoint.calibration_material}</strong> (Z_eff={bestPoint.z_eff}) &mdash;{" "}
          {bestPoint.mean_relative_error}% mean error
        </BestBadge>

        <DetailSection>
          <DetailTitle>Per-Material Breakdown</DetailTitle>
          {data.map((item) => (
            <MaterialRow key={item.calibration_material}>
              <MaterialHeader
                onClick={() =>
                  setExpandedMat(
                    expandedMat === item.calibration_material
                      ? null
                      : item.calibration_material
                  )
                }
              >
                <span>
                  {expandedMat === item.calibration_material ? "v" : ">"}{" "}
                  <strong>{item.calibration_material}</strong>{" "}
                  <Muted>(Z={item.z_eff})</Muted>
                </span>
                <ErrorBadge $low={item.mean_relative_error < 2}>
                  {item.mean_relative_error}%
                </ErrorBadge>
              </MaterialHeader>
              {expandedMat === item.calibration_material && (
                <DetailTable>
                  <thead>
                    <tr>
                      <Th>Test Material</Th>
                      <Th>SPR Calc</Th>
                      <Th>SPR Ref</Th>
                      <Th>Error %</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.per_material_errors.map((p) => (
                      <tr key={p.material}>
                        <Td>{p.material}</Td>
                        <Td>{p.spr_calculated}</Td>
                        <Td>{p.spr_reference ?? "N/A"}</Td>
                        <Td>{p.relative_error}%</Td>
                      </tr>
                    ))}
                  </tbody>
                </DetailTable>
              )}
            </MaterialRow>
          ))}
        </DetailSection>
      </PlotContainer>
    </Overlay>
  );
};

export default ErrorSweepPlot;

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const PlotContainer = styled.div`
  background: #1f2a48;
  border-radius: 20px;
  padding: 30px;
  max-width: 750px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Title = styled.h2`
  color: #e0eafc;
  margin: 0;
  font-size: 22px;
`;

const Subtitle = styled.p`
  color: #a0b9e4;
  font-size: 13px;
  margin: 8px 0 20px;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #aaa;
  font-size: 20px;
  font-weight: bold;
  cursor: pointer;
  &:hover {
    color: #fff;
  }
`;

const ChartWrapper = styled.div`
  margin-bottom: 20px;
`;

const ChartTitle = styled.h3`
  color: #ff6bcb;
  font-size: 16px;
  margin: 0 0 10px;
  text-align: center;
`;

const TooltipBox = styled.div`
  background: #2a3a60;
  padding: 10px 14px;
  border-radius: 8px;
  color: #e0eafc;
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid #4a5a80;
`;

const BestBadge = styled.div`
  background: rgba(0, 200, 83, 0.15);
  border: 1px solid rgba(0, 200, 83, 0.4);
  border-radius: 10px;
  padding: 10px 16px;
  color: #a0f0c0;
  font-size: 14px;
  text-align: center;
  margin-bottom: 20px;
`;

const DetailSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const DetailTitle = styled.h3`
  color: #6bbaff;
  font-size: 15px;
  margin: 0 0 8px;
`;

const MaterialRow = styled.div`
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  overflow: hidden;
`;

const MaterialHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  color: #e0eafc;
  font-size: 13px;
  &:hover {
    background: rgba(255, 255, 255, 0.06);
  }
`;

const Muted = styled.span`
  color: #8899bb;
`;

const ErrorBadge = styled.span`
  background: ${(props) =>
    props.$low ? "rgba(0,200,83,0.2)" : "rgba(255,107,203,0.2)"};
  color: ${(props) => (props.$low ? "#a0f0c0" : "#ffaadd")};
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
`;

const DetailTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin: 0;
`;

const Th = styled.th`
  color: #8899bb;
  font-size: 11px;
  font-weight: 600;
  text-align: left;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
`;

const Td = styled.td`
  color: #c8d8f0;
  font-size: 12px;
  padding: 5px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
`;
