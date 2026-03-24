const scanRecords = [];

function addScanRecord(record) {
  scanRecords.push(record);
  return record;
}

function getAllScanRecords() {
  return scanRecords;
}

module.exports = {
  addScanRecord,
  getAllScanRecords
};