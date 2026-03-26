function buildRepoPk(owner, repo) {
  return `repo#${owner}/${repo}`;
}

function buildScanSk(timestamp, scanType, runId) {
  return `ts#${timestamp}#type#${scanType}#run#${runId}`;
}

function buildRunGsiPk(runId) {
  return `run#${runId}`;
}

function buildRunGsiSk(timestamp) {
  return `ts#${timestamp}`;
}

function buildReportS3Key(record) {
  return `reports/${record.owner}/${record.name}/${record.scanType}/${record.runId}.json`;
}

function mapRecordToDynamoItem(record) {
  const reportS3Key = buildReportS3Key(record);

  return {
    PK: buildRepoPk(record.owner, record.name),
    SK: buildScanSk(record.timestamp, record.scanType, record.runId),
    GSI1PK: buildRunGsiPk(record.runId),
    GSI1SK: buildRunGsiSk(record.timestamp),
    runId: record.runId,
    repo: record.repo,
    owner: record.owner,
    name: record.name,
    scanType: record.scanType,
    source: record.source,
    timestamp: record.timestamp,
    branch: record.branch,
    commitSha: record.commitSha,
    status: record.status,
    toolName: record.toolName,
    toolVersion: record.toolVersion,
    riskScore: record.riskScore,
    severityCounts: record.severityCounts,
    totalFindings: record.totalFindings,
    topFindings: record.topFindings,
    reportFormat: record.reportFormat,
    reportS3Key,
    ingestedAt: new Date().toISOString()
  };
}

module.exports = {
  buildRepoPk,
  buildScanSk,
  buildRunGsiPk,
  buildRunGsiSk,
  buildReportS3Key,
  mapRecordToDynamoItem
};