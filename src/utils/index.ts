/**
 * @fileoverview Utilities barrel export
 * @description Centralized export for all utility modules
 */

// Precision coordinate system (includes calibration re-exports)
export {
  // Core precision functions
  normalizeCoordinate,
  normalizeFieldCoordinates,
  transformCoordinate,
  calculateTextBaseline,
  canvasToPdfCoordinates,
  calculatePreciseFieldPosition,
  storeDragCoordinate,
  validateCoordinateMatch,
  formatCoordinate,
  logFieldPosition,
  // Constants
  PRECISION_DECIMALS,
  PRECISION_FACTOR,
  // Types
  type PreciseFieldPosition,
  // Calibration functions (re-exported from precision-coordinates)
  calibratePreviewCoordinates,
  calibratePdfCoordinates,
  recordCalibration,
  analyzeCalibrations,
  clearCalibrations,
  exportCalibrations,
  type CalibrationData,
} from './precision-coordinates';

// Additional calibration exports
export { type CalibrationAnalysis } from './coordinate-calibration';

// Alignment debugging (development only)
export {
  AlignmentDebugger,
  alignmentDebugger,
  useAlignmentTracking,
  type FieldPosition,
  type AlignmentReport,
} from './alignment-debug';
