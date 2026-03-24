# Backend API
This service ingests SAST and pentest scan results, stores scan metadata in DynamoDB, uploads full reports to S3, and provides APIs for the dashboard.

## Run locally

```bash
npm install
npm run dev

Current endpoints

GET /health

