import React, { useState, useEffect } from "react";
import styled from "styled-components";
import HelpModal from "./HelpModal";
import { AiOutlineQuestionCircle } from "react-icons/ai";
import { FaBrain } from "react-icons/fa";
import ImageViewer from "./ImageViewer";
import LoadingSpinner from "./LoadingSpinner";
import { FaHome } from "react-icons/fa";

const LoadingPage = () => {
  const [showHelp, setShowHelp] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isImagesReady, setIsImagesReady] = useState(false);
  const [showCompareResults, setShowCompareResults] = useState(false);
  const [highImages, setHighImages] = useState([]);
  const [lowImages, setLowImages] = useState([]);
  const [sliceThickness, setSliceThickness] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [circleRadius, setCircleRadius] = useState(10);
  const [phantomType, setPhantomType] = useState("head");
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [results, setResults] = useState([]);
  const [highKVP, setHighKVP] = useState(0);
  const [lowKVP, setLowKVP] = useState(0);
  const [comparisonResults, setComparisonResults] = useState([]);
  const [comparisonModel, setComparisonModel] = useState("");
  const [comparisonRadius, setComparisonRadius] = useState(circleRadius);
  const [showCompareMenu, setShowCompareMenu] = useState(false);

  useEffect(() => {
    fetch("http://127.0.0.1:5050/get-supported-models")
      .then((response) => response.json())
      .then((data) => {
        const modelOptions = Object.entries(data).map(([key, value]) => ({
          name: value.name,
        }));

        setModels(modelOptions);
        setSelectedModel(modelOptions[0]?.name || "");
      })
      .catch((error) => console.error("Failed to fetch models:", error));
  }, []);

  const handleFolderChange = async (event) => {
    setIsLoading(true);
    const files = event.target.files;
    const formData = new FormData();

    Array.from(files).forEach((file) => {
      formData.append("files", file, file.webkitRelativePath);
    });

    try {
      const response = await fetch("http://127.0.0.1:5050/upload-scan", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      setUploadStatus("Upload successful!");
      setHighImages(result.high_kvp_images);
      setLowImages(result.low_kvp_images);
      console.log("High Images: ", result.high_kvp_images);
      console.log("Low Images: ", result.low_kvp_images);

      setIsImagesReady(true);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadStatus("Upload failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const cleanNoise = async () => {
    try {
      console.log("Cleaning selected images...");

      const currentHighImage = highImages[currentIndex];
      const currentLowImage = lowImages[currentIndex];

      if (!currentHighImage || !currentLowImage) {
        console.error("No valid image pair found at index:", currentIndex);
        return;
      }

      const response = await fetch("http://127.0.0.1:5050/clean-noise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          high_kvp_image: currentHighImage,
          low_kvp_image: currentLowImage,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const cleanResults = await response.json();

      console.log("Images successfully cleaned.");

      // Add a cache-busting timestamp to force reload
      const timestamp = new Date().getTime();
      const updatedHighImages = [...highImages];
      const updatedLowImages = [...lowImages];

      updatedHighImages[currentIndex] = `${cleanResults.high}?t=${timestamp}`;
      updatedLowImages[currentIndex] = `${cleanResults.low}?t=${timestamp}`;

      setHighImages(updatedHighImages);
      setLowImages(updatedLowImages);

      // Show popup
      window.alert("✨ Images have been denoised successfully!");
    } catch (error) {
      console.error("Failed to clean images:", error);
      window.alert("❌ Failed to clean images. Please try again.");
    }
  };

  const handleCalculate = async () => {
    try {
      console.log("Selected Model:", selectedModel);

      // Get the current image pair
      const currentHighImage = highImages[currentIndex];
      const currentLowImage = lowImages[currentIndex];

      if (!currentHighImage || !currentLowImage) {
        console.error("No valid image pair found at index:", currentIndex);
        return;
      }

      const response = await fetch("http://127.0.0.1:5050/analyze-inserts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          radius: circleRadius,
          phantom: phantomType,
          model: selectedModel,
          highKVP: highKVP,
          lowKVP: lowKVP,
          sliceThickness: sliceThickness,
          high_kvp_image: currentHighImage, // Send only the selected high image
          low_kvp_image: currentLowImage, // Send only the selected low image
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const analysisResult = await response.json();

      console.log("Analysis Result:", analysisResult);

      // Store reference SPR values if available
      const referenceSprValues = analysisResult.reference_spr_values || {};

      // Process results properly
      if (selectedModel == "Tanaka") {
        const processedResults = analysisResult.results.materials.map(
          (material, index) => ({
            material: material,
            rho_e:
              analysisResult.results.calculated_rhos[index]?.toFixed(3) ||
              "N/A",
            z_eff:
              analysisResult.results.calculated_z_effs[index]?.toFixed(2) ||
              "N/A",
            mean_excitation:
              analysisResult.results.mean_excitations[index]?.toFixed(2) ||
              "N/A",
            stopping_power:
              analysisResult.results.stopping_power[index]?.toFixed(5) || "N/A",
            tanaka_stopping_power:
              analysisResult.results.tanaka_stopping_power[index]?.toFixed(3) ||
              "N/A",
          })
        );
        processedResults["alpha"] =
          analysisResult.results.alpha.toFixed(5) || "N/A";
        processedResults["gamma"] =
          analysisResult.results.gamma.toFixed(5) || "N/A";
        processedResults["a"] = analysisResult.results.a.toFixed(5) || "NA";
        processedResults["b"] = analysisResult.results.b.toFixed(5) || "NA";
        processedResults["r"] = analysisResult.results.r.toFixed(3) || "NA";
        processedResults["c0"] = analysisResult.results.c0?.toFixed(5) || "NA";
        processedResults["c1"] = analysisResult.results.c1?.toFixed(5) || "NA";
        processedResults["rho_rmse"] =
          analysisResult.results.error_metrics.rho.RMSE.toFixed(5) || "NA";
        processedResults["z_rmse"] =
          analysisResult.results.error_metrics.z.RMSE.toFixed(5) || "NA";
        processedResults["rho_r2"] =
          analysisResult.results.error_metrics.rho.R2.toFixed(5) || "NA";
        processedResults["z_r2"] =
          analysisResult.results.error_metrics.z.R2.toFixed(5) || "NA";
        processedResults["reference_spr_values"] = referenceSprValues;
        processedResults["error_metrics"] = analysisResult.results.error_metrics;

        setResults(processedResults);
      } else if (selectedModel == "Hunemohr") {
        const processedResults = analysisResult.results.materials.map(
          (material, index) => ({
            material: material,
            rho_e:
              analysisResult.results.calculated_rhos[index]?.toFixed(3) ||
              "N/A",
            z_eff:
              analysisResult.results.calculated_z_effs[index]?.toFixed(2) ||
              "N/A",
            stopping_power:
              analysisResult.results.stopping_power[index]?.toFixed(5) || "N/A",
            rho_rmse:
              analysisResult.results.error_metrics.rho.RMSE.toFixed(5) || "NA",
            z_rmse:
              analysisResult.results.error_metrics.z.RMSE.toFixed(5) || "NA",
          })
        );
        processedResults["rho_rmse"] =
          analysisResult.results.error_metrics.rho.RMSE.toFixed(5) || "NA";
        processedResults["z_rmse"] =
          analysisResult.results.error_metrics.z.RMSE.toFixed(5) || "NA";
        processedResults["rho_r2"] =
          analysisResult.results.error_metrics.rho.R2.toFixed(5) || "NA";
        processedResults["z_r2"] =
          analysisResult.results.error_metrics.z.R2.toFixed(5) || "NA";
        processedResults["percent_rho"] =
          analysisResult.results.error_metrics.rho.PercentError.toFixed(5) ||
          "NA";
        processedResults["percent_z"] =
          analysisResult.results.error_metrics.z.PercentError.toFixed(5) ||
          "NA";
        processedResults["c"] = analysisResult.results.c?.toFixed(5) || "NA";
        processedResults["d_e"] = analysisResult.results.d_e?.toFixed(5) || "NA";
        processedResults["reference_spr_values"] = referenceSprValues;
        processedResults["error_metrics"] = analysisResult.results.error_metrics;
        setResults(processedResults);
      } else if (selectedModel == "Saito") {
        const processedResults = analysisResult.results.materials.map(
          (material, index) => ({
            material: material,
            rho_e:
              analysisResult.results.calculated_rhos[index]?.toFixed(3) ||
              "N/A",
            z_eff:
              analysisResult.results.calculated_z_effs[index]?.toFixed(2) ||
              "N/A",
            stopping_power:
              analysisResult.results.stopping_power[index]?.toFixed(5) || "N/A",
            alpha: analysisResult.results.alpha.toFixed(5) || "N/A",
          })
        );
        processedResults["alpha"] =
          analysisResult.results.alpha.toFixed(5) || "N/A";
        processedResults["gamma"] =
          analysisResult.results.gamma.toFixed(5) || "N/A";
        processedResults["a"] = analysisResult.results.a.toFixed(5) || "NA";
        processedResults["b"] = analysisResult.results.b.toFixed(5) || "NA";
        processedResults["r"] = analysisResult.results.r.toFixed(3) || "NA";
        processedResults["rho_rmse"] =
          analysisResult.results.error_metrics.rho.RMSE.toFixed(5) || "NA";
        processedResults["z_rmse"] =
          analysisResult.results.error_metrics.z.RMSE.toFixed(5) || "NA";
        processedResults["rho_r2"] =
          analysisResult.results.error_metrics.rho.R2.toFixed(5) || "NA";
        processedResults["z_r2"] =
          analysisResult.results.error_metrics.z.R2.toFixed(5) || "NA";
        processedResults["reference_spr_values"] = referenceSprValues;
        processedResults["error_metrics"] = analysisResult.results.error_metrics;

        setResults(processedResults);
      }
    } catch (error) {
      console.error("Failed to calculate stopping power:", error);
    }
  };

  const handleNextImage = () => {
    setCurrentIndex(
      (prevIndex) =>
        (prevIndex + 1) % Math.min(highImages.length, lowImages.length)
    );
  };

  const handlePreviousImage = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0
        ? Math.min(highImages.length, lowImages.length) - 1
        : prevIndex - 1
    );
  };

  const handleRadiusChange = async (event) => {
    const newRadius = event.target.value;
    setCircleRadius(newRadius);

    try {
      const response = await fetch(`http://127.0.0.1:5050/update-circles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          radius: newRadius,
          phantom_type: phantomType,
          high_kvp_images: highImages,
          low_kvp_images: lowImages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      setHighImages(result.updated_high_kvp_images);
      setLowImages(result.updated_low_kvp_images);
    } catch (error) {
      console.error("Failed to update circle radius:", error);
    }
  };

  const handleBack = () => {
    setResults([]); // Clear only the results
    setIsComparing(false);
  };

  const handleHome = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5050/reset-processed", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to reset backend folder.");
      }

      // Clear all relevant state
      setIsImagesReady(false);
      setIsComparing(false);
      setShowCompareResults(false);
      setIsLoading(false);
      setUploadStatus(null);
      setShowCompareMenu(false);
      setHighImages([]);
      setLowImages([]);
      setResults([]);
      setCurrentIndex(0);
      setCircleRadius(10);
      setPhantomType("head");
      setSelectedModel(models[0]?.name || "");
      setSliceThickness(0);
      setHighKVP(0);
      setLowKVP(0);

      window.alert("✅ Ready for a new scan!");
    } catch (error) {
      console.error("Failed to reset processed images:", error);
      window.alert("❌ Failed to reset. Please try again.");
    }
  };

  // API to compare results
  const handleCompare = async () => {
    setIsComparing(true);
    const currentHighImage = highImages[currentIndex];
    const currentLowImage = lowImages[currentIndex];

    if (!currentHighImage || !currentLowImage) {
      console.error("No valid image pair found.");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:5050/analyze-inserts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          radius: comparisonRadius,
          phantom: phantomType,
          model: comparisonModel,
          highKVP: highKVP,
          lowKVP: lowKVP,
          sliceThickness: sliceThickness,
          high_kvp_image: currentHighImage,
          low_kvp_image: currentLowImage,
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();

      const processed = data.results.materials.map((material, index) => ({
        material,
        rho_e: data.results.calculated_rhos[index]?.toFixed(3) || "N/A",
        z_eff: data.results.calculated_z_effs[index]?.toFixed(2) || "N/A",
        stopping_power: data.results.stopping_power[index]?.toFixed(5) || "N/A",
      }));

      setComparisonResults(processed);
    } catch (err) {
      console.error("Comparison analysis failed:", err);
      alert("Comparison run failed.");
    }
  };

  // Setting user input for parameters
  const handleHighKVPChange = async (event) => {
    setHighKVP(event.target.value);
  };

  const handleLowKVPChange = async (event) => {
    setLowKVP(event.target.value);
  };

  const handleSliceThicknessChange = async (event) => {
    setSliceThickness(event.target.value);
  };

  // Download results
  const downloadResultsAsCSV = () => {
    if (results.length === 0) return;

    // Use model names in the headers
    const mainLabel = selectedModel || "Main";
    const compareLabel = comparisonModel || "Compare";

    let csvContent = `Insert #,Material,ρₑ (${mainLabel}),Zₑ𝑓𝑓 (${mainLabel}),SPR (${mainLabel}),ρₑ (${compareLabel}),Zₑ𝑓𝑓 (${compareLabel}),SPR (${compareLabel})\n`;

    const length = Math.max(results.length, comparisonResults.length);

    for (let i = 0; i < length; i++) {
      const main = results[i] || {};
      const cmp = comparisonResults[i] || {};
      csvContent += `${i + 1},${main.material || cmp.material || "N/A"},${
        main.rho_e || "N/A"
      },${main.z_eff || "N/A"},${main.stopping_power || "N/A"},${
        cmp.rho_e || "N/A"
      },${cmp.z_eff || "N/A"},${cmp.stopping_power || "N/A"}\n`;
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `DECT_Comparison_${mainLabel}_vs_${compareLabel}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // START UI
  return (
    // Start page
    <Background>
      <Content>
        {isLoading && <LoadingSpinner />}
        {!isImagesReady && !isLoading && (
          <>
            <BrainIcon />
            <Title>SPR-Net</Title>
            <Subtitle>Analyze and process DECT scans with ease</Subtitle>
            <p>
              Upload a folder containing a Dual-Energy CT (DECT) scan series in
              DICOM format. The tool will automatically process and display the
              corresponding images. Make sure your dataset includes both high
              and low kVp images.
            </p>
            <input
              type="file"
              id="folderInput"
              webkitdirectory="true"
              directory="true"
              style={{ display: "none" }}
              onChange={handleFolderChange}
            />
            <UploadButton
              onClick={() => document.getElementById("folderInput").click()}
            >
              Upload DICOM Series
            </UploadButton>
            {uploadStatus && <StatusMessage>{uploadStatus}</StatusMessage>}
            <HelpButton onClick={() => setShowHelp(true)}>
              <AiOutlineQuestionCircle size={24} />
            </HelpButton>
            {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
          </>
        )}
        {/* Tool page */}
        {isImagesReady && results.length === 0 && (
          <>
            <Header>
              <h1>DECT Scan Viewer</h1>
            </Header>
            <ImageViewer
              highImages={highImages}
              lowImages={lowImages}
              currentIndex={currentIndex}
              handleNextImage={handleNextImage}
              handlePreviousImage={handlePreviousImage}
            />
            <CleanButton onClick={cleanNoise} className="">
              Clean Noise ✨
            </CleanButton>
            <SelectContainer>
              <label>Phantom Type:</label>
              <Select
                value={phantomType}
                onChange={(e) => setPhantomType(e.target.value)}
              >
                <option value="head">Head</option>
                <option value="body">Body</option>
              </Select>
            </SelectContainer>
            <SliderContainer>
              <label>Circle Radius: {circleRadius}px</label>
              <RadiusSlider
                type="range"
                min="1"
                max="100"
                value={circleRadius}
                onChange={handleRadiusChange}
              />
            </SliderContainer>
            <SliderContainer>
              <label>High KVP: {highKVP} KVP</label>
              <RadiusSlider
                type="range"
                min="10"
                max="200"
                step={10}
                value={highKVP}
                onChange={handleHighKVPChange}
              />
            </SliderContainer>
            <SliderContainer>
              <label>Low KVP: {lowKVP} KVP</label>
              <RadiusSlider
                type="range"
                min="10"
                max="200"
                step={10}
                value={lowKVP}
                onChange={handleLowKVPChange}
              />
            </SliderContainer>
            <SliderContainer>
              <label>Slice Thickness : {sliceThickness} mm</label>
              <RadiusSlider
                type="range"
                min="0"
                max="20"
                step={0.5}
                value={sliceThickness}
                onChange={handleSliceThicknessChange}
              />
            </SliderContainer>
            <SelectContainer>
              <label>Select Model:</label>
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </Select>
            </SelectContainer>
            <CalculateButton onClick={handleCalculate}>
              Calculate Stopping Power
            </CalculateButton>
          </>
        )}
        {/* Result page */}
        {results.length > 0 && selectedModel == "Tanaka" && (
          <>
            <BackButton onClick={handleBack}> ← </BackButton>
            <BackButton onClick={handleHome} style={{ left: "70px" }}>
              <FaHome />
            </BackButton>
            <BackButton
              onClick={downloadResultsAsCSV}
              style={{ left: "520px" }}
            >
              💾
            </BackButton>
            <ResultsTable>
              <thead>
                <tr>
                  <TableHeader>Insert #</TableHeader>
                  <TableHeader>Material</TableHeader>
                  <TableHeader>
                    ρ<sub>e</sub>
                  </TableHeader>
                  <TableHeader>
                    Z<sub>eff</sub>
                  </TableHeader>
                  <TableHeader>Stopping Power Ratio</TableHeader>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{result.material}</TableCell>
                    <TableCell>{result.rho_e}</TableCell>
                    <TableCell>{result.z_eff}</TableCell>
                    <TableCell>{result.stopping_power}</TableCell>
                  </tr>
                ))}
              </tbody>
            </ResultsTable>
            <ResultsTable>
              <thead>
                <tr>
                  <TableHeader>α</TableHeader>
                  <TableHeader>a</TableHeader>
                  <TableHeader>b</TableHeader>
                  <TableHeader>γ</TableHeader>
                  <TableHeader>
                    R<sup>2</sup>
                  </TableHeader>
                </tr>
              </thead>
              <tbody>
                <TableCell>{results.alpha}</TableCell>
                <TableCell>{results.a}</TableCell>
                <TableCell>{results.b}</TableCell>
                <TableCell>{results.gamma}</TableCell>
                <TableCell>{results.r}</TableCell>
              </tbody>
            </ResultsTable>
            <ResultsTable>
              <thead>
                <tr>
                  <TableHeader>
                    ρ<sub>e</sub> RMSE
                  </TableHeader>
                  <TableHeader>
                    Z<sub>eff</sub> RMSE
                  </TableHeader>
                  <TableHeader>
                    ρ<sub>e</sub> R<sup>2</sup>
                  </TableHeader>
                  <TableHeader>
                    Z<sub>eff</sub> R<sup>2</sup>
                  </TableHeader>
                </tr>
              </thead>
              <tbody>
                <TableCell>{results.rho_rmse}</TableCell>
                <TableCell>{results.z_rmse}</TableCell>
                <TableCell>{results.rho_r2}</TableCell>
                <TableCell>{results.z_r2}</TableCell>
              </tbody>
            </ResultsTable>
            <></>
          </>
        )}
        {results.length > 0 && selectedModel == "Saito" && (
          <>
            <BackButton onClick={handleBack}> ← </BackButton>
            <BackButton onClick={handleHome} style={{ left: "70px" }}>
              <FaHome />
            </BackButton>
            <BackButton
              onClick={downloadResultsAsCSV}
              style={{ left: "520px" }}
            >
              💾
            </BackButton>
            <ResultsTable>
              <thead>
                <tr>
                  <TableHeader>Insert #</TableHeader>
                  <TableHeader>Material</TableHeader>
                  <TableHeader>
                    ρ<sub>e</sub>
                  </TableHeader>
                  <TableHeader>
                    Z<sub>eff</sub>
                  </TableHeader>
                  <TableHeader>Stopping Power Ratio</TableHeader>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{result.material}</TableCell>
                    <TableCell>{result.rho_e}</TableCell>
                    <TableCell>{result.z_eff}</TableCell>
                    <TableCell>{result.stopping_power}</TableCell>
                  </tr>
                ))}
              </tbody>
            </ResultsTable>
            <ResultsTable>
              <thead>
                <tr>
                  <TableHeader>α</TableHeader>
                  <TableHeader>a</TableHeader>
                  <TableHeader>b</TableHeader>
                  <TableHeader>γ</TableHeader>
                  <TableHeader>
                    R<sup>2</sup>
                  </TableHeader>
                </tr>
              </thead>
              <tbody>
                <TableCell>{results.alpha}</TableCell>
                <TableCell>{results.a}</TableCell>
                <TableCell>{results.b}</TableCell>
                <TableCell>{results.gamma}</TableCell>
                <TableCell>{results.r}</TableCell>
              </tbody>
            </ResultsTable>
            <ResultsTable>
              <thead>
                <tr>
                  <TableHeader>
                    ρ<sub>e</sub> RMSE
                  </TableHeader>
                  <TableHeader>
                    Z<sub>eff</sub> RMSE
                  </TableHeader>
                  <TableHeader>
                    ρ<sub>e</sub> R<sup>2</sup>
                  </TableHeader>
                  <TableHeader>
                    Z<sub>eff</sub> R<sup>2</sup>
                  </TableHeader>
                </tr>
              </thead>
              <tbody>
                <TableCell>{results.rho_rmse}</TableCell>
                <TableCell>{results.z_rmse}</TableCell>
                <TableCell>{results.rho_r2}</TableCell>
                <TableCell>{results.z_r2}</TableCell>
              </tbody>
            </ResultsTable>
            <></>
          </>
        )}
        {results.length > 0 && selectedModel == "Hunemohr" && (
          <>
            <BackButton onClick={handleBack}> ← </BackButton>
            <BackButton onClick={handleHome} style={{ left: "70px" }}>
              <FaHome />
            </BackButton>
            <BackButton
              onClick={downloadResultsAsCSV}
              style={{ left: "520px" }}
            >
              💾
            </BackButton>
            <ResultsTable>
              <thead>
                <tr>
                  <TableHeader>Insert #</TableHeader>
                  <TableHeader>Material</TableHeader>
                  <TableHeader>
                    ρ<sub>e</sub>
                  </TableHeader>
                  <TableHeader>
                    Z<sub>eff</sub>
                  </TableHeader>
                  <TableHeader>Stopping Power Ratio</TableHeader>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{result.material}</TableCell>
                    <TableCell>{result.rho_e}</TableCell>
                    <TableCell>{result.z_eff}</TableCell>
                    <TableCell>{result.stopping_power}</TableCell>
                  </tr>
                ))}
              </tbody>
            </ResultsTable>
            <ResultsTable>
              <thead>
                <tr>
                  <TableHeader>
                    ρ<sub>e</sub> RMSE
                  </TableHeader>
                  <TableHeader>
                    Z<sub>eff</sub> RMSE
                  </TableHeader>
                  <TableHeader>
                    ρ<sub>e</sub> R<sup>2</sup>
                  </TableHeader>
                  <TableHeader>
                    Z<sub>eff</sub> R<sup>2</sup>
                  </TableHeader>
                </tr>
              </thead>
              <tbody>
                <TableCell>{results.rho_rmse}</TableCell>
                <TableCell>{results.z_rmse}</TableCell>
                <TableCell>{results.rho_r2}</TableCell>
                <TableCell>{results.z_r2}</TableCell>
              </tbody>
            </ResultsTable>
            <></>
          </>
        )}
        {results.length > 0 && (
          <>
            <ToggleCompareButton
              onClick={() => {
                setShowCompareMenu(!showCompareMenu)
                setShowCompareResults(!showCompareResults)
              }}
            >
              {showCompareMenu
                ? "Cancel Comparison"
                : "🔍 Compare with Another Model"}
            </ToggleCompareButton>
          </>
        )}
        {showCompareMenu && (
          <AnimatedCompareMenu>
            <h3 style={{ color: "#ff6bcb" }}>Run Comparison</h3>
            <SelectContainer>
              <label>Choose Another Model:</label>
              <Select
                value={comparisonModel}
                onChange={(e) => setComparisonModel(e.target.value)}
              >
                {models.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </Select>
            </SelectContainer>

            <SliderContainer>
              <label>Comparison Radius: {comparisonRadius}px</label>
              <RadiusSlider
                type="range"
                min="1"
                max="100"
                value={comparisonRadius}
                onChange={(e) => setComparisonRadius(e.target.value)}
              />
            </SliderContainer>

            <CalculateButton onClick={handleCompare}>
              Run Comparison
            </CalculateButton>
          </AnimatedCompareMenu>
        )}
        {comparisonResults.length > 0 && showCompareResults &&(
          <ScrollableResults>
            <ResultsBlock>
              <h4>Comparison ({comparisonModel})</h4>
              <ResultsTable>
                <thead>
                  <tr>
                    <TableHeader>Insert #</TableHeader>
                    <TableHeader>Material</TableHeader>
                    <TableHeader>ρₑ</TableHeader>
                    <TableHeader>Zₑ𝑓𝑓</TableHeader>
                    <TableHeader>Stopping Power Ratio</TableHeader>
                  </tr>
                </thead>
                <tbody>
                  {comparisonResults.map((result, index) => (
                    <tr key={`cmp-${index}`}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{result.material}</TableCell>
                      <TableCell>{result.rho_e}</TableCell>
                      <TableCell>{result.z_eff}</TableCell>
                      <TableCell>{result.stopping_power}</TableCell>
                    </tr>
                  ))}
                </tbody>
              </ResultsTable>
            </ResultsBlock>
          </ScrollableResults>
        )}
      </Content>
      <Footer>
        <FooterText>© 2025 DECT Imaging Suite. All rights reserved.</FooterText>
      </Footer>
    </Background>
  );
};

export default LoadingPage;

// Styled components
const Background = styled.div`
  background: linear-gradient(135deg, #1f2a48, #3e5b99);
  min-height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #e0eafc;
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
`;

const Content = styled.div`
  text-align: center;
  position: relative;
  max-width: 800px;
  padding: 40px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 15px;
  box-shadow: 0px 10px 20px rgba(0, 0, 0, 0.3);
`;

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

const Header = styled.div`
  margin-bottom: 20px;
`;

const BackButton = styled.button`
  position: absolute;
  top: 10px;
  left: 20px;
  background: #ff6bcb;
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  box-shadow: 0px 4px 10px rgba(0, 0, 0, 0.2);
  transition: background 0.3s, transform 0.2s;

  &:hover {
    background: #ff4bb2;
    transform: scale(1.1);
  }
`;

const SliderContainer = styled.div`
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #ff6bcb;
`;

const RadiusSlider = styled.input`
  width: 200px;
  margin-top: 10px;
`;

const SelectContainer = styled.div`
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #ff6bcb;
`;

const Select = styled.select`
  padding: 5px;
  border-radius: 5px;
  border: 1px solid #ff6bcb;
  color: #ff6bcb;
  background-color: #fff;
  font-size: 16px;
`;

const CalculateButton = styled.button`
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

const CleanButton = styled.button`
  background: #6bbaff;
  color: white;
  padding: 15px 25px;
  margin-top: 15px;
  font-size: 16px;
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

const ResultsTable = styled.table`
  width: 100%;
  margin-top: 20px;
  color: #e0eafc;
  border-collapse: collapse;
  font-size: 16px;
`;

const TableHeader = styled.th`
  padding: 10px;
  background: #ff6bcb;
  color: white;
  text-align: center;
`;

const TableCell = styled.td`
  padding: 10px;
  border-top: 1px solid #ff6bcb;
  text-align: center;
`;

const Footer = styled.footer`
  position: fixed;
  bottom: 0;
  width: 100%;
  background: linear-gradient(135deg, #1f2a48, #3e5b99);
  color: #e0eafc;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  box-shadow: 0px -5px 10px rgba(0, 0, 0, 0.2);
`;

const FooterText = styled.p`
  margin: 0;
`;

const ToggleCompareButton = styled.button`
  margin-top: 20px;
  background: #ffb347;
  color: #1f2a48;
  padding: 10px 20px;
  font-size: 15px;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #ffa500;
  }
`;

const AnimatedCompareMenu = styled.div`
  margin-top: 20px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid #ff6bcb;
  border-radius: 15px;
  animation: fadeIn 0.3s ease-in-out;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: scale(0.98);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;

const ScrollableResults = styled.div`
  display: flex;
  overflow-x: auto;
  gap: 30px;
  margin-top: 40px;
  padding-bottom: 20px;
`;

const ResultsBlock = styled.div`
  min-width: 500px;
  background-color: #2e3d66;
  padding: 20px;
  border-radius: 10px;
`;
