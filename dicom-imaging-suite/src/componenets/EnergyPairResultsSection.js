import React, { useState } from "react";
import styled from "styled-components";
import { FaHome } from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Label,
} from "recharts";

const getErrorColor = (error, minErr, maxErr) => {
  if (maxErr === minErr) return "rgba(78, 205, 196, 0.7)";
  const normalized = (error - minErr) / (maxErr - minErr);
  const r = Math.round(60 + 195 * normalized);
  const g = Math.round(200 * (1 - normalized) + 60);
  return `rgba(${r}, ${g}, 80, 0.7)`;
};

const CustomBarTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <TooltipBox>
        <strong>
          {d.low_kvp} + {d.high_kvp} kVp
        </strong>
        <br />
        Mean Error: {d.mean_abs_error}%
        <br />
        c: {d.c} | d_e: {d.d_e}
        <br />
        Cal. Material: {d.calibration_material}
      </TooltipBox>
    );
  }
  return null;
};

const EnergyPairResultsSection = ({ data, handleHome }) => {
  const [expandedPair, setExpandedPair] = useState(null);

  if (!data || !data.pairs || data.pairs.length === 0) {
    return <p>No results available.</p>;
  }

  const { energies, pairs, best_pair } = data;
  const errors = pairs.map((p) => p.mean_abs_error);
  const minErr = Math.min(...errors);
  const maxErr = Math.max(...errors);

  // Build lookup for heatmap
  const pairLookup = {};
  pairs.forEach((p) => {
    pairLookup[`${p.low_kvp}-${p.high_kvp}`] = p;
  });

  // Bar chart data (already sorted by error from backend)
  const barData = pairs.map((p) => ({
    ...p,
    label: `${p.low_kvp}+${p.high_kvp}`,
  }));

  const togglePair = (key) => {
    setExpandedPair(expandedPair === key ? null : key);
  };

  return (
    <Container>
      <HeaderRow>
        <UtilityButton onClick={handleHome}>
          <FaHome />
        </UtilityButton>
        <Title>Energy Pair Analysis Results</Title>
      </HeaderRow>

      <EnergiesLabel>
        Energies: {energies.join(", ")} kVp &mdash; {pairs.length} pairs analyzed
      </EnergiesLabel>

      {best_pair && (
        <BestBadge>
          Best Pair: <strong>{best_pair.low_kvp} + {best_pair.high_kvp} kVp</strong>{" "}
          &mdash; {best_pair.mean_abs_error}% mean error
        </BestBadge>
      )}

      <SectionTitle>Error Heatmap</SectionTitle>
      <HeatmapContainer>
        <HeatmapGrid $cols={energies.length}>
          <HeatmapCell $header />
          {energies.map((e) => (
            <HeatmapCell key={`col-${e}`} $header>
              {e}
            </HeatmapCell>
          ))}
          {energies.map((rowE) => (
            <React.Fragment key={`row-${rowE}`}>
              <HeatmapCell $header>{rowE}</HeatmapCell>
              {energies.map((colE) => {
                if (colE <= rowE) {
                  return <HeatmapCell key={`${rowE}-${colE}`} $empty />;
                }
                const key = `${rowE}-${colE}`;
                const pair = pairLookup[key];
                if (!pair) return <HeatmapCell key={key} $empty />;
                const isBest =
                  best_pair &&
                  pair.low_kvp === best_pair.low_kvp &&
                  pair.high_kvp === best_pair.high_kvp;
                return (
                  <HeatmapCell
                    key={key}
                    $bg={getErrorColor(pair.mean_abs_error, minErr, maxErr)}
                    $clickable
                    $best={isBest}
                    onClick={() => togglePair(key)}
                  >
                    {pair.mean_abs_error}%
                  </HeatmapCell>
                );
              })}
            </React.Fragment>
          ))}
        </HeatmapGrid>
        <HeatmapLegend>
          <span>Low kVp (rows) vs High kVp (columns)</span>
        </HeatmapLegend>
      </HeatmapContainer>

      <SectionTitle>Pairs Ranked by Error</SectionTitle>
      <ChartWrapper>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={barData} margin={{ top: 10, right: 30, bottom: 30, left: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#444" />
            <XAxis dataKey="label" stroke="#aaa">
              <Label
                value="Energy Pair (kVp)"
                position="bottom"
                offset={10}
                style={{ fill: "#ccc" }}
              />
            </XAxis>
            <YAxis stroke="#aaa">
              <Label
                value="Mean Abs Error (%)"
                angle={-90}
                position="insideLeft"
                offset={-10}
                style={{ fill: "#ccc" }}
              />
            </YAxis>
            <Tooltip content={<CustomBarTooltip />} />
            <Bar dataKey="mean_abs_error" fill="#ff6bcb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartWrapper>

      <SectionTitle>Per-Pair Detail</SectionTitle>
      <DetailSection>
        {pairs.map((pair) => {
          const key = `${pair.low_kvp}-${pair.high_kvp}`;
          const isExpanded = expandedPair === key;
          const isBest =
            best_pair &&
            pair.low_kvp === best_pair.low_kvp &&
            pair.high_kvp === best_pair.high_kvp;
          return (
            <MaterialRow key={key}>
              <MaterialHeader onClick={() => togglePair(key)}>
                <span>
                  {isExpanded ? "v" : ">"}{" "}
                  <strong>
                    {pair.low_kvp} + {pair.high_kvp} kVp
                  </strong>{" "}
                  <Muted>
                    (c={pair.c}, d_e={pair.d_e}, cal: {pair.calibration_material})
                  </Muted>
                </span>
                <ErrorBadge $low={isBest}>{pair.mean_abs_error}%</ErrorBadge>
              </MaterialHeader>
              {isExpanded && pair.per_material && (
                <DetailTable>
                  <thead>
                    <tr>
                      <Th>Material</Th>
                      <Th>SPR Calc</Th>
                      <Th>SPR Ref</Th>
                      <Th>Error %</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {pair.per_material.map((p) => (
                      <tr key={p.material}>
                        <Td>{p.material}</Td>
                        <Td>{p.spr_calc}</Td>
                        <Td>{p.spr_ref ?? "N/A"}</Td>
                        <Td>{p.error_pct}%</Td>
                      </tr>
                    ))}
                  </tbody>
                </DetailTable>
              )}
            </MaterialRow>
          );
        })}
      </DetailSection>
    </Container>
  );
};

export default EnergyPairResultsSection;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  align-items: center;
  width: 100%;
`;

const HeaderRow = styled.div`
  position: relative;
  width: 100%;
  margin-bottom: 10px;
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

const Title = styled.h1`
  text-align: center;
  color: #e0eafc;
  font-size: 22px;
  margin: 0;
`;

const EnergiesLabel = styled.p`
  color: #8899bb;
  font-size: 14px;
  margin: 0;
`;

const BestBadge = styled.div`
  background: rgba(0, 200, 83, 0.15);
  border: 1px solid rgba(0, 200, 83, 0.4);
  border-radius: 10px;
  padding: 10px 16px;
  color: #a0f0c0;
  font-size: 14px;
  text-align: center;
`;

const SectionTitle = styled.h3`
  color: #ff6bcb;
  font-size: 16px;
  margin: 10px 0 5px;
  text-align: center;
`;

const HeatmapContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
`;

const HeatmapGrid = styled.div`
  display: grid;
  grid-template-columns: 60px repeat(${(props) => props.$cols}, 1fr);
  gap: 3px;
  max-width: 500px;
  width: 100%;
`;

const HeatmapCell = styled.div`
  padding: 10px 6px;
  text-align: center;
  font-size: 12px;
  font-weight: ${(props) => (props.$header ? "700" : "600")};
  border-radius: 6px;
  background: ${(props) =>
    props.$header
      ? "rgba(255,255,255,0.08)"
      : props.$empty
      ? "transparent"
      : props.$bg || "rgba(255,255,255,0.04)"};
  color: ${(props) => (props.$header ? "#8899bb" : "#e0eafc")};
  cursor: ${(props) => (props.$clickable ? "pointer" : "default")};
  border: ${(props) =>
    props.$best ? "2px solid #00c853" : "1px solid rgba(255,255,255,0.06)"};
  transition: transform 0.15s;

  &:hover {
    ${(props) => props.$clickable && "transform: scale(1.05);"}
  }
`;

const HeatmapLegend = styled.div`
  font-size: 11px;
  color: #667;
`;

const ChartWrapper = styled.div`
  width: 100%;
  max-width: 600px;
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

const DetailSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
  max-width: 600px;
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
  font-size: 11px;
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
