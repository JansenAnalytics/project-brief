# project-brief

A CLI tool for creating and managing structured project briefs (`BRIEF.md`) alongside project code.

## Usage

```bash
node brief.cjs new --project my-project --goal "..." --status "Active"
node brief.cjs list
node brief.cjs view my-project
node brief.cjs update my-project --status "Complete"
node brief.cjs status
```

Briefs live at `~/projects/<project>/BRIEF.md`.
