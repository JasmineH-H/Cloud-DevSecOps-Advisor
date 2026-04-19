const SAST_SEVERITY_WEIGHTS = {
  critical: 20,
  high: 8,
  medium: 3,
  low: 1
};

const PENTEST_STATUS_WEIGHTS = {
  ERROR: 25,
  FAIL: 20,
  WARNING: 10
};

const SEVERITY_SORT_ORDER = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

module.exports = {
  SAST_SEVERITY_WEIGHTS,
  PENTEST_STATUS_WEIGHTS,
  SEVERITY_SORT_ORDER
};
