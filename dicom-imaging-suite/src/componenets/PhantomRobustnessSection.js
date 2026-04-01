// PhantomRobustnessSection.js
import { useState, useRef, useEffect } from "react";
import styled from "styled-components";
import { FaFolderOpen, FaArrowLeft, FaCheck, FaTimes, FaChevronDown, FaChevronRight } from "react-icons/fa";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Label, ReferenceLine,
  ComposedChart, Scatter, ScatterChart,
} from "recharts";
import CalibrationCurvePlot from "./CalibrationCurvePlot";

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

// ─── Canonical phantom insert layout (Gammex Head, 512×512 reference) ─────────
// All outer inserts are at the same radial distance R=76 px from Brain (center).
// Symmetry rules:
//   • LN-350 / LN-450  → same horizontal line (dy=0)
//   • Inner Bone / Breast → same vertical line (dx=0)
//   • Liver / Cortical Bone → same 45° diagonal (|dx|=|dy|=D)
//   • 50% CaCO3 / 30% CaCO3 → other 45° diagonal
// Adipose is an inner insert sitting between Brain and Breast.
const _R = 101;                      // outer-ring radius (px, 512×512 ref)
const _D = Math.round(_R / Math.SQRT2); // 71 px – diagonal component
const CANONICAL_OFFSETS = [
  { material: "Brain",         dx:  0,   dy:  0  },
  { material: "Adipose",       dx:  0,   dy:  55 },
  { material: "Inner Bone",    dx:  0,   dy: -_R },
  { material: "Breast",        dx:  0,   dy: +_R },
  { material: "LN-350",        dx: -_R,  dy:  0  },
  { material: "LN-450",        dx: +_R,  dy:  0  },
  { material: "Liver",         dx: -_D,  dy: -_D },
  { material: "50% CaCO3",     dx: +_D,  dy: -_D },
  { material: "Cortical Bone", dx: +_D,  dy: +_D },
  { material: "30% CaCO3",     dx: -_D,  dy: +_D },
];

// Apply canonical offsets to a circle list given a Brain anchor (bx, by) and
// optional rotation angle (degrees, clockwise in image coords).
function applyCanonical(circs, bx, by, angleDeg = 0) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return (circs || []).map(c => {
    const canon = CANONICAL_OFFSETS.find(o => o.material === c.material);
    if (!canon) return c;
    const rx = canon.dx * cos - canon.dy * sin;
    const ry = canon.dx * sin + canon.dy * cos;
    return { ...c, x: Math.round(bx + rx), y: Math.round(by + ry) };
  });
}

