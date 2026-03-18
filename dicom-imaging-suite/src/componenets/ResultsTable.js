// ResultsTable.js
import React from "react";
import styled from "styled-components";

const ResultsTable = ({ results, selectedModel }) => {
  if (selectedModel === "Tanaka" || selectedModel === "Saito") {
    const isSaito = selectedModel === "Saito";
    return (
      <TableWrapper>
        <TableTitle>{selectedModel} Results</TableTitle>
        <StyledTable>
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
              {isSaito && <TableHeader>Relative Error (%)</TableHeader>}
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
                {isSaito && (
                  <TableCell>
                    {result.relative_error !== undefined ? result.relative_error : "N/A"}
                  </TableCell>
                )}
              </tr>
            ))}
          </tbody>
        </StyledTable>
        <ParametersTable>
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
            <tr>
              <TableCell>{results.alpha}</TableCell>
              <TableCell>{results.a}</TableCell>
              <TableCell>{results.b}</TableCell>
              <TableCell>{results.gamma}</TableCell>
              <TableCell>{results.r}</TableCell>
            </tr>
          </tbody>
        </ParametersTable>
        <ParametersTable>
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
              {isSaito && <TableHeader>SPR RMSE</TableHeader>}
            </tr>
          </thead>
          <tbody>
            <tr>
              <TableCell>{results.rho_rmse}</TableCell>
              <TableCell>{results.z_rmse}</TableCell>
              <TableCell>{results.rho_r2}</TableCell>
              <TableCell>{results.z_r2}</TableCell>
              {isSaito && <TableCell>{results.spr_rmse ?? "N/A"}</TableCell>}
            </tr>
          </tbody>
        </ParametersTable>
      </TableWrapper>
    );
  }

  if (selectedModel === "Hunemohr") {
    return (
      <TableWrapper>
        <TableTitle>{selectedModel} Results</TableTitle>
        <StyledTable>
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
        </StyledTable>
        <ParametersTable>
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
            <tr>
              <TableCell>{results.rho_rmse}</TableCell>
              <TableCell>{results.z_rmse}</TableCell>
              <TableCell>{results.rho_r2}</TableCell>
              <TableCell>{results.z_r2}</TableCell>
            </tr>
          </tbody>
        </ParametersTable>
      </TableWrapper>
    );
  }

  return null;
};

export default ResultsTable;

const TableWrapper = styled.div`
  width: 100%;
  margin-top: 20px;
  color: #e0eafc;
`;

const TableTitle = styled.h4`
  color: #ff6bcb;
  margin-bottom: 10px;
  text-align: center;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 16px;
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  overflow: hidden;
`;

const ParametersTable = styled(StyledTable)`
  margin-top: 20px;
`;

const TableHeader = styled.th`
  padding: 12px;
  background: #ff6bcb;
  color: white;
  text-align: center;
`;

const TableCell = styled.td`
  padding: 10px;
  border-top: 1px solid #ff6bcb;
  text-align: center;
  &:first-child {
    border-left: none;
  }
`;
