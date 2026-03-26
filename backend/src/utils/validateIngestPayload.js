function validateIngestPayload(payload, expectedScanType) {
  const errors = [];

  if (!payload || typeof payload !== "object") {
    errors.push("Request body must be a valid JSON object.");
    return errors;
  }

  if (!payload.source || typeof payload.source !== "string") {
    errors.push("source is required and must be a string.");
  }

  if (payload.scanType !== expectedScanType) {
    errors.push(`scanType must be ${expectedScanType}.`);
  }

  if (!payload.repo || typeof payload.repo !== "object") {
    errors.push("repo is required and must be an object.");
  } else {
    if (!payload.repo.owner || typeof payload.repo.owner !== "string") {
      errors.push("repo.owner is required and must be a string.");
    }

    if (!payload.repo.name || typeof payload.repo.name !== "string") {
      errors.push("repo.name is required and must be a string.");
    }

    if (!payload.repo.fullName || typeof payload.repo.fullName !== "string") {
      errors.push("repo.fullName is required and must be a string.");
    }
  }

  if (!payload.run || typeof payload.run !== "object") {
    errors.push("run is required and must be an object.");
  } else {
    if (!payload.run.runId || typeof payload.run.runId !== "string") {
      errors.push("run.runId is required and must be a string.");
    }

    if (!payload.run.status || typeof payload.run.status !== "string") {
      errors.push("run.status is required and must be a string.");
    }

    if (!payload.run.timestamp || typeof payload.run.timestamp !== "string") {
      errors.push("run.timestamp is required and must be a string.");
    }

    if (!payload.run.branch || typeof payload.run.branch !== "string") {
      errors.push("run.branch is required and must be a string.");
    }

    if (!payload.run.commitSha || typeof payload.run.commitSha !== "string") {
      errors.push("run.commitSha is required and must be a string.");
    }

    if (!payload.run.toolName || typeof payload.run.toolName !== "string") {
      errors.push("run.toolName is required and must be a string.");
    }

    if (!payload.run.toolVersion || typeof payload.run.toolVersion !== "string") {
      errors.push("run.toolVersion is required and must be a string.");
    }
  }

  if (!payload.summary || typeof payload.summary !== "object") {
    errors.push("summary is required and must be an object.");
  } else {
    if (typeof payload.summary.riskScore !== "number") {
      errors.push("summary.riskScore is required and must be a number.");
    }

    if (
      !payload.summary.severityCounts ||
      typeof payload.summary.severityCounts !== "object"
    ) {
      errors.push("summary.severityCounts is required and must be an object.");
    } else {
      const levels = ["critical", "high", "medium", "low"];

      for (const level of levels) {
        if (typeof payload.summary.severityCounts[level] !== "number") {
          errors.push(
            `summary.severityCounts.${level} is required and must be a number.`
          );
        }
      }
    }

    if (typeof payload.summary.totalFindings !== "number") {
      errors.push("summary.totalFindings is required and must be a number.");
    }
  }

  if (payload.topFindings !== undefined) {
    if (!Array.isArray(payload.topFindings)) {
      errors.push("topFindings must be an array.");
    } else {
      for (let i = 0; i < payload.topFindings.length; i += 1) {
        const finding = payload.topFindings[i];

        if (!finding || typeof finding !== "object") {
          errors.push(`topFindings[${i}] must be an object.`);
          continue;
        }

        if (!finding.title || typeof finding.title !== "string") {
          errors.push(`topFindings[${i}].title is required and must be a string.`);
        }

        if (!finding.severity || typeof finding.severity !== "string") {
          errors.push(`topFindings[${i}].severity is required and must be a string.`);
        }

        if (!finding.location || typeof finding.location !== "string") {
          errors.push(`topFindings[${i}].location is required and must be a string.`);
        }

        if (
          !finding.recommendation ||
          typeof finding.recommendation !== "string"
        ) {
          errors.push(
            `topFindings[${i}].recommendation is required and must be a string.`
          );
        }
      }
    }
  }

  if (!payload.report || typeof payload.report !== "object") {
    errors.push("report is required and must be an object.");
  } else {
    if (!payload.report.format || typeof payload.report.format !== "string") {
      errors.push("report.format is required and must be a string.");
    }

    if (payload.report.content === undefined) {
      errors.push("report.content is required.");
    }
  }

  return errors;
}

module.exports = {
  validateIngestPayload
};