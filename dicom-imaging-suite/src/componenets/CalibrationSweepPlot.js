import React from "react";
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
        <strong>{d.material}</strong>
        <br />
        Z_eff: {d.z_eff}
        <br />
        rho_e_w: {d.rho_e_w}
        <br />
        c: {d.c}
        <br />
        d_e: {d.d_e}
      </TooltipBox>
    );
  }
  return null;
};

const CalibrationSweepPlot = ({ data, onClose }) => {
  if (!data || data.length === 0) return null;

  return (
    <Overlay onClick={onClose}>
      <PlotContainer onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Calibration Parameter Sweep</Title>
          <CloseButton onClick={onClose}>X</CloseButton>
        </Header>
        <Subtitle>
          Each point shows c and d_e when that material is used as the single
          calibration reference
        </Subtitle>

        <ChartWrapper>
          <ChartTitle>c vs Z_eff</ChartTitle>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis
                dataKey="z_eff"
                type="number"
                domain={["auto", "auto"]}
                stroke="#aaa"
              >
                <Label
                  value="Z_eff"
                  position="bottom"
                  offset={10}
                  style={{ fill: "#ccc" }}
                />
              </XAxis>
              <YAxis dataKey="c" type="number" stroke="#aaa">
                <Label
                  value="c"
                  angle={-90}
                  position="insideLeft"
                  offset={0}
                  style={{ fill: "#ccc" }}
                />
              </YAxis>
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={data} fill="#ff6bcb" strokeWidth={0}>
                <LabelList
                  dataKey="material"
                  position="top"
                  style={{ fill: "#ddd", fontSize: 10 }}
                  offset={8}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartWrapper>

        <ChartWrapper>
          <ChartTitle>d_e vs Z_eff</ChartTitle>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis
                dataKey="z_eff"
                type="number"
                domain={["auto", "auto"]}
                stroke="#aaa"
              >
                <Label
                  value="Z_eff"
                  position="bottom"
                  offset={10}
                  style={{ fill: "#ccc" }}
                />
              </XAxis>
              <YAxis dataKey="d_e" type="number" stroke="#aaa">
                <Label
                  value="d_e"
                  angle={-90}
                  position="insideLeft"
                  offset={0}
                  style={{ fill: "#ccc" }}
                />
              </YAxis>
              <Tooltip content={<CustomTooltip />} />
              <Scatter data={data} fill="#6bbaff" strokeWidth={0}>
                <LabelList
                  dataKey="material"
                  position="top"
                  style={{ fill: "#ddd", fontSize: 10 }}
                  offset={8}
                />
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </PlotContainer>
    </Overlay>
  );
};

export default CalibrationSweepPlot;

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
  max-width: 700px;
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
  margin-bottom: 25px;
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
