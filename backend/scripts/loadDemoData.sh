#!/bin/bash

echo "Loading demo data..."

BASE_URL="http://localhost:3000"

########################################
# Repo A older SAST
########################################

curl -X POST $BASE_URL/ingest/sast \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-sast-token-123" \
  -d '{
    "source": "github-actions",
    "scanType": "SAST",
    "repo": {
      "owner": "my-org",
      "name": "my-repo",
      "fullName": "my-org/my-repo"
    },
    "run": {
      "runId": "gha-20260307-001",
      "status": "SUCCESS",
      "timestamp": "2026-03-07T18:10:00Z",
      "branch": "main",
      "commitSha": "old111aaa222",
      "toolName": "semgrep",
      "toolVersion": "1.94.0"
    },
    "summary": {
      "riskScore": 58,
      "severityCounts": {
        "critical": 0,
        "high": 2,
        "medium": 4,
        "low": 3
      },
      "totalFindings": 9
    },
    "topFindings": [
      {
        "title": "Weak password policy check",
        "severity": "high",
        "location": "src/auth/password.js",
        "recommendation": "Enforce stronger password validation rules."
      }
    ],
    "report": {
      "format": "json",
      "content": { "findings": [] }
    }
  }'

########################################
# Repo A latest SAST
########################################

curl -X POST $BASE_URL/ingest/sast \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-sast-token-123" \
  -d '{
    "source": "github-actions",
    "scanType": "SAST",
    "repo": {
      "owner": "my-org",
      "name": "my-repo",
      "fullName": "my-org/my-repo"
    },
    "run": {
      "runId": "gha-20260308-001",
      "status": "SUCCESS",
      "timestamp": "2026-03-08T20:30:00Z",
      "branch": "main",
      "commitSha": "abc123def456",
      "toolName": "semgrep",
      "toolVersion": "1.95.0"
    },
    "summary": {
      "riskScore": 72,
      "severityCounts": {
        "critical": 1,
        "high": 2,
        "medium": 5,
        "low": 4
      },
      "totalFindings": 12
    },
    "topFindings": [
      {
        "title": "Hardcoded secret in config file",
        "severity": "critical",
        "location": "src/config.js",
        "recommendation": "Remove hardcoded credentials."
      }
    ],
    "report": {
      "format": "json",
      "content": { "findings": [] }
    }
  }'

########################################
# Repo A Pentest
########################################

curl -X POST $BASE_URL/ingest/pentest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-pentest-token-456" \
  -d '{
    "source": "ecs-pentest-task",
    "scanType": "PENTEST",
    "repo": {
      "owner": "my-org",
      "name": "my-repo",
      "fullName": "my-org/my-repo"
    },
    "run": {
      "runId": "pentest-20260308-001",
      "status": "SUCCESS",
      "timestamp": "2026-03-08T21:00:00Z",
      "branch": "main",
      "commitSha": "abc123def456",
      "toolName": "owasp-zap",
      "toolVersion": "2.16.1"
    },
    "summary": {
      "riskScore": 63,
      "severityCounts": {
        "critical": 0,
        "high": 1,
        "medium": 3,
        "low": 6
      },
      "totalFindings": 10
    },
    "topFindings": [
      {
        "title": "Missing security headers",
        "severity": "high",
        "location": "/login",
        "recommendation": "Add security headers."
      }
    ],
    "report": {
      "format": "json",
      "content": { "alerts": [] }
    }
  }'

########################################
# Repo B SAST
########################################

curl -X POST $BASE_URL/ingest/sast \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-sast-token-123" \
  -d '{
    "source": "github-actions",
    "scanType": "SAST",
    "repo": {
      "owner": "my-org",
      "name": "another-repo",
      "fullName": "my-org/another-repo"
    },
    "run": {
      "runId": "gha-20260308-101",
      "status": "SUCCESS",
      "timestamp": "2026-03-08T19:00:00Z",
      "branch": "develop",
      "commitSha": "xyz789ghi000",
      "toolName": "semgrep",
      "toolVersion": "1.95.0"
    },
    "summary": {
      "riskScore": 49,
      "severityCounts": {
        "critical": 0,
        "high": 1,
        "medium": 2,
        "low": 5
      },
      "totalFindings": 8
    },
    "topFindings": [
      {
        "title": "Potential insecure deserialization",
        "severity": "high",
        "location": "src/utils/serializer.js",
        "recommendation": "Validate serialized data."
      }
    ],
    "report": {
      "format": "json",
      "content": { "findings": [] }
    }
  }'

echo "Demo data loaded!"