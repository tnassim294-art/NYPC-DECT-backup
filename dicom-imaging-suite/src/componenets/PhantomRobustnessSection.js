// PhantomRobustnessSection.js
import { useState, useRef, useEffect } from "react";
import styled from "styled-components";
import { FaFolderOpen, FaArrowLeft, FaCheck, FaTimes } from "react-icons/fa";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Label, ReferenceLine,
} from "recharts";

// ─── Size ordering (small → large) ───────────────────────────────────────────
const SIZE_ORDER = ["Head", "Head+Ring1", "Head+Ring2", "Head+Ring3", "Head+Ring4", "Head+Body"];

function sizeRank(size) {
  const idx = SIZE_ORDER.indexOf(size);
  return idx === -1 ? 99 : idx;
}

// ─── Parse a folder name into { phantomType, size, energy } ──────────────────
function parseFolderName(folder) {
  const phantomType = folder.startsWith("3D")     ? "3D"
                    : folder.startsWith("Gammex")  ? "Gammex"
                    : "Unknown";

  const energyMatch = folder.match(/[_\-]([CHL])$/i);
  const energy = energyMatch ? energyMatch[1].toUpperCase() : null;

  let size = "Unknown";
  const bodyMatch = /body/i.test(folder);
  const ringMatch = folder.match(/(?:ring(\d+)|(\d+)ring)/i);
  const headMatch = /head/i.test(folder);

  if (bodyMatch)       size = "Head+Body";
  else if (ringMatch)  size = `Head+Ring${ringMatch[1] ?? ringMatch[2]}`;
  else if (headMatch)  size = "Head";

  return { phantomType, size, energy };
}

// ─── Slice selection helpers ──────────────────────────────────────────────────
function sortBySliceOrder(files) {
  return [...files].sort((a, b) => {
    const numA = parseInt(a.name.match(/(\d+)(?:\.\w+)?$/)?.[1] ?? "0");
    const numB = parseInt(b.name.match(/(\d+)(?:\.\w+)?$/)?.[1] ?? "0");
    return numA - numB;
  });
}

function centerSlices(files, n = 10) {
  const sorted = sortBySliceOrder(files);
  const mid   = Math.floor(sorted.length / 2);
  const half  = Math.floor(n / 2);
  const start = Math.max(0, mid - half);
  return sorted.slice(start, start + n);
}

// ─── Group uploaded files by folder → series map ─────────────────────────────
function groupByFolder(files) {
  const map = {};
  for (const file of files) {
    if (file.name === ".DS_Store" || file.webkitRelativePath.includes("__MACOSX")) continue;
    const parts = file.webkitRelativePath.split("/");
    if (parts.length < 2) continue;
    const folder = parts[parts.length - 2];
    if (!map[folder]) {
      map[folder] = { folder, allFiles: [], ...parseFolderName(folder) };
    }
    map[folder].allFiles.push(file);
  }
  for (const s of Object.values(map)) {
    s.totalSlices = s.allFiles.length;
    s.files       = sortBySliceOrder(s.allFiles);
  }
  return Object.values(map);
}

// ─── Build summary structure ──────────────────────────────────────────────────
function buildSummary(seriesList) {
  const gammex = {};
  const printed = {};
  const unknown = [];
  for (const s of seriesList) {
    const target = s.phantomType === "Gammex" ? gammex
                 : s.phantomType === "3D"     ? printed
                 : null;
    if (!target) { unknown.push(s); continue; }
    if (!target[s.size]) target[s.size] = { H: null, L: null, C: null };
    if (s.energy) target[s.size][s.energy] = s;
    else unknown.push(s);
  }
  return { gammex, printed, unknown };
}

// ─── ROI card circle palette ──────────────────────────────────────────────────
const CIRCLE_PALETTE = [
  "#ff6464","#64ff64","#6464ff","#ffff00","#ff64ff",
  "#00ffff","#ffb400","#b400ff","#00b4ff","#ff3c3c","#3cff3c",
];

