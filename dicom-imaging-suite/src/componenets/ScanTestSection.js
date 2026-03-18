// ScanTestSection.js
import React, { useState, useRef, useEffect } from "react";
import styled from "styled-components";
import { FaFolderOpen, FaArrowLeft, FaCheck, FaBug } from "react-icons/fa";

const INPUTS = [
  { key: "calH",  label: "Calibration — High Energy (H)", color: "#6bbaff" },
  { key: "calL",  label: "Calibration — Low Energy (L)",  color: "#4ecdc4" },
  { key: "testH", label: "Test — High Energy (H)",        color: "#ffb347" },
  { key: "testL", label: "Test — Low Energy (L)",         color: "#ff6bcb" },
];

/** Sort a FileList by the trailing numeric segment of the filename (Siemens UID order). */
function sortBySliceOrder(files) {
  return Array.from(files).sort((a, b) => {
    const numA = parseInt((a.name.match(/(\d+)(?:\.[^.]+)?$/) || ["0", "0"])[1], 10);
    const numB = parseInt((b.name.match(/(\d+)(?:\.[^.]+)?$/) || ["0", "0"])[1], 10);
    return numA - numB;
  });
}

/** Return the middle `n` items from a sorted array. */
function centerSlices(arr, n = 10) {
  if (arr.length <= n) return arr;
  const start = Math.floor((arr.length - n) / 2);
  return arr.slice(start, start + n);
}

/** Pick one representative file from the middle of a FileList. */
function pickMiddleFile(files) {
  const sorted = sortBySliceOrder(files);
  const center = centerSlices(sorted, 1);
  return center[0] ?? sorted[0];
}

const ScanTestSection = ({ handleScanTestUpload, uploadStatus, handleBack, scanTestResults }) => {
  const [folders, setFolders] = useState({ calH: null, calL: null, testH: null, testL: null });
  const [debugImages, setDebugImages] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState(null);
  const [customCircles, setCustomCircles] = useState(null);

  const setFolder = (key, files) => setFolders(prev => ({ ...prev, [key]: files }));

  const allSelected = INPUTS.every(i => folders[i.key] !== null);

  const onRun = () => {
    if (!allSelected) {
      window.alert("Please select all four DICOM folders before running.");
      return;
    }
    handleScanTestUpload(folders, customCircles);
  };

  const onDebug = async () => {
    if (!allSelected) {
      window.alert("Please select all four folders first.");
      return;
    }
    setDebugLoading(true);
    setDebugError(null);
    setDebugImages(null);
    try {
      const results = await Promise.all(
        INPUTS.map(async ({ key, label, color }) => {
          const file = pickMiddleFile(folders[key]);
          const fd = new FormData();
          fd.append("dicom_file", file, file.name);
          fd.append("phantom_type", "head");
          const res = await fetch("http://127.0.0.1:5050/debug-registration", {
            method: "POST",
            body: fd,
          });
          if (!res.ok) {
            const err = await res.json();
            throw new Error(`${label}: ${err.detail || res.status}`);
          }
          const data = await res.json();
          return { key, label, color, ...data, filename: file.name };
        })
      );
      setDebugImages(results);
      setCustomCircles({});  // reset manual adjustments on each fresh debug run
    } catch (e) {
      setDebugError(e.message);
    } finally {
      setDebugLoading(false);
    }
  };

  return (
    <>
      <BackButton onClick={handleBack}><FaArrowLeft /></BackButton>

      <Title>Test with Scan — Hunemohr</Title>
      <Subtitle>
        Select four DICOM folders: calibration H &amp; L (used to fit model parameters),
        and test H &amp; L (evaluated for RMSE). The center 10 slices are used automatically
        and the phantom is located via boundary detection — no manual circle placement needed.
      </Subtitle>

      <FolderGrid>
        {INPUTS.map(({ key, label, color }) => (
          <FolderCard key={key} color={color}>
            <CardLabel>{label}</CardLabel>
            <FolderBtn
              color={color}
              onClick={() => document.getElementById(`scanInput_${key}`).click()}
            >
              <FaFolderOpen style={{ marginRight: 8 }} />
              {folders[key] ? `${folders[key].length} files` : "Select folder"}
            </FolderBtn>
            <input
              type="file"
              id={`scanInput_${key}`}
              webkitdirectory="true"
              directory="true"
              style={{ display: "none" }}
              onChange={e => setFolder(key, e.target.files)}
            />
            {folders[key] && (
              <FileCount><FaCheck size={10} style={{ marginRight: 4 }} />{folders[key].length} files selected</FileCount>
            )}
          </FolderCard>
        ))}
      </FolderGrid>

      <ButtonRow>
        <RunButton onClick={onRun} disabled={!allSelected}>
          Run Hunemohr Test
        </RunButton>
        <DebugButton onClick={onDebug} disabled={!allSelected || debugLoading}>
          <FaBug style={{ marginRight: 7 }} />
          {debugLoading ? "Loading..." : "Debug ROI Placement"}
        </DebugButton>
      </ButtonRow>

      {uploadStatus && <StatusMessage>{uploadStatus}</StatusMessage>}
      {debugError && <ErrorMessage>{debugError}</ErrorMessage>}

      {debugImages && (
        <DebugGrid
          images={debugImages}
          customCircles={customCircles}
          onCirclesChange={(key, updated) => setCustomCircles(prev => ({ ...(prev || {}), [key]: updated }))}
        />
      )}

      {scanTestResults && <Results data={scanTestResults} />}
    </>
  );
};

