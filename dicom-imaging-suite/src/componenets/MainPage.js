// LoadingPage.js
import React, { useState, useEffect } from "react";
import styled from "styled-components";
import LoadingSpinner from "./LoadingSpinner";
import UploadSection from "./UploadSection";
import ViewerSection from "./ViewerSection";
import ResultsSection from "./ResultsSection";
import TestSection from "./TestSection";
import TestResultsSection from "./TestResultsSection";

const MainPage = () => {
  const [showHelp, setShowHelp] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isImagesReady, setIsImagesReady] = useState(false);
  const [showCompareResults, setShowCompareResults] = useState(false);
  const [highImages, setHighImages] = useState([]);
  const [lowImages, setLowImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [circleRadius, setCircleRadius] = useState(10);
  const [phantomType, setPhantomType] = useState("head");
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [results, setResults] = useState([]);
  const [comparisonResults, setComparisonResults] = useState([]);
  const [comparisonModel, setComparisonModel] = useState("");
  const [comparisonRadius, setComparisonRadius] = useState(circleRadius);
  const [showCompareMenu, setShowCompareMenu] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [calibrationFile, setCalibrationFile] = useState(null);
  const [isTestResults, setIsTestResults] = useState(false);
  const [sprMapUrl, setSprMapUrl] = useState(null);
  const [isSECT, setIsSECT] = useState(false);
  const [sprMapUrls, setSprMapUrls] = useState([]);

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

      const newHighImages = result.high_kvp_images;
      const newLowImages = result.low_kvp_images;

      // Use the explicit flag from backend if available, or fallback to checking length
      const isSingleEnergy =
        result.is_sect !== undefined
          ? result.is_sect
          : !newLowImages || newLowImages.length === 0;

      setHighImages(newHighImages);
      setLowImages(newLowImages || []); // Ensure it's at least an empty array
      setIsSECT(isSingleEnergy);

      if (isSingleEnergy) {
        // Force selection to Schneider for SECT
        const schneider = models.find((m) => m.name === "Schneider");
        if (schneider) {
          setSelectedModel("Schneider");
        }
      }

      setIsImagesReady(true);
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadStatus("Upload failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestUpload = async (dicomFiles, calibrationFile) => {
    setIsLoading(true);
    const formData = new FormData();

    Array.from(dicomFiles).forEach((file) => {
      formData.append("files", file, file.webkitRelativePath);
    });
    formData.append("calibration_file", calibrationFile);

    try {
      const response = await fetch("http://127.0.0.1:5050/test-calibration", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      setUploadStatus("Test successful!");

      const analysisResult = result.analysis_results;
      let processedResults = [];

      if (result.model === "Schneider") {
        processedResults = Object.entries(analysisResult.materials).map(
          ([materialName, data]) => ({
            material: materialName,
            rho_e: data.predicted_rho?.toFixed(3) || "N/A",
            z_eff: data.z_eff?.toFixed(3) || "N/A",
            stopping_power: data.predicted_spr?.toFixed(5) || "N/A",
          })
        );
      } else {
        processedResults = analysisResult.materials.map((material, index) => ({
          material: material,
          rho_e: analysisResult.calculated_rhos[index]?.toFixed(3) || "N/A",
          z_eff: analysisResult.calculated_z_effs[index]?.toFixed(2) || "N/A",
          stopping_power:
            analysisResult.stopping_power[index]?.toFixed(5) || "N/A",
        }));
      }

      setResults(processedResults);
      setSelectedModel(result.model);

      try {
        const sprValues = {};
        processedResults.forEach((row) => {
          if (row.material && row.stopping_power !== "N/A") {
            const val = parseFloat(row.stopping_power);
            if (!isNaN(val)) {
              sprValues[row.material] = val;
            }
          }
        });

        if (sprValues.Background === undefined) {
          sprValues.Background = 0.86;
        }

        const imageUrlForMap =
          result.high_kvp_images && result.high_kvp_images.length > 0
            ? result.high_kvp_images[0]
            : "";

        if (imageUrlForMap) {
          const mapResp = await fetch("http://127.0.0.1:5050/make-spr-map", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phantom: phantomType,
              which: "high",
              image_url: imageUrlForMap,
              spr_values: sprValues,
              phantom_material: "Background",
            }),
          });

          if (mapResp.ok) {
            const mapData = await mapResp.json();

            if (mapData.spr_maps && Array.isArray(mapData.spr_maps)) {
              const urls = mapData.spr_maps.map(
                (path) => `http://127.0.0.1:5050${path}?t=${Date.now()}`
              );
              setSprMapUrls(urls);
            }
          } else {
            console.warn(
              "SPR Map generation failed with status:",
              mapResp.status
            );
          }
        }
      } catch (mapError) {
        console.error("Failed to generate SPR map for test results:", mapError);
      }

      setIsTestResults(true);
      setIsTestMode(false);
      setIsImagesReady(false);
    } catch (error) {
      console.error("Test failed:", error);
      setUploadStatus("Test failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const cleanNoise = async () => {
    if (isSECT) {
      window.alert("Noise cleaning requires Dual Energy (High/Low) images.");
      return;
    }
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

      const timestamp = new Date().getTime();
      const updatedHighImages = [...highImages];
      const updatedLowImages = [...lowImages];

      updatedHighImages[currentIndex] = `${cleanResults.high}?t=${timestamp}`;
      updatedLowImages[currentIndex] = `${cleanResults.low}?t=${timestamp}`;

      setHighImages(updatedHighImages);
      setLowImages(updatedLowImages);

      window.alert("✨ Images have been denoised successfully!");
    } catch (error) {
      console.error("Failed to clean images:", error);
      window.alert("❌ Failed to clean images. Please try again.");
    }
  };

  const handleCalculate = async () => {
    try {
      const currentHighImage = highImages[currentIndex];
      // For SECT, lowImage might be undefined, which is fine for Schneider
      const currentLowImage = lowImages[currentIndex] || "";

      if (!currentHighImage) {
        console.error("No valid image found at index:", currentIndex);
        return;
      }

      const response = await fetch("http://127.0.0.1:5050/analyze-inserts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          radius: circleRadius,
          phantom: phantomType,
          model: selectedModel,
          high_kvp_image: currentHighImage,
          low_kvp_image: currentLowImage,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const analysisResult = await response.json();

      // Handle Schneider Calibration File Download
      if (selectedModel === "Schneider") {
        // Create downloadable JSON blob
        const blob = new Blob([JSON.stringify(analysisResult, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `schneider_calibration_${new Date()
          .toISOString()
          .slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.alert(
          "✅ Calibration complete! A configuration file has been downloaded.\n\n" +
            "Use this file in 'Test Mode' to analyze unknown scans."
        );

        return; // Stop here, do not try to render results table
      }

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
        processedResults["rho_rmse"] =
          analysisResult.results.error_metrics.rho.RMSE.toFixed(5) || "NA";
        processedResults["z_rmse"] =
          analysisResult.results.error_metrics.z.RMSE.toFixed(5) || "NA";
        processedResults["rho_r2"] =
          analysisResult.results.error_metrics.rho.R2.toFixed(5) || "NA";
        processedResults["z_r2"] =
          analysisResult.results.error_metrics.z.R2.toFixed(5) || "NA";

        setResults(processedResults);

        // 3) Build {material: SPR} for the map from processedResults
        const sprValues = {};
        for (const row of processedResults) {
          if (
            row?.material &&
            row?.stopping_power &&
            row.stopping_power !== "N/A"
          ) {
            const v = Number(row.stopping_power);
            if (!Number.isNaN(v)) sprValues[row.material] = v;
          }
        }
        if (sprValues.Background === undefined) {
          sprValues.Background = 0.86; // your default phantom matrix SPR
        }

        // 4) Call /make-spr-map once
        const which = "high"; // or "low"
        const imageUrlForMap =
          which === "high" ? currentHighImage : currentLowImage;

        const resp = await fetch("http://127.0.0.1:5050/make-spr-map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phantom: phantomType,
            which,
            image_url: imageUrlForMap,
            spr_values: sprValues,
            phantom_material: "Background",
          }),
        });
        if (!resp.ok) throw new Error(`SPR map error: ${resp.status}`);
        const mapData = await resp.json();
        if (mapData.spr_maps && Array.isArray(mapData.spr_maps)) {
          const urls = mapData.spr_maps.map(
            (path) => `http://127.0.0.1:5050${path}?t=${Date.now()}`
          );
          setSprMapUrls(urls); // Use the plural state to store all maps
        }
      } else if (selectedModel == "Hunemohr") {
        console.log(analysisResult)
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
        setResults(processedResults);

        // 3) Build {material: SPR} for the map from processedResults
        const sprValues = {};
        for (const row of processedResults) {
          if (
            row?.material &&
            row?.stopping_power &&
            row.stopping_power !== "N/A"
          ) {
            const v = Number(row.stopping_power);
            if (!Number.isNaN(v)) sprValues[row.material] = v;
          }
        }
        if (sprValues.Background === undefined) {
          sprValues.Background = 0.86; // your default phantom matrix SPR
        }

        // 4) Call /make-spr-map once
        const which = "high"; // or "low"
        const imageUrlForMap =
          which === "high" ? currentHighImage : currentLowImage;

        const resp = await fetch("http://127.0.0.1:5050/make-spr-map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phantom: phantomType,
            which,
            image_url: imageUrlForMap,
            spr_values: sprValues,
            phantom_material: "Background",
          }),
        });
        if (!resp.ok) throw new Error(`SPR map error: ${resp.status}`);
        const mapData = await resp.json();
        if (mapData.spr_maps && Array.isArray(mapData.spr_maps)) {
          const urls = mapData.spr_maps.map(
            (path) => `http://127.0.0.1:5050${path}?t=${Date.now()}`
          );
          setSprMapUrls(urls); // Use the plural state to store all maps
        }
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

        setResults(processedResults);

        // 3) Build {material: SPR} for the map from processedResults
        const sprValues = {};
        for (const row of processedResults) {
          if (
            row?.material &&
            row?.stopping_power &&
            row.stopping_power !== "N/A"
          ) {
            const v = Number(row.stopping_power);
            if (!Number.isNaN(v)) sprValues[row.material] = v;
          }
        }
        if (sprValues.Background === undefined) {
          sprValues.Background = 0.86; // your default phantom matrix SPR
        }

        // 4) Call /make-spr-map once
        const which = "high"; // or "low"
        const imageUrlForMap =
          which === "high" ? currentHighImage : currentLowImage;

        const resp = await fetch("http://127.0.0.1:5050/make-spr-map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phantom: phantomType,
            which,
            image_url: imageUrlForMap,
            spr_values: sprValues,
            phantom_material: "Background",
          }),
        });
        if (!resp.ok) throw new Error(`SPR map error: ${resp.status}`);
        const mapData = await resp.json();
        if (mapData.spr_maps && Array.isArray(mapData.spr_maps)) {
          const urls = mapData.spr_maps.map(
            (path) => `http://127.0.0.1:5050${path}?t=${Date.now()}`
          );
          setSprMapUrls(urls); // Use the plural state to store all maps
        }
      }
    } catch (error) {
      console.error("Failed to calculate stopping power:", error);
    }
  };

  const handleNextImage = () => {
    // Determine max index based on availability
    const count = isSECT
      ? highImages.length
      : Math.min(highImages.length, lowImages.length);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % count);
  };

  const handlePreviousImage = () => {
    const count = isSECT
      ? highImages.length
      : Math.min(highImages.length, lowImages.length);
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? count - 1 : prevIndex - 1
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
      if (result.updated_low_kvp_images) {
        setLowImages(result.updated_low_kvp_images);
      }
    } catch (error) {
      console.error("Failed to update circle radius:", error);
    }
  };

  const handleBack = () => {
    setResults([]);
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
      setIsTestMode(false);
      setCalibrationFile(null);
      setIsSECT(false);
      // setSprMapUrl(null);

      window.alert("✅ Ready for a new scan!");
    } catch (error) {
      console.error("Failed to reset processed images:", error);
      window.alert("❌ Failed to reset. Please try again.");
    }
  };

  const handleCompare = async () => {
    setIsComparing(true);
    const currentHighImage = highImages[currentIndex];
    const currentLowImage = lowImages[currentIndex];

    // Compare logic relies on DECT mostly, or Schneider comparison on SECT.
    // Assuming comparison logic stays for DECT for now.
    if (!currentHighImage || (!isSECT && !currentLowImage)) {
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

  const downloadResultsAsCSV = () => {
    if (results.length === 0) return;

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

  const renderContent = () => {
    if (isLoading) {
      return <LoadingSpinner />;
    }

    if (isTestResults) {
      return (
        <TestResultsSection
          results={results}
          selectedModel={selectedModel}
          comparisonResults={comparisonResults}
          comparisonModel={comparisonModel}
          showCompareMenu={showCompareMenu}
          setShowCompareMenu={setShowCompareMenu}
          setShowCompareResults={setShowCompareResults}
          handleBack={handleBack}
          handleHome={handleHome}
          downloadResultsAsCSV={downloadResultsAsCSV}
          models={models}
          setComparisonModel={setComparisonModel}
          comparisonRadius={comparisonRadius}
          setComparisonRadius={setComparisonRadius}
          handleCompare={handleCompare}
          showCompareResults={showCompareResults}
          sprMapUrls={sprMapUrls}
        />
      );
    }

    if (results.length > 0) {
      return (
        <ResultsSection
          results={results}
          selectedModel={selectedModel}
          comparisonResults={comparisonResults}
          comparisonModel={comparisonModel}
          showCompareMenu={showCompareMenu}
          setShowCompareMenu={setShowCompareMenu}
          setShowCompareResults={setShowCompareResults}
          handleBack={handleBack}
          handleHome={handleHome}
          downloadResultsAsCSV={downloadResultsAsCSV}
          models={models}
          setComparisonModel={setComparisonModel}
          comparisonRadius={comparisonRadius}
          setComparisonRadius={setComparisonRadius}
          handleCompare={handleCompare}
          showCompareResults={showCompareResults}
          sprMapUrls={sprMapUrls}
        />
      );
    }

    if (isTestMode) {
      return (
        <TestSection
          handleTestUpload={handleTestUpload}
          uploadStatus={uploadStatus}
          handleBack={() => setIsTestMode(false)}
        />
      );
    }

    if (isImagesReady) {
      return (
        <ViewerSection
          highImages={highImages}
          lowImages={lowImages}
          currentIndex={currentIndex}
          handleNextImage={handleNextImage}
          handlePreviousImage={handlePreviousImage}
          cleanNoise={cleanNoise}
          phantomType={phantomType}
          setPhantomType={setPhantomType}
          circleRadius={circleRadius}
          handleRadiusChange={handleRadiusChange}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          models={
            isSECT ? models.filter((m) => m.name === "Schneider") : models
          }
          handleCalculate={handleCalculate}
          handleHome={handleHome}
        />
      );
    }

    return (
      <UploadSection
        handleFolderChange={handleFolderChange}
        uploadStatus={uploadStatus}
        setShowHelp={setShowHelp}
        showHelp={showHelp}
        setIsTestMode={setIsTestMode}
      />
    );
  };

  return (
    <Background>
      <Content>{renderContent()}</Content>
      <Footer>
        <FooterText>© 2025 DECT Imaging Suite. All rights reserved.</FooterText>
      </Footer>
    </Background>
  );
};

export default MainPage;

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
