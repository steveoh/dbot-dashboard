# Dependabot PR Dashboard

An interactive dashboard that groups open Dependabot pull requests by repository for the AGRC organization.

## Features

- 🎨 Modern UI with Tailwind CSS
- 📊 Groups PRs by repository with counts
- 🔍 Expandable cards to view PR details
- 📱 Responsive design
- ⌨️ Keyboard navigation (ESC to close all cards)

## Installation

```bash
npm install
```

## Usage

Generate the dashboard:

```bash
npm run build
```

Generate and open in browser:

```bash
npm run serve
```

This will:
1. Fetch all open Dependabot PRs from the AGRC organization
2. Generate an interactive HTML dashboard (`dependabot-prs.html`)
3. Open it in your default browser (with `serve` command)

## How it works

The script queries GitHub's API for:
- Organization: `agrc`
- Author: `dependabot[bot]`
- Status: Open pull requests
- Excludes: Archived repositories

Results are grouped by repository and displayed in an interactive grid layout using Tailwind CSS via CDN.