// ── Circle palette (matches backend order) ────────────────────────────────────
const CIRCLE_PALETTE = [
  "#ff6464","#64ff64","#6464ff","#ffff00","#ff64ff",
  "#00ffff","#ffb400","#b400ff","#00b4ff","#ff3c3c","#3cff3c",
];

// ── Interactive debug card ─────────────────────────────────────────────────────
const InteractiveDebugCard = ({ label, color, filename, image_b64, detected_cx, detected_cy, detected_radius, image_width = 512, image_height = 512, circles, insert_hu, onCirclesChange }) => {
  const [localCircles, setLocalCircles] = useState(circles || []);
  const dragging = useRef(null);
  const svgRef = useRef(null);

  // Sync when parent resets circles (e.g. on new debug run)
  useEffect(() => { setLocalCircles(circles || []); }, [circles]);

  const toImgCoords = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.round((clientX - rect.left) / rect.width  * image_width),
      y: Math.round((clientY - rect.top)  / rect.height * image_height),
    };
  };

  const onMouseDown = (e, idx) => { e.preventDefault(); dragging.current = idx; };

  const onMouseMove = (e) => {
    if (dragging.current === null) return;
    const { x, y } = toImgCoords(e.clientX, e.clientY);
    setLocalCircles(prev => prev.map((c, i) => i === dragging.current ? { ...c, x, y } : c));
  };

  const onMouseUp = () => {
    if (dragging.current !== null) {
      onCirclesChange && onCirclesChange(localCircles);
      dragging.current = null;
    }
  };

  return (
    <DebugCard color={color}>
      <DebugCardLabel color={color}>{label}</DebugCardLabel>
      <DebugFilename>{filename}</DebugFilename>
      <div style={{ position: "relative", width: "100%", userSelect: "none" }}>
        <DebugImage src={`data:image/png;base64,${image_b64}`} alt={label} draggable={false} />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${image_width} ${image_height}`}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", cursor: "crosshair" }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* Phantom boundary */}
          {detected_radius && (
            <circle cx={detected_cx} cy={detected_cy} r={detected_radius}
              fill="none" stroke="#00ff00" strokeWidth={2} pointerEvents="none" />
          )}
          {/* Insert circles */}
          {localCircles.map((c, i) => {
            const stroke = CIRCLE_PALETTE[i % CIRCLE_PALETTE.length];
            const sampleR = Math.round(c.radius * 0.7);
            return (
              <g key={i} style={{ cursor: "grab" }} onMouseDown={e => onMouseDown(e, i)}>
                {/* Transparent hit area — makes entire circle interior draggable */}
                <circle cx={c.x} cy={c.y} r={c.radius}
                  fill="transparent" stroke={stroke} strokeWidth={2} />
                {/* Inner 70% sampling region */}
                <circle cx={c.x} cy={c.y} r={sampleR}
                  fill={`${stroke}20`} stroke={stroke} strokeWidth={1}
                  strokeDasharray="4 3" pointerEvents="none" />
                {/* Label */}
                <text x={c.x} y={c.y - c.radius - 4}
                  fill={stroke} fontSize={11} textAnchor="middle"
                  style={{ pointerEvents: "none", userSelect: "none" }}>
                  {c.material}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <DebugMeta>
        cx={detected_cx?.toFixed(1)}, cy={detected_cy?.toFixed(1)}, r={detected_radius?.toFixed(1)} px
        &nbsp;·&nbsp; drag circles to adjust
      </DebugMeta>
      {insert_hu && (
        <DebugHuTable>
          {Object.entries(insert_hu).map(([mat, hu]) => (
            <DebugHuRow key={mat}>
              <span>{mat}</span>
              <span>{hu !== null ? `${hu} HU` : "—"}</span>
            </DebugHuRow>
          ))}
        </DebugHuTable>
      )}
    </DebugCard>
  );
};

// ── Debug grid ─────────────────────────────────────────────────────────────────
const DebugGrid = ({ images, customCircles, onCirclesChange }) => {
  const hasAdjustments = customCircles && Object.keys(customCircles).length > 0;
  return (
    <DebugWrapper>
      <DebugTitle>ROI Placement — Middle Slice per Series</DebugTitle>
      <DebugSubtitle>
        Solid circle = full insert boundary &nbsp;·&nbsp; Dashed inner circle = 70% sampling region
        &nbsp;·&nbsp; <strong style={{ color: "#ffb347" }}>Drag circles to adjust position</strong>
        {hasAdjustments && <span style={{ color: "#2ecc71", marginLeft: 8 }}>✓ Adjusted positions will be used for test</span>}
      </DebugSubtitle>
      <DebugImageGrid>
        {images.map(({ key, label, color, image_b64, detected_cx, detected_cy, detected_radius, image_width, image_height, circles, filename, insert_hu }) => (
          <InteractiveDebugCard
            key={key}
            label={label} color={color} filename={filename}
            image_b64={image_b64}
            detected_cx={detected_cx} detected_cy={detected_cy} detected_radius={detected_radius}
            image_width={image_width} image_height={image_height}
            circles={customCircles?.[key] || circles}
            insert_hu={insert_hu}
            onCirclesChange={(updated) => onCirclesChange(key, updated)}
          />
        ))}
      </DebugImageGrid>
    </DebugWrapper>
  );
};

// ── Results display ────────────────────────────────────────────────────────────
const Results = ({ data }) => {
  const { rmse, c, d_e, cal_slices, test_slices, cal_phantom_r, test_phantom_r, results } = data;

  return (
    <ResultsWrapper>
      <ResultsTitle>Hunemohr Results</ResultsTitle>

      <MetaRow>
        <MetaChip label="RMSE" value={rmse !== null ? rmse.toFixed(4) : "—"} highlight />
        <MetaChip label="c"    value={c?.toFixed(4)} />
        <MetaChip label="d_e"  value={d_e?.toFixed(4)} />
        <MetaChip label="Cal slices"  value={cal_slices} />
        <MetaChip label="Test slices" value={test_slices} />
        <MetaChip label="Cal phantom radius"  value={cal_phantom_r  ? `${cal_phantom_r} px`  : "—"} />
        <MetaChip label="Test phantom radius" value={test_phantom_r ? `${test_phantom_r} px` : "—"} />
      </MetaRow>

      <ResultTable>
        <thead>
          <tr>
            <RTh>Material</RTh>
            <RTh>Predicted SPR</RTh>
            <RTh>True SPR</RTh>
            <RTh>Error</RTh>
            <RTh>% Error</RTh>
          </tr>
        </thead>
        <tbody>
          {results.map(r => (
            <tr key={r.material}>
              <RTd>{r.material}</RTd>
              <RTd>{r.predicted_spr.toFixed(4)}</RTd>
              <RTd muted>{r.true_spr.toFixed(4)}</RTd>
              <RTd error={Math.abs(r.error) > 0.05}>{r.error > 0 ? "+" : ""}{r.error.toFixed(4)}</RTd>
              <RTd error={r.pct_error > 5}>{r.pct_error.toFixed(2)}%</RTd>
            </tr>
          ))}
        </tbody>
      </ResultTable>
    </ResultsWrapper>
  );
};

const MetaChip = ({ label, value, highlight }) => (
  <Chip highlight={highlight}>
    <ChipLabel>{label}</ChipLabel>
    <ChipValue highlight={highlight}>{value ?? "—"}</ChipValue>
  </Chip>
);

export default ScanTestSection;

// ── Styled components ──────────────────────────────────────────────────────────
const BackButton = styled.button`
  position: absolute; top: 10px; left: 20px;
  background: rgba(255,255,255,0.08); color: #a0b9e4;
  border: none; border-radius: 50%; width: 36px; height: 36px;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.2s;
  &:hover { background: rgba(255,255,255,0.15); color: #e0eafc; }
`;

const Title = styled.h1`font-size: 24px; color: #e0eafc; margin-bottom: 8px;`;

const Subtitle = styled.p`
  font-size: 14px; color: #a0b9e4; margin-bottom: 24px; line-height: 1.6; text-align: left;
`;

const FolderGrid = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px; width: 100%; margin-bottom: 24px;
`;

const FolderCard = styled.div`
  background: rgba(255,255,255,0.04);
  border: 1px solid ${({ color }) => color}33;
  border-radius: 10px; padding: 14px 16px;
  display: flex; flex-direction: column; gap: 8px;
`;

const CardLabel = styled.span`font-size: 12px; color: #a0b9e4; font-weight: 600;`;

const FolderBtn = styled.button`
  display: flex; align-items: center;
  background: ${({ color }) => color}22;
  color: ${({ color }) => color};
  border: 1px solid ${({ color }) => color}55;
  border-radius: 8px; padding: 8px 14px; font-size: 13px; cursor: pointer;
  transition: background 0.2s;
  &:hover { background: ${({ color }) => color}33; }
`;

const FileCount = styled.span`
  font-size: 11px; color: #2ecc71; display: flex; align-items: center;
`;

const ButtonRow = styled.div`display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap;`;

const RunButton = styled.button`
  background: ${({ disabled }) => disabled ? "rgba(255,255,255,0.07)" : "#7b68ee"};
  color: ${({ disabled }) => disabled ? "#556a8a" : "white"};
  padding: 13px 30px; font-size: 15px; border: none; border-radius: 50px;
  cursor: ${({ disabled }) => disabled ? "not-allowed" : "pointer"};
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: ${({ disabled }) => disabled ? "none" : "0px 8px 15px rgba(123,104,238,0.4)"};
  &:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0px 12px 20px rgba(123,104,238,0.6); }
`;

const DebugButton = styled.button`
  display: flex; align-items: center;
  background: ${({ disabled }) => disabled ? "rgba(255,255,255,0.07)" : "rgba(255,183,71,0.15)"};
  color: ${({ disabled }) => disabled ? "#556a8a" : "#ffb347"};
  border: 1px solid ${({ disabled }) => disabled ? "transparent" : "#ffb34755"};
  padding: 12px 22px; font-size: 14px; border-radius: 50px;
  cursor: ${({ disabled }) => disabled ? "not-allowed" : "pointer"};
  transition: background 0.2s;
  &:hover:not(:disabled) { background: rgba(255,183,71,0.25); }
`;

const StatusMessage = styled.p`color: #a0b9e4; font-size: 13px; margin: 8px 0;`;
const ErrorMessage = styled.p`color: #e74c3c; font-size: 13px; margin: 8px 0;`;

// ── Debug styled ───────────────────────────────────────────────────────────────
const DebugWrapper = styled.div`margin-top: 20px; width: 100%;`;
const DebugTitle = styled.h2`font-size: 15px; color: #ffb347; margin-bottom: 4px;`;
const DebugSubtitle = styled.p`font-size: 11px; color: #7a90b4; margin-bottom: 14px;`;
const DebugImageGrid = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
`;
const DebugCard = styled.div`
  background: rgba(255,255,255,0.03);
  border: 1px solid ${({ color }) => color}33;
  border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px;
`;
const DebugCardLabel = styled.span`
  font-size: 11px; font-weight: 700; color: ${({ color }) => color};
`;
const DebugFilename = styled.span`
  font-size: 10px; color: #556a8a; word-break: break-all;
`;
const DebugImage = styled.img`
  width: 100%; border-radius: 6px; display: block;
`;
const DebugMeta = styled.span`
  font-size: 10px; color: #7a90b4; font-family: monospace;
`;
const DebugHuTable = styled.div`
  display: flex; flex-direction: column; gap: 2px; margin-top: 4px;
`;
const DebugHuRow = styled.div`
  display: flex; justify-content: space-between;
  font-size: 10px; font-family: monospace;
  color: #a0b9e4;
  padding: 1px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
`;

// ── Results styled ─────────────────────────────────────────────────────────────
const ResultsWrapper = styled.div`margin-top: 24px; width: 100%; text-align: left;`;
const ResultsTitle = styled.h2`font-size: 17px; color: #e0eafc; margin-bottom: 14px;`;
const MetaRow = styled.div`display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;`;

const Chip = styled.div`
  background: ${({ highlight }) => highlight ? "rgba(255,107,203,0.12)" : "rgba(255,255,255,0.06)"};
  border: 1px solid ${({ highlight }) => highlight ? "rgba(255,107,203,0.3)" : "rgba(255,255,255,0.1)"};
  border-radius: 8px; padding: 8px 12px; min-width: 80px;
`;
const ChipLabel = styled.div`font-size: 10px; color: #7a90b4; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;`;
const ChipValue = styled.div`
  font-size: 15px; font-weight: 700;
  color: ${({ highlight }) => highlight ? "#ff6bcb" : "#e0eafc"};
`;

const ResultTable = styled.table`width: 100%; border-collapse: collapse; font-size: 13px;`;
const RTh = styled.th`
  text-align: left; padding: 9px 12px;
  background: rgba(255,255,255,0.06); color: #a0b9e4; font-weight: 600;
  border-bottom: 1px solid rgba(255,255,255,0.09);
`;
const RTd = styled.td`
  padding: 9px 12px; border-bottom: 1px solid rgba(255,255,255,0.05);
  color: ${({ muted, error }) => error ? "#e74c3c" : muted ? "#7a90b4" : "#e0eafc"};
  font-weight: ${({ error }) => error ? 600 : 400};
`;
