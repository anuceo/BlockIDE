import React from 'react';

export const GasEstimator: React.FC = () => {
  return (
    <div className="gas-estimator">
      <h4>⛽ Gas Tracker</h4>
      <div className="gas-info">
        <div className="gas-level">
          <span>Slow: 15 Gwei</span>
          <small>~5 min</small>
        </div>
        <div className="gas-level">
          <span>Standard: 25 Gwei</span>
          <small>~2 min</small>
        </div>
        <div className="gas-level">
          <span>Fast: 35 Gwei</span>
          <small>~30 sec</small>
        </div>
      </div>
    </div>
  );
};

