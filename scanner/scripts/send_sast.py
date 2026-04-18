import json
import os
import sys
import urllib.request
import urllib.error

# Load SAST result
with open("sast-result.json", "r", encoding="utf-8") as f:
    scan_data = json.load(f)


def flatten_results(results_obj):
    if isinstance(results_obj, list):
        return [item for item in results_obj if isinstance(item, dict)]

    if isinstance(results_obj, dict):
        flattened = []
        for filepath, items in results_obj.items():
            if not isinstance(items, list):
                continue
            for item in items:
                if not isinstance(item, dict):
                    continue
                finding = dict(item)
                if not finding.get("path"):
                    finding["path"] = filepath
                flattened.append(finding)
        return flattened

    return []


# Extract findings
results = flatten_results(scan_data.get("results", []))

severity_counts = {
    "critical": 0,
    "high": 0,
    "medium": 0,
    "low": 0,
}

top_findings = []
all_findings = []

# Map Semgrep severities to dashboard/backend severities
severity_map = {
    "error": "high",
    "warning": "medium",
    "info": "low",
    "critical": "critical",
    "high": "high",
    "medium": "medium",
    "low": "low",
}

for r in results:
    if not isinstance(r, dict):
        continue

    severity_raw = str(
        r.get("extra", {}).get("severity") or r.get("severity") or ""
    ).lower()
    severity = severity_map.get(severity_raw, "low")
    path = r.get("path") or r.get("file", "")
    line = r.get("start", {}).get("line") or r.get("line", 0)
    normalized_finding = {
        "title": r.get("check_id") or r.get("name") or "SAST finding",
        "severity": severity,
        "message": r.get("extra", {}).get("message") or r.get("message", ""),
        "file": path,
        "line": line,
        "location": f"{path}:{line}",
        "evidence": r.get("evidence") or r.get("extra", {}).get("lines") or "",
    }

    severity_counts[severity] += 1
    all_findings.append(normalized_finding)

    top_findings.append(
        {
            "title": normalized_finding["title"],
            "severity": severity,
            "location": normalized_finding["location"],
            "recommendation": normalized_finding["message"],
        }
    )

total_findings = len(top_findings)
scan_summary = scan_data.get("summary", {})
summary = {
    "critical": int(scan_summary.get("critical", severity_counts["critical"])),
    "high": int(scan_summary.get("high", severity_counts["high"])),
    "medium": int(scan_summary.get("medium", severity_counts["medium"])),
    "low": int(scan_summary.get("low", severity_counts["low"])),
}

payload = {
    "repo": os.environ.get("GITHUB_REPOSITORY", "unknown"),
    "runId": os.environ.get("GITHUB_RUN_ID", "unknown"),
    "commitSha": os.environ.get("GITHUB_SHA", "unknown"),
    "branch": os.environ.get("GITHUB_REF_NAME", "unknown"),
    "triggeredBy": os.environ.get("GITHUB_ACTOR", "unknown"),
    "scanType": "sast",
    "reportS3Key": os.environ.get("S3_KEY", ""),
    "summary": summary,
    "result": {
        "severityCounts": summary,
        "totalFindings": total_findings,
        "topFindings": top_findings[:5],
        "allFindings": all_findings,
    },
}

token = os.environ["INGEST_TOKEN_SAST"].strip()
base_url = os.environ["BACKEND_API_URL"].strip().rstrip("/")
if not base_url.startswith(("http://", "https://")):
    base_url = f"https://{base_url}"
url = f"{base_url}/ingest/sast"

body = json.dumps(payload).encode("utf-8")

req = urllib.request.Request(
    url,
    data=body,
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        print(f"API ingest succeeded: HTTP {resp.status}")
except urllib.error.HTTPError as e:
    print(f"API ingest failed: HTTP {e.code} - {e.read().decode()}")
    sys.exit(1)
except urllib.error.URLError as e:
    print(f"WARNING: Could not reach backend API ({e.reason}). Skipping ingest.")
