import json
import sys

# Load the SAST scan output produced in the workflow
with open("sast-result.json", "r", encoding="utf-8") as f:
    data = json.load(f)

summary = data.get("summary", {})
high = summary.get("high", 0)
medium = summary.get("medium", 0)
low = summary.get("low", 0)

print(f"HIGH: {high}, MEDIUM: {medium}, LOW: {low}")

if high > 0 or medium > 0:
    print("SAST FAILED: High or Medium vulnerabilities detected")
    sys.exit(1)
else:
    print("SAST PASSED: Only low or no vulnerabilities")