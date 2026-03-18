import React, { useMemo } from "react";
import styled from "styled-components";
import {
  ComposedChart,
  Scatter,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function buildFitLine(sprParams, allHUs) {
  if (!sprParams || sprParams.length < 8) return [];
  const [mLung, cLung, mSoft, cSoft, mBone, cBone, splitL, splitH] = sprParams;
  const minHU = Math.min(...allHUs) - 50;
  const maxHU = Math.max(...allHUs) + 50;

  const pts = [];
  // lung segment
  pts.push({ hu: minHU,  fitSpr: mLung * minHU + cLung });
  pts.push({ hu: splitL, fitSpr: mLung * splitL + cLung });
  // soft segment — duplicate splitL point so line is continuous
  pts.push({ hu: splitL, fitSpr: mSoft * splitL + cSoft });
  pts.push({ hu: splitH, fitSpr: mSoft * splitH + cSoft });
  // bone segment — duplicate splitH point
  pts.push({ hu: splitH, fitSpr: mBone * splitH + cBone });
  pts.push({ hu: maxHU,  fitSpr: mBone * maxHU + cBone });
  return pts;
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <TooltipBox>
      {d.material && <div style={{ fontWeight: 600, marginBottom: 4 }}>{d.material}</div>}
      {d.hu != null && <div>HU: {d.hu.toFixed(1)}</div>}
      {d.spr != null && <div>SPR: {d.spr.toFixed(4)}</div>}
      {d.fitSpr != null && <div>Fit SPR: {d.fitSpr.toFixed(4)}</div>}
    </TooltipBox>
  );
};

const CalibrationCurvePlot = ({ calCurve, sprParams }) => {
  const icrpData = useMemo(
    () => (calCurve?.icrp_points || []).map((p) => ({ hu: p.hu, spr: p.spr })),
    [calCurve]
  );
  const phantomData = useMemo(
    () => (calCurve?.phantom_points || []).map((p) => ({ hu: p.hu, spr: p.spr })),
    [calCurve]
  );

  const allHUs = useMemo(
    () => [...icrpData, ...phantomData].map((p) => p.hu),
    [icrpData, phantomData]
  );

  const fitLine = useMemo(
    () => buildFitLine(sprParams, allHUs.length ? allHUs : [-1000, 2000]),
    [sprParams, allHUs]
  );

  if (!calCurve && !sprParams) return null;

  return (
    <Card>
      <Title>SPR Calibration Curve</Title>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis
            dataKey="hu"
            type="number"
            domain={["auto", "auto"]}
            label={{ value: "HU", position: "insideBottom", offset: -10, fill: "#a0b9e4" }}
            tick={{ fill: "#a0b9e4", fontSize: 11 }}
          />
          <YAxis
            dataKey="spr"
            type="number"
            domain={["auto", "auto"]}
            label={{ value: "SPR", angle: -90, position: "insideLeft", offset: 10, fill: "#a0b9e4" }}
            tick={{ fill: "#a0b9e4", fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: "#a0b9e4", fontSize: 12, paddingTop: 10 }}
          />

          {fitLine.length > 0 && (
            <Line
              data={fitLine}
              dataKey="fitSpr"
              type="linear"
              stroke="#00e5ff"
              strokeWidth={2}
              dot={false}
              name="Piecewise fit"
              legendType="line"
            />
          )}

          {icrpData.length > 0 && (
            <Scatter
              data={icrpData}
              dataKey="spr"
              fill="#4fc3f7"
              name="ICRP tissues"
              r={3}
              legendType="circle"
            />
          )}

          {phantomData.length > 0 && (
            <Scatter
              data={phantomData}
              dataKey="spr"
              fill="#ff6bcb"
              name="Phantom anchors"
              r={5}
              legendType="circle"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
};

export default CalibrationCurvePlot;

const Card = styled.div`
  width: 100%;
  max-width: 600px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 20px 20px 10px;
`;

const Title = styled.h3`
  margin: 0 0 12px;
  color: #ff6bcb;
  font-size: 16px;
  font-weight: 600;
`;

const TooltipBox = styled.div`
  background: #1f2a48;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: #e0eafc;
`;