// ─── Interactive ROI card ─────────────────────────────────────────────────────
const RoiCard = ({
  label, color, filename, image_b64,
  detected_cx, detected_cy, detected_radius,
  image_width = 512, image_height = 512,
  circles, onCirclesChange,
}) => {
  // Canonical-normalized initial state: Brain from backend, all others at fixed offsets
  const _initBrain = (c) => {
    const b = (c || []).find(x => x.material === "Brain");
    return b ? { x: b.x, y: b.y } : { x: detected_cx ?? 256, y: detected_cy ?? 256 };
  };
  const [rotation, setRotation]         = useState(0); // degrees
  const [localCircles, setLocalCircles] = useState(() => {
    const { x: bx, y: by } = _initBrain(circles);
    return applyCanonical(circles, bx, by, 0);
  });
  const [mode, setMode] = useState("place-center"); // "place-center" | "drag"
  const dragging = useRef(null);
  const didDrag  = useRef(false);
  const svgRef   = useRef(null);

  // centerRef = Brain's current image position (= the click anchor)
  const centerRef = useRef(_initBrain(circles));

  useEffect(() => {
    const { x: bx, y: by } = _initBrain(circles);
    centerRef.current = { x: bx, y: by };
    setLocalCircles(applyCanonical(circles, bx, by, rotation));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circles, detected_cx, detected_cy]);

  const toImgCoords = (clientX, clientY) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: Math.round((clientX - rect.left) / rect.width  * image_width),
      y: Math.round((clientY - rect.top)  / rect.height * image_height),
    };
  };

  // ── Place-center mode: click = Brain anchor; all circles snap to canonical offsets ──
  const onSvgClick = (e) => {
    if (mode !== "place-center" || didDrag.current) return;
    const { x, y } = toImgCoords(e.clientX, e.clientY);
    centerRef.current = { x, y };
    const next = applyCanonical(localCircles, x, y, rotation);
    setLocalCircles(next);
    onCirclesChange && onCirclesChange(next);
  };

  // ── Rotation: re-apply canonical from current Brain position ──────────────
  const onRotate = (deg) => {
    const newRot = Math.round(deg);
    setRotation(newRot);
    const { x: bx, y: by } = centerRef.current;
    const next = applyCanonical(localCircles, bx, by, newRot);
    setLocalCircles(next);
    onCirclesChange && onCirclesChange(next);
  };

  // ── Drag mode: move individual circles ───────────────────────────────────
  const onMouseDown = (e, idx) => {
    if (mode !== "drag") return;
    e.preventDefault();
    didDrag.current = false;
    dragging.current = idx;
  };
  const onMouseMove = (e) => {
    if (dragging.current === null) return;
    didDrag.current = true;
    const { x, y } = toImgCoords(e.clientX, e.clientY);
    setLocalCircles(prev => prev.map((c, i) => i === dragging.current ? { ...c, x, y } : c));
  };
  const onMouseUp = () => {
    if (dragging.current !== null) {
      onCirclesChange && onCirclesChange(localCircles);
      dragging.current = null;
    }
  };

  const svgCursor = mode === "place-center" ? "crosshair" : "default";

  return (
    <RoiCardWrapper color={color}>
      <RoiCardLabel color={color}>{label}</RoiCardLabel>
      <RoiFilename>{filename}</RoiFilename>

      {/* Mode toggle */}
      <ModeToggleRow>
        <ModeBtn active={mode === "place-center"} onClick={() => setMode("place-center")}>
          Click center
        </ModeBtn>
        <ModeBtn active={mode === "drag"} onClick={() => setMode("drag")}>
          Drag individual
        </ModeBtn>
      </ModeToggleRow>

      {/* Rotation control */}
      <RotationRow>
        <span style={{ fontSize: 10, color: "#7a90b4", whiteSpace: "nowrap" }}>Rotate</span>
        <input
          type="range" min={-180} max={180} step={1} value={rotation}
          onChange={e => onRotate(Number(e.target.value))}
          style={{ flex: 1, accentColor: "#ff6bcb" }}
        />
        <span style={{ fontSize: 10, color: "#e0eafc", minWidth: 32, textAlign: "right" }}>
          {rotation}°
        </span>
        <ModeBtn active={false} onClick={() => onRotate(0)} style={{ padding: "2px 6px" }}>
          Reset
        </ModeBtn>
      </RotationRow>

      <div style={{ position: "relative", width: "100%", userSelect: "none" }}>
        <RoiImage src={`data:image/png;base64,${image_b64}`} alt={label} draggable={false} />
        <svg
          ref={svgRef}
          viewBox={`0 0 ${image_width} ${image_height}`}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", cursor: svgCursor }}
          onClick={onSvgClick}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {detected_radius && (
            <circle cx={detected_cx} cy={detected_cy} r={detected_radius}
              fill="none" stroke="#00ff00" strokeWidth={2} pointerEvents="none" />
          )}
          {/* Show current effective center crosshair in place-center mode */}
          {mode === "place-center" && (
            <g pointerEvents="none">
              <line
                x1={centerRef.current.x - 10} y1={centerRef.current.y}
                x2={centerRef.current.x + 10} y2={centerRef.current.y}
                stroke="#fff" strokeWidth={1.5} opacity={0.6}
              />
              <line
                x1={centerRef.current.x} y1={centerRef.current.y - 10}
                x2={centerRef.current.x} y2={centerRef.current.y + 10}
                stroke="#fff" strokeWidth={1.5} opacity={0.6}
              />
            </g>
          )}
          {localCircles.map((c, i) => {
            const stroke = CIRCLE_PALETTE[i % CIRCLE_PALETTE.length];
            return (
              <g key={i}>
                <circle cx={c.x} cy={c.y} r={c.radius}
                  fill="transparent" stroke={stroke} strokeWidth={2}
                  style={{ cursor: mode === "drag" ? "grab" : "crosshair" }}
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
        {mode === "place-center"
          ? "Click where the Brain insert is — all circles shift so Brain lands on your click"
          : `cx=${detected_cx?.toFixed(0)}, cy=${detected_cy?.toFixed(0)}, r=${detected_radius?.toFixed(0)} · drag to adjust`
        }
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

// ─── Inline error sweep chart (no modal) ─────────────────────────────────────
const SweepTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <TipBox>
      <strong>{d.calibration_material}</strong><br />
      Z_eff: {d.z_eff} · c: {d.c}<br />
      Mean error: {d.mean_relative_error}%
    </TipBox>
  );
};

const RobustnessResults = ({ data }) => {
  const {
    c, d_e, cal_slices,
    results_by_size,
    schneider_results_by_size = {},
    saito_results_by_size = {},
    tanaka_results_by_size = {},
    gammex_self_test = {},
    error_sweep = [],
    schneider_cal_curve = null,
    schneider_spr_params = null,
  } = data;

  const [showSweep, setShowSweep] = useState(false);
  const [expandedSweepMat, setExpandedSweepMat] = useState(null);

  const hasSchneider = Object.keys(schneider_results_by_size).length > 0;
  const hasSaito     = Object.keys(saito_results_by_size).length > 0;
  const hasTanaka    = Object.keys(tanaka_results_by_size).length > 0;
  const hasSweep     = error_sweep.length > 0;
  const hasCalCurve  = schneider_cal_curve && schneider_spr_params;
  const hasGammexSelfTest = Object.keys(gammex_self_test).length > 0;

  const orderedSizes = SIZE_ORDER.filter(s => results_by_size[s]);
  Object.keys(results_by_size).forEach(s => { if (!orderedSizes.includes(s)) orderedSizes.push(s); });

  // Gammex Head self-test is prepended as the first data point
  const chartData = [];
  if (hasGammexSelfTest) {
    chartData.push({
      size: "Gammex Head (Cal.)",
      shortSize: "Gmx Hd",
      hunemohr: gammex_self_test.hunemohr?.rmse != null ? parseFloat(gammex_self_test.hunemohr.rmse.toFixed(4)) : null,
      schneider: gammex_self_test.schneider?.rmse != null ? parseFloat(gammex_self_test.schneider.rmse.toFixed(4)) : null,
      saito:     gammex_self_test.saito?.rmse != null    ? parseFloat(gammex_self_test.saito.rmse.toFixed(4))     : null,
      tanaka:    gammex_self_test.tanaka?.rmse != null   ? parseFloat(gammex_self_test.tanaka.rmse.toFixed(4))    : null,
      isCalPoint: true,
    });
  }
  orderedSizes.forEach(s => {
    chartData.push({
      size: s,
      shortSize: s.replace("Head+Ring", "+R").replace("Head+Body", "+Bdy").replace("Head", "Hd"),
      hunemohr: results_by_size[s]?.rmse != null ? parseFloat(results_by_size[s].rmse.toFixed(4)) : null,
      schneider: schneider_results_by_size[s]?.rmse != null ? parseFloat(schneider_results_by_size[s].rmse.toFixed(4)) : null,
      saito:     saito_results_by_size[s]?.rmse != null     ? parseFloat(saito_results_by_size[s].rmse.toFixed(4))     : null,
      tanaka:    tanaka_results_by_size[s]?.rmse != null    ? parseFloat(tanaka_results_by_size[s].rmse.toFixed(4))    : null,
    });
  });

  const bestSweep = hasSweep
    ? error_sweep.reduce((b, d) => d.mean_relative_error < b.mean_relative_error ? d : b, error_sweep[0])
    : null;

  return (
    <ResultsWrapper>
      <ResultsTitle>Robustness Results</ResultsTitle>
      <MetaRow>
        <MetaChip label="Hunemohr c"   value={c} />
        <MetaChip label="Hunemohr d_e" value={d_e} />
        <MetaChip label="Cal slices"   value={cal_slices} />
        {bestSweep && (
          <MetaChip label="Best cal. material" value={`${bestSweep.calibration_material} (${bestSweep.mean_relative_error}%)`} />
        )}
      </MetaRow>

      <ChartLabel>RMSE vs Phantom Size</ChartLabel>
      {hasGammexSelfTest && (
        <CalNote>
          "Gmx Hd" = Gammex Head tested on its own calibration data (expected low error).
        </CalNote>
      )}
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
            formatter={(v, name) => [v != null ? `${v}%` : "—", name]}
            labelFormatter={l => chartData.find(d => d.shortSize === l)?.size || l}
          />
          <Legend wrapperStyle={{ color: "#a0b9e4", fontSize: 12, paddingTop: 8 }} />
          {/* Dashed separator after calibration point */}
          {hasGammexSelfTest && (
            <ReferenceLine x="Gmx Hd" stroke="rgba(255,255,255,0.15)" strokeDasharray="4 3" />
          )}
          <Line
            type="monotone" dataKey="hunemohr" stroke="#ff6bcb" strokeWidth={2.5}
            dot={(props) => {
              const { cx, cy, payload } = props;
              return <circle key={`dot-h-${payload.shortSize}`} cx={cx} cy={cy} r={payload.isCalPoint ? 7 : 5} fill="#ff6bcb" stroke={payload.isCalPoint ? "#fff" : "none"} strokeWidth={payload.isCalPoint ? 1.5 : 0} />;
            }}
            activeDot={{ r: 7 }}
            name="Hunemohr (DECT)" connectNulls
          />
          {hasSchneider && (
            <Line
              type="monotone" dataKey="schneider" stroke="#6bbaff" strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, payload } = props;
                return <circle key={`dot-s-${payload.shortSize}`} cx={cx} cy={cy} r={payload.isCalPoint ? 7 : 5} fill="#6bbaff" stroke={payload.isCalPoint ? "#fff" : "none"} strokeWidth={payload.isCalPoint ? 1.5 : 0} />;
              }}
              activeDot={{ r: 7 }}
              name="Schneider (SECT)" connectNulls
            />
          )}
          {hasSaito && (
            <Line
              type="monotone" dataKey="saito" stroke="#ffb347" strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, payload } = props;
                return <circle key={`dot-sa-${payload.shortSize}`} cx={cx} cy={cy} r={payload.isCalPoint ? 7 : 5} fill="#ffb347" stroke={payload.isCalPoint ? "#fff" : "none"} strokeWidth={payload.isCalPoint ? 1.5 : 0} />;
              }}
              activeDot={{ r: 7 }}
              name="Saito (DECT)" connectNulls
            />
          )}
          {hasTanaka && (
            <Line
              type="monotone" dataKey="tanaka" stroke="#6bffb8" strokeWidth={2.5}
              dot={(props) => {
                const { cx, cy, payload } = props;
                return <circle key={`dot-t-${payload.shortSize}`} cx={cx} cy={cy} r={payload.isCalPoint ? 7 : 5} fill="#6bffb8" stroke={payload.isCalPoint ? "#fff" : "none"} strokeWidth={payload.isCalPoint ? 1.5 : 0} />;
              }}
              activeDot={{ r: 7 }}
              name="Tanaka (DECT)" connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* Summary table */}
      <SummaryTable style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <STh>Size</STh>
            <STh>Hunemohr RMSE</STh>
            {hasSchneider && <STh>Schneider RMSE</STh>}
            {hasSaito     && <STh>Saito RMSE</STh>}
            {hasTanaka    && <STh>Tanaka RMSE</STh>}
            <STh>Slices</STh>
            <STh>Status</STh>
          </tr>
        </thead>
        <tbody>
          {/* Gammex Head self-test row */}
          {hasGammexSelfTest && (
            <tr style={{ background: "rgba(107,186,255,0.06)" }}>
              <STd primary>Gammex Head <CalibTag>cal. self-test</CalibTag></STd>
              <STd>{gammex_self_test.hunemohr?.rmse != null ? `${gammex_self_test.hunemohr.rmse.toFixed(2)}%` : "—"}</STd>
              {hasSchneider && <STd>{gammex_self_test.schneider?.rmse != null ? `${gammex_self_test.schneider.rmse.toFixed(2)}%` : "—"}</STd>}
              {hasSaito     && <STd>{gammex_self_test.saito?.rmse    != null ? `${gammex_self_test.saito.rmse.toFixed(2)}%`    : "—"}</STd>}
              {hasTanaka    && <STd>{gammex_self_test.tanaka?.rmse   != null ? `${gammex_self_test.tanaka.rmse.toFixed(2)}%`   : "—"}</STd>}
              <STd>{gammex_self_test.hunemohr?.n_slices ?? "—"}</STd>
              <STd><OkText><FaCheck size={10} /> Cal.</OkText></STd>
            </tr>
          )}
          {orderedSizes.map(size => {
            const r   = results_by_size[size];
            const rs  = schneider_results_by_size[size];
            const rsa = saito_results_by_size[size];
            const rt  = tanaka_results_by_size[size];
            return (
              <tr key={size}>
                <STd primary>{size}</STd>
                <STd>{r?.rmse   != null ? `${r.rmse.toFixed(2)}%`   : "—"}</STd>
                {hasSchneider && <STd>{rs?.rmse  != null ? `${rs.rmse.toFixed(2)}%`  : "—"}</STd>}
                {hasSaito     && <STd>{rsa?.rmse != null ? `${rsa.rmse.toFixed(2)}%` : "—"}</STd>}
                {hasTanaka    && <STd>{rt?.rmse  != null ? `${rt.rmse.toFixed(2)}%`  : "—"}</STd>}
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

      {/* ── Analysis plots ──────────────────────────────────────────────────── */}
      <PlotsRow>
        {/* Schneider calibration curve */}
        {hasCalCurve && (
          <CalibrationCurvePlot
            calCurve={schneider_cal_curve}
            sprParams={schneider_spr_params}
          />
        )}

        {/* Hunemohr error sweep (collapsible) */}
        {hasSweep && (
          <SweepCard>
            <SweepCardHeader onClick={() => setShowSweep(s => !s)}>
              <span style={{ fontWeight: 600, color: "#ff6bcb", fontSize: 15 }}>
                Hunemohr Calibration Error Sweep
              </span>
              {showSweep ? <FaChevronDown size={12} color="#a0b9e4" /> : <FaChevronRight size={12} color="#a0b9e4" />}
            </SweepCardHeader>
            {bestSweep && (
              <SweepBestBadge>
                Best: <strong>{bestSweep.calibration_material}</strong> (Z_eff={bestSweep.z_eff}) — {bestSweep.mean_relative_error}% mean error
              </SweepBestBadge>
            )}
            {showSweep && (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <ScatterChart margin={{ top: 10, right: 20, bottom: 36, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                    <XAxis dataKey="z_eff" type="number" domain={["auto", "auto"]} stroke="#7a90b4" tick={{ fill: "#a0b9e4", fontSize: 11 }}>
                      <Label value="Calibration Material Z_eff" position="insideBottom" offset={-20} style={{ fill: "#7a90b4", fontSize: 11 }} />
                    </XAxis>
                    <YAxis dataKey="mean_relative_error" type="number" stroke="#7a90b4" tick={{ fill: "#a0b9e4", fontSize: 11 }} width={55}>
                      <Label value="Mean Error (%)" angle={-90} position="insideLeft" offset={10} style={{ fill: "#7a90b4", fontSize: 11 }} />
                    </YAxis>
                    <Tooltip content={<SweepTooltip />} />
                    <Scatter data={error_sweep} fill="#ff6bcb" strokeWidth={0} />
                  </ScatterChart>
                </ResponsiveContainer>
                {/* Per-material breakdown */}
                {error_sweep.map(item => (
                  <SweepMatRow key={item.calibration_material}>
                    <SweepMatHeader
                      onClick={() => setExpandedSweepMat(m => m === item.calibration_material ? null : item.calibration_material)}
                    >
                      <span>
                        {expandedSweepMat === item.calibration_material ? <FaChevronDown size={9} /> : <FaChevronRight size={9} />}
                        {" "}<strong>{item.calibration_material}</strong>{" "}
                        <span style={{ color: "#7a90b4", fontSize: 11 }}>(Z={item.z_eff})</span>
                      </span>
                      <SweepErrBadge $low={item.mean_relative_error < 2}>{item.mean_relative_error}%</SweepErrBadge>
                    </SweepMatHeader>
                    {expandedSweepMat === item.calibration_material && (
                      <SweepDetailTable>
                        <thead>
                          <tr>
                            <STh>Material</STh>
                            <STh>Pred. SPR</STh>
                            <STh>True SPR</STh>
                            <STh>Error %</STh>
                          </tr>
                        </thead>
                        <tbody>
                          {item.per_material_errors.map(pm => (
                            <tr key={pm.material}>
                              <STd>{pm.material}</STd>
                              <STd>{pm.spr_calculated}</STd>
                              <STd>{pm.spr_reference}</STd>
                              <STd>{pm.relative_error}%</STd>
                            </tr>
                          ))}
                        </tbody>
                      </SweepDetailTable>
                    )}
                  </SweepMatRow>
                ))}
              </>
            )}
          </SweepCard>
        )}
      </PlotsRow>
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
  const [excludeLung, setExcludeLung]         = useState(false);
  const [excludeBrain, setExcludeBrain]       = useState(false);

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

      // Calibration circles
      const calCircles = customCirclesMap["gammex_Head_H"];
      if (calCircles) {
        formData.append("custom_circles_json", JSON.stringify(calCircles));
      }

      // Per-size test circles: send all non-calibration adjusted cards
      const perSize = {};
      for (const [key, circles] of Object.entries(customCirclesMap)) {
        if (key !== "gammex_Head_H" && circles) perSize[key] = circles;
      }
      if (Object.keys(perSize).length > 0) {
        formData.append("custom_circles_per_size_json", JSON.stringify(perSize));
      }

      formData.append("exclude_lung", excludeLung ? "true" : "false");
      formData.append("exclude_brain", excludeBrain ? "true" : "false");

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

          <ToggleRow>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={excludeLung}
                onChange={e => setExcludeLung(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: "#ff6bcb", cursor: "pointer" }}
              />
              <span style={{ fontSize: 13, color: "#a0b9e4" }}>
                Exclude lung inserts (LN-350 / LN-450) from RMSE
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", marginTop: 6 }}>
              <input
                type="checkbox"
                checked={excludeBrain}
                onChange={e => setExcludeBrain(e.target.checked)}
                style={{ width: 14, height: 14, accentColor: "#ffb347", cursor: "pointer" }}
              />
              <span style={{ fontSize: 13, color: "#a0b9e4" }}>
                Exclude brain insert from RMSE and calibration
              </span>
            </label>
            <ToggleNote>
              Excludes materials that may not be fully in-slice.
              Lung: affects Schneider, Saito, and Tanaka only (Hunemohr already excludes it).
              Brain: affects all models including Hunemohr calibration.
            </ToggleNote>
          </ToggleRow>

          <RunRow style={{ marginTop: 16 }}>
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

const ToggleRow = styled.div`
  display: flex; flex-direction: column; gap: 4px;
  margin-top: 20px;
  padding: 10px 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
`;
const ToggleNote = styled.p`
  font-size: 11px; color: #556a8a; margin: 0; line-height: 1.5;
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
const ModeToggleRow = styled.div`display: flex; gap: 6px; margin-bottom: 4px;`;
const RotationRow   = styled.div`display: flex; align-items: center; gap: 6px; margin-bottom: 4px;`;
const ModeBtn = styled.button`
  font-size: 10px; padding: 3px 8px; border-radius: 5px; cursor: pointer; border: 1px solid;
  background: ${({ active }) => active ? "rgba(255,107,203,0.2)" : "transparent"};
  color: ${({ active }) => active ? "#ff6bcb" : "#7a90b4"};
  border-color: ${({ active }) => active ? "#ff6bcb" : "#3a4a6a"};
  &:hover { border-color: #ff6bcb; color: #ff6bcb; }
`;

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
const CalNote    = styled.p`font-size: 11px; color: #7a90b4; margin: -2px 0 8px; font-style: italic;`;

const OkText  = styled.span`color: #2ecc71; font-size: 12px; display: inline-flex; align-items: center; gap: 4px;`;
const ErrText = styled.span`color: #e74c3c; font-size: 11px;`;

// ── Plots row ─────────────────────────────────────────────────────────────────
const PlotsRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 20px; margin-top: 28px; width: 100%; align-items: flex-start;
`;

const SweepCard = styled.div`
  flex: 1 1 420px; min-width: 320px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 16px; padding: 20px;
`;
const SweepCardHeader = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  cursor: pointer; margin-bottom: 8px;
  &:hover { opacity: 0.85; }
`;
const SweepBestBadge = styled.div`
  font-size: 12px; color: #2ecc71;
  background: rgba(46,204,113,0.1); border: 1px solid rgba(46,204,113,0.2);
  border-radius: 6px; padding: 5px 10px; margin-bottom: 10px;
`;
const SweepMatRow = styled.div`
  border-top: 1px solid rgba(255,255,255,0.06); padding: 6px 0;
`;
const SweepMatHeader = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  cursor: pointer; font-size: 12px; color: #c8d8f0;
  &:hover { color: #e0eafc; }
`;
const SweepErrBadge = styled.span`
  font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 12px;
  background: ${({ $low }) => $low ? "rgba(46,204,113,0.15)" : "rgba(231,76,60,0.12)"};
  color:      ${({ $low }) => $low ? "#2ecc71"               : "#e74c3c"};
`;
const SweepDetailTable = styled.table`
  width: 100%; border-collapse: collapse; font-size: 11px; color: #c8d8f0; margin-top: 6px;
`;