// ─── Interactive ROI card ─────────────────────────────────────────────────────
const RoiCard = ({
  label, color, filename, image_b64,
  detected_cx, detected_cy, detected_radius,
  image_width = 512, image_height = 512,
  circles, onCirclesChange,
}) => {
  const [localCircles, setLocalCircles] = useState(circles || []);
  const dragging = useRef(null);
  const svgRef   = useRef(null);

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
    <RoiCardWrapper color={color}>
      <RoiCardLabel color={color}>{label}</RoiCardLabel>
      <RoiFilename>{filename}</RoiFilename>
      <div style={{ position: "relative", width: "100%", userSelect: "none" }}>
        <RoiImage src={`data:image/png;base64,${image_b64}`} alt={label} draggable={false} />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${image_width} ${image_height}`}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", cursor: "crosshair" }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {detected_radius && (
            <circle cx={detected_cx} cy={detected_cy} r={detected_radius}
              fill="none" stroke="#00ff00" strokeWidth={2} pointerEvents="none" />
          )}
          {localCircles.map((c, i) => {
            const stroke = CIRCLE_PALETTE[i % CIRCLE_PALETTE.length];
            return (
              <g key={i}>
                <circle cx={c.x} cy={c.y} r={c.radius}
                  fill="transparent" stroke={stroke} strokeWidth={2}
                  style={{ cursor: "grab" }}
                  onMouseDown={e => onMouseDown(e, i)} />
                <circle cx={c.x} cy={c.y} r={Math.round(c.radius * 0.7)}
                  fill={`${stroke}20`} stroke={stroke} strokeWidth={1}
                  strokeDasharray="4 3" pointerEvents="none" />
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
      <RoiMeta>
        cx={detected_cx?.toFixed(0)}, cy={detected_cy?.toFixed(0)}, r={detected_radius?.toFixed(0)}
        &nbsp;·&nbsp; drag to adjust
      </RoiMeta>
    </RoiCardWrapper>
  );
};

// ─── Results chart + table ────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label, chartData }) => {
  if (!active || !payload?.length) return null;
  const full = chartData.find(d => d.shortSize === label)?.size || label;
  return (
    <TipBox>
      <strong>{full}</strong><br />
      RMSE: {payload[0].value}
    </TipBox>
  );
};

const RobustnessResults = ({ data }) => {
  const { c, d_e, cal_slices, results_by_size } = data;

  const orderedSizes = SIZE_ORDER.filter(s => results_by_size[s]);
  // Also include any size not in SIZE_ORDER
  Object.keys(results_by_size).forEach(s => { if (!orderedSizes.includes(s)) orderedSizes.push(s); });

  const chartData = orderedSizes
    .filter(s => results_by_size[s]?.rmse != null)
    .map(s => ({
      size: s,
      shortSize: s.replace("Head+Ring", "+R").replace("Head+Body", "+Bdy").replace("Head", "Hd"),
      rmse: parseFloat(results_by_size[s].rmse.toFixed(4)),
    }));

  return (
    <ResultsWrapper>
      <ResultsTitle>Robustness Results — Hunemohr</ResultsTitle>
      <MetaRow>
        <MetaChip label="c"          value={c} />
        <MetaChip label="d_e"        value={d_e} />
        <MetaChip label="Cal slices" value={cal_slices} />
      </MetaRow>

      <ChartLabel>RMSE vs Phantom Size</ChartLabel>
      <ResponsiveContainer width="100%" height={270}>
        <LineChart data={chartData} margin={{ top: 10, right: 24, bottom: 44, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis dataKey="shortSize" stroke="#7a90b4" tick={{ fill: "#a0b9e4", fontSize: 11 }}>
            <Label value="Phantom Size (small → large)" position="insideBottom" offset={-28} style={{ fill: "#7a90b4", fontSize: 11 }} />
          </XAxis>
          <YAxis stroke="#7a90b4" tick={{ fill: "#a0b9e4", fontSize: 11 }} width={60}>
            <Label value="RMSE (% SPR)" angle={-90} position="insideLeft" offset={15} style={{ fill: "#7a90b4", fontSize: 11 }} />
          </YAxis>
          <Tooltip
            contentStyle={{ background: "#1f2a48", border: "1px solid #4a5a80", borderRadius: 8, color: "#e0eafc", fontSize: 12 }}
            formatter={(v) => [v, "RMSE"]}
            labelFormatter={l => chartData.find(d => d.shortSize === l)?.size || l}
          />
          <Line
            type="monotone" dataKey="rmse" stroke="#ff6bcb" strokeWidth={2.5}
            dot={{ fill: "#ff6bcb", r: 5, strokeWidth: 0 }}
            activeDot={{ r: 7 }}
            name="Hunemohr"
          />
        </LineChart>
      </ResponsiveContainer>

      <SummaryTable style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <STh>Size</STh>
            <STh>RMSE</STh>
            <STh>Slices</STh>
            <STh>Status</STh>
          </tr>
        </thead>
        <tbody>
          {orderedSizes.map(size => {
            const r = results_by_size[size];
            return (
              <tr key={size}>
                <STd primary>{size}</STd>
                <STd>{r?.rmse != null ? r.rmse.toFixed(4) : "—"}</STd>
                <STd>{r?.n_slices ?? "—"}</STd>
                <STd>{r?.error
                  ? <ErrText>{r.error}</ErrText>
                  : r?.rmse != null
                    ? <OkText><FaCheck size={10} /> OK</OkText>
                    : "—"}
                </STd>
              </tr>
            );
          })}
        </tbody>
      </SummaryTable>
    </ResultsWrapper>
  );
};

// ─── Small helper: availability badge ────────────────────────────────────────
const AvailBadge = ({ series }) =>
  series
    ? <Badge ok><FaCheck size={10} /> {series.files.length} of {series.totalSlices} slices</Badge>
    : <Badge><FaTimes size={10} /> missing</Badge>;

// ─── Main component ───────────────────────────────────────────────────────────
const PhantomRobustnessSection = ({ handleBack }) => {
  // Upload phase
  const [isLoading, setIsLoading]     = useState(false);
  const [summary, setSummary]         = useState(null);
  const [statusMsg, setStatusMsg]     = useState(null);
  const [unrecognized, setUnrecognized] = useState([]);

  // ROI phase
  const [phase, setPhase]             = useState("upload"); // "upload" | "roi" | "results"
  const [roiItems, setRoiItems]       = useState([]);
  const [roiLoading, setRoiLoading]   = useState(false);
  const [roiError, setRoiError]       = useState(null);
  const [customCirclesMap, setCustomCirclesMap] = useState({}); // { [cardKey]: circles[] }

  // Results phase
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisMsg, setAnalysisMsg]         = useState(null);
  const [analysisError, setAnalysisError]     = useState(null);
  const [robustnessResults, setRobustnessResults] = useState(null);

  // ── Upload handler ──────────────────────────────────────────────────────────
  const handleFolderChange = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    setIsLoading(true);
    setStatusMsg("Reading folder structure...");
    setSummary(null);
    setPhase("upload");
    setRobustnessResults(null);
    await new Promise(r => setTimeout(r, 0));
    const seriesList = groupByFolder(files);
    const s = buildSummary(seriesList);
    setSummary(s);
    setUnrecognized(s.unknown);
    const n3D     = Object.keys(s.printed).length;
    const nGammex = Object.keys(s.gammex).length;
    setStatusMsg(`Found ${nGammex} Gammex group(s) and ${n3D} 3D size(s) across ${seriesList.length} series.`);
    setIsLoading(false);
  };

  // ── Fetch ROI debug images ─────────────────────────────────────────────────
  const handleRunClick = async () => {
    setPhase("roi");
    setRoiLoading(true);
    setRoiError(null);
    setRoiItems([]);
    setCustomCirclesMap({});

    try {
      const toDebug = [];

      // Gammex Head H (calibration reference)
      const calSeries = summary?.gammex?.["Head"]?.H;
      if (calSeries) {
        const mid = calSeries.files[Math.floor(calSeries.files.length / 2)];
        toDebug.push({ key: "gammex_Head_H", label: "Gammex Head — H (Calibration)", midFile: mid, color: "#6bbaff" });
      }

      // One H-energy card per 3D size
      const printedSizes = Object.keys(summary.printed).sort((a, b) => sizeRank(a) - sizeRank(b));
      for (const size of printedSizes) {
        const s = summary.printed[size].H;
        if (!s) continue;
        const mid = s.files[Math.floor(s.files.length / 2)];
        toDebug.push({ key: `3D_${size}_H`, label: `3D ${size} — H`, midFile: mid, color: "#ff6bcb" });
      }

      const results = await Promise.all(
        toDebug.map(async ({ key, label, midFile, color }) => {
          const fd = new FormData();
          fd.append("dicom_file", midFile, midFile.name);
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
          return { key, label, color, ...data, filename: midFile.name };
        })
      );

      setRoiItems(results);
    } catch (e) {
      setRoiError(e.message);
    } finally {
      setRoiLoading(false);
    }
  };

  // ── Run full analysis ──────────────────────────────────────────────────────
  const handleConfirmAndRun = async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisMsg(null);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10-min timeout

    try {
      const formData = new FormData();
      let totalSlices = 0;

      const appendSeries = (sizeMap) => {
        for (const energyMap of Object.values(sizeMap)) {
          for (const series of Object.values(energyMap)) {
            if (!series) continue;
            for (const file of series.files) {
              formData.append("files", file, file.webkitRelativePath);
              totalSlices++;
            }
          }
        }
      };

      appendSeries(summary.gammex);
      appendSeries(summary.printed);

      // Send the calibration card's adjusted circles (if any) as the global reference
      const calCircles = customCirclesMap["gammex_Head_H"];
      if (calCircles) {
        formData.append("custom_circles_json", JSON.stringify(calCircles));
      }

      setAnalysisMsg(`Uploading and processing ${totalSlices} slices across all sizes — this may take a few minutes…`);

      const res = await fetch("http://127.0.0.1:5050/robustness-analysis", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || `Server error ${res.status}`);
      }

      const data = await res.json();
      setRobustnessResults(data);
      setPhase("results");
    } catch (e) {
      const msg = e.name === "AbortError"
        ? "Analysis timed out after 10 minutes. Try reducing the number of slices by removing more files."
        : e.message;
      setAnalysisError(msg);
    } finally {
      clearTimeout(timeout);
      setAnalysisMsg(null);
      setAnalysisLoading(false);
    }
  };

  // Derived
  const gammexSizes  = summary ? Object.keys(summary.gammex).sort((a, b) => sizeRank(a) - sizeRank(b)) : [];
  const printedSizes = summary ? Object.keys(summary.printed).sort((a, b) => sizeRank(a) - sizeRank(b)) : [];
  const calibSource  = summary?.gammex?.["Head"];
  const calibReady   = calibSource?.H && calibSource?.L && calibSource?.C;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Wrapper>
      {/* ── Back button ──────────────────────────────────────────────────── */}
      <BackButton onClick={phase === "roi" ? () => setPhase("upload") : phase === "results" ? () => setPhase("roi") : handleBack}>
        <FaArrowLeft /> {phase === "upload" ? "Back" : "Back"}
      </BackButton>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PHASE: UPLOAD                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {phase === "upload" && (
        <>
          <Title>Phantom Size Robustness</Title>
          <Subtitle>
            Upload your organized scan folder. Folders should be named by phantom type
            (<code>Gammex</code> or <code>3D</code>), size (<code>Head</code>,{" "}
            <code>Head+Ring1</code>, …, <code>Head+Body</code>), and energy (<code>_H</code>,{" "}
            <code>_L</code>, <code>_C</code>). Calibration uses the{" "}
            <strong>Gammex Head</strong> phantom.
          </Subtitle>

          <UploadRow>
            <UploadButton
              onClick={() => document.getElementById("robustnessFolderInput").click()}
              disabled={isLoading}
            >
              <FaFolderOpen style={{ marginRight: 8 }} />
              {isLoading ? "Reading..." : "Select Scan Folder"}
            </UploadButton>
            <input
              type="file"
              id="robustnessFolderInput"
              webkitdirectory="true"
              directory="true"
              style={{ display: "none" }}
              onChange={handleFolderChange}
            />
            {statusMsg && <StatusMessage>{statusMsg}</StatusMessage>}
          </UploadRow>

          {summary && (
            <>
              {/* Gammex calibration source */}
              <SectionHeader>
                <SectionTitle>Calibration Source — Gammex Phantom</SectionTitle>
                {calibReady
                  ? <ReadyBadge ok>Ready to calibrate</ReadyBadge>
                  : <ReadyBadge>Incomplete</ReadyBadge>}
              </SectionHeader>

              {gammexSizes.length === 0
                ? <EmptyNote>No Gammex series detected.</EmptyNote>
                : (
                  <SummaryTable>
                    <thead>
                      <tr>
                        <STh>Size</STh>
                        <STh>High Energy (H)</STh>
                        <STh>Low Energy (L)</STh>
                        <STh>Composite (C)</STh>
                      </tr>
                    </thead>
                    <tbody>
                      {gammexSizes.map(size => {
                        const row = summary.gammex[size];
                        return (
                          <tr key={size}>
                            <STd primary>{size}{size === "Head" && <CalibTag>calibration</CalibTag>}</STd>
                            <STd><AvailBadge series={row.H} /></STd>
                            <STd><AvailBadge series={row.L} /></STd>
                            <STd><AvailBadge series={row.C} /></STd>
                          </tr>
                        );
                      })}
                    </tbody>
                  </SummaryTable>
                )
              }

              {/* 3D printed phantom test sizes */}
              <SectionHeader style={{ marginTop: 28 }}>
                <SectionTitle>Test Targets — 3D Printed Phantom</SectionTitle>
                <SizeCount>{printedSizes.length} size(s) detected</SizeCount>
              </SectionHeader>

              {printedSizes.length === 0
                ? <EmptyNote>No 3D phantom series detected.</EmptyNote>
                : (
                  <SummaryTable>
                    <thead>
                      <tr>
                        <STh>Size (small → large)</STh>
                        <STh>High Energy (H)</STh>
                        <STh>Low Energy (L)</STh>
                        <STh>Composite (C)</STh>
                      </tr>
                    </thead>
                    <tbody>
                      {printedSizes.map(size => {
                        const row = summary.printed[size];
                        return (
                          <tr key={size}>
                            <STd primary>{size}</STd>
                            <STd><AvailBadge series={row.H} /></STd>
                            <STd><AvailBadge series={row.L} /></STd>
                            <STd><AvailBadge series={row.C} /></STd>
                          </tr>
                        );
                      })}
                    </tbody>
                  </SummaryTable>
                )
              }

              {/* Unrecognized */}
              {unrecognized.length > 0 && (
                <>
                  <SectionHeader style={{ marginTop: 28 }}>
                    <SectionTitle style={{ color: "#e67e22" }}>Unrecognized Folders</SectionTitle>
                  </SectionHeader>
                  <UnrecognizedList>
                    {unrecognized.map((s, i) => (
                      <UnrecognizedItem key={i}>
                        <code>{s.folder}</code>
                        <span>{s.files.length} files — could not parse phantom type, size, or energy</span>
                      </UnrecognizedItem>
                    ))}
                  </UnrecognizedList>
                </>
              )}

              <RunRow>
                <RunButton onClick={handleRunClick} disabled={!calibReady || printedSizes.length === 0}>
                  Preview ROI Placement
                </RunButton>
                {!calibReady && (
                  <RunNote>Gammex Head H + L + C series required before running.</RunNote>
                )}
              </RunRow>
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PHASE: ROI                                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {phase === "roi" && (
        <>
          <Title>ROI Placement Preview</Title>
          <Subtitle>
            Verify insert circle placement on a representative slice from each phantom size.
            Drag circles to adjust position. Adjusted positions will be applied to all slices globally.
          </Subtitle>

          {roiLoading && <StatusMessage>Fetching registration for each size…</StatusMessage>}
          {roiError   && <ErrorMessage>{roiError}</ErrorMessage>}

          {roiItems.length > 0 && (
            <RoiGrid>
              {roiItems.map(item => (
                <RoiCard
                  key={item.key}
                  label={item.label}
                  color={item.color}
                  filename={item.filename}
                  image_b64={item.image_b64}
                  detected_cx={item.detected_cx}
                  detected_cy={item.detected_cy}
                  detected_radius={item.detected_radius}
                  image_width={item.image_width}
                  image_height={item.image_height}
                  circles={customCirclesMap[item.key] ?? item.circles}
                  onCirclesChange={(circs) => setCustomCirclesMap(prev => ({ ...prev, [item.key]: circs }))}
                />
              ))}
            </RoiGrid>
          )}

          {Object.keys(customCirclesMap).length > 0 && (
            <AdjustedNote>✓ Adjusted positions saved. Calibration card adjustments will be used for analysis.</AdjustedNote>
          )}

          {analysisError && <ErrorMessage style={{ marginTop: 12 }}>{analysisError}</ErrorMessage>}
          {analysisMsg   && <StatusMessage style={{ marginTop: 12 }}>{analysisMsg}</StatusMessage>}

          <RunRow style={{ marginTop: 24 }}>
            <RunButton
              onClick={handleConfirmAndRun}
              disabled={analysisLoading || roiLoading}
              style={{ background: analysisLoading ? undefined : "#7b68ee", boxShadow: analysisLoading ? "none" : "0px 8px 15px rgba(123,104,238,0.4)" }}
            >
              {analysisLoading ? "Running analysis…" : "Confirm & Run Analysis"}
            </RunButton>
          </RunRow>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* PHASE: RESULTS                                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {phase === "results" && robustnessResults && (
        <RobustnessResults data={robustnessResults} />
      )}
    </Wrapper>
  );
};

export default PhantomRobustnessSection;

// ─── Styled components ────────────────────────────────────────────────────────
const Wrapper = styled.div`
  display: flex; flex-direction: column; align-items: flex-start; width: 100%;
`;

const BackButton = styled.button`
  display: flex; align-items: center; gap: 8px;
  background: none; border: none; color: #a0b9e4;
  cursor: pointer; font-size: 14px; margin-bottom: 20px; padding: 0;
  transition: color 0.2s;
  &:hover { color: #e0eafc; }
`;

const Title    = styled.h1`font-size: 24px; color: #e0eafc; margin-bottom: 8px;`;
const Subtitle = styled.p`
  font-size: 14px; color: #a0b9e4; margin-bottom: 24px;
  text-align: left; line-height: 1.7;
  code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 3px; color: #e0eafc; font-size: 13px; }
  strong { color: #e0eafc; }
`;

const UploadRow   = styled.div`display: flex; align-items: center; gap: 20px; margin-bottom: 28px; flex-wrap: wrap;`;
const StatusMessage = styled.p`color: #a0b9e4; font-size: 13px; margin: 0;`;
const ErrorMessage  = styled.p`color: #e74c3c; font-size: 13px; margin: 0;`;

const UploadButton = styled.button`
  display: flex; align-items: center;
  background: #2ecc71; color: white;
  padding: 12px 22px; font-size: 15px; border: none; border-radius: 50px;
  cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: 0px 8px 15px rgba(46,204,113,0.4);
  opacity: ${({ disabled }) => disabled ? 0.6 : 1};
  &:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0px 12px 20px rgba(46,204,113,0.6); }
`;

const SectionHeader = styled.div`display: flex; align-items: center; gap: 12px; margin-bottom: 10px;`;
const SectionTitle  = styled.h2`font-size: 15px; font-weight: 600; color: #e0eafc; margin: 0;`;

const ReadyBadge = styled.span`
  font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 20px;
  background: ${({ ok }) => ok ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.15)"};
  color:      ${({ ok }) => ok ? "#2ecc71"               : "#e74c3c"};
`;

const SizeCount  = styled.span`font-size: 12px; color: #7a90b4;`;
const EmptyNote  = styled.p`font-size: 13px; color: #556a8a; font-style: italic; margin: 4px 0 0;`;

const SummaryTable = styled.table`
  width: 100%; border-collapse: collapse; font-size: 13px; color: #e0eafc; margin-bottom: 4px;
`;
const STh = styled.th`
  text-align: left; padding: 9px 14px;
  background: rgba(255,255,255,0.06); color: #a0b9e4; font-weight: 600;
  border-bottom: 1px solid rgba(255,255,255,0.09); white-space: nowrap;
  &:first-child { border-radius: 6px 0 0 0; } &:last-child { border-radius: 0 6px 0 0; }
`;
const STd = styled.td`
  padding: 9px 14px; border-bottom: 1px solid rgba(255,255,255,0.05);
  color: ${({ primary }) => primary ? "#e0eafc" : "#c8d8f0"};
  font-weight: ${({ primary }) => primary ? 600 : 400}; white-space: nowrap;
`;

const CalibTag = styled.span`
  margin-left: 8px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
  padding: 2px 6px; border-radius: 4px; text-transform: uppercase;
  background: rgba(255,107,203,0.15); color: #ff6bcb;
`;

const Badge = styled.span`
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 12px; padding: 3px 8px; border-radius: 4px;
  background: ${({ ok }) => ok ? "rgba(46,204,113,0.12)" : "rgba(255,255,255,0.05)"};
  color:      ${({ ok }) => ok ? "#2ecc71"               : "#556a8a"};
`;

const UnrecognizedList = styled.ul`list-style: none; padding: 0; margin: 0;`;
const UnrecognizedItem = styled.li`
  display: flex; gap: 14px; align-items: baseline;
  padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
  code { color: #e67e22; font-size: 13px; }
  span { font-size: 12px; color: #556a8a; }
`;

const RunRow  = styled.div`display: flex; align-items: center; gap: 16px; margin-top: 32px; flex-wrap: wrap;`;
const RunNote = styled.p`font-size: 12px; color: #556a8a; margin: 0;`;

const RunButton = styled.button`
  background: ${({ disabled }) => disabled ? "rgba(255,255,255,0.07)" : "#ff6bcb"};
  color: ${({ disabled }) => disabled ? "#556a8a" : "white"};
  padding: 13px 28px; font-size: 15px; border: none; border-radius: 50px;
  cursor: ${({ disabled }) => disabled ? "not-allowed" : "pointer"};
  transition: transform 0.2s, box-shadow 0.2s;
  box-shadow: ${({ disabled }) => disabled ? "none" : "0px 8px 15px rgba(255,107,203,0.35)"};
  &:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0px 12px 20px rgba(255,107,203,0.5); }
`;

// ── ROI phase styled ──────────────────────────────────────────────────────────
const RoiGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  width: 100%;
  margin-top: 4px;
`;

const RoiCardWrapper = styled.div`
  background: rgba(255,255,255,0.03);
  border: 1px solid ${({ color }) => color}33;
  border-radius: 10px; padding: 10px;
  display: flex; flex-direction: column; gap: 5px;
`;
const RoiCardLabel = styled.span`font-size: 11px; font-weight: 700; color: ${({ color }) => color};`;
const RoiFilename  = styled.span`font-size: 9px; color: #556a8a; word-break: break-all;`;
const RoiImage     = styled.img`width: 100%; border-radius: 5px; display: block;`;
const RoiMeta      = styled.span`font-size: 9px; color: #7a90b4; font-family: monospace;`;

const AdjustedNote = styled.p`
  font-size: 12px; color: #2ecc71; margin: 12px 0 0;
`;

// ── Results styled ────────────────────────────────────────────────────────────
const ResultsWrapper = styled.div`width: 100%; text-align: left;`;
const ResultsTitle   = styled.h2`font-size: 18px; color: #e0eafc; margin-bottom: 14px;`;
const MetaRow        = styled.div`display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px;`;

const MetaChip = ({ label, value }) => (
  <ChipBox>
    <ChipLabel>{label}</ChipLabel>
    <ChipValue>{value ?? "—"}</ChipValue>
  </ChipBox>
);
const ChipBox   = styled.div`background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; min-width: 80px;`;
const ChipLabel = styled.div`font-size: 10px; color: #7a90b4; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px;`;
const ChipValue = styled.div`font-size: 15px; font-weight: 700; color: #e0eafc;`;

const ChartLabel = styled.h3`font-size: 13px; color: #ff6bcb; margin: 0 0 6px; text-align: center;`;
const TipBox     = styled.div`background: #1f2a48; border: 1px solid #4a5a80; border-radius: 8px; padding: 8px 12px; color: #e0eafc; font-size: 12px;`;

const OkText  = styled.span`color: #2ecc71; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;`;
const ErrText = styled.span`color: #e74c3c; font-size: 11px;`;
