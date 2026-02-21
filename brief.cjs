#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ── Config ───────────────────────────────────────────────────────────────────
const PROJECTS_DIR = path.join(os.homedir(), 'projects');

const STATUS_EMOJI = {
  active:    '🟢',
  blocked:   '🟡',
  abandoned: '🔴',
  complete:  '✅',
  planning:  '🔵',
};

function getEmoji(status) {
  const key = (status || '').toLowerCase().trim();
  return STATUS_EMOJI[key] || '🔵';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function briefPath(project) {
  return path.join(PROJECTS_DIR, project, 'BRIEF.md');
}

// ── Template ─────────────────────────────────────────────────────────────────
function buildBrief({ project, goal, success, constraints, stack, status, next }) {
  const emoji = getEmoji(status);
  const displayName = project
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const successItems = (success || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => `- [ ] ${s}`)
    .join('\n');

  const constraintItems = (constraints || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => `- ${s}`)
    .join('\n');

  const stackItems = (stack || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => `- ${s}`)
    .join('\n');

  const nextItems = (next || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => `- [ ] ${s}`)
    .join('\n');

  const dt = today();

  return `# Project Brief: ${displayName}

**Status:** ${emoji} ${status}
**Created:** ${dt}
**Last Updated:** ${dt}
**Owner:** Aksel / Kite

---

## Goal
${goal || ''}

## Success Criteria
${successItems}

## Constraints
${constraintItems}

## Tech Stack
${stackItems}

## Current Status
${emoji} **${status}.**

## Blockers
None.

## Next Actions
${nextItems}

## History
- ${dt}: Brief created.

---
*Managed by Kite project-brief. Update with: node ~/projects/project-brief/brief.cjs update ${project}*
`;
}

// ── Commands ─────────────────────────────────────────────────────────────────

function cmdNew(args) {
  const flags = parseFlags(args);
  const project = flags['project'];
  if (!project) {
    console.error('Error: --project <name> is required');
    process.exit(1);
  }

  const dir = path.join(PROJECTS_DIR, project);
  fs.mkdirSync(dir, { recursive: true });

  const content = buildBrief({
    project,
    goal:        flags['goal'] || '',
    success:     flags['success'] || '',
    constraints: flags['constraints'] || '',
    stack:       flags['stack'] || '',
    status:      flags['status'] || 'Planning',
    next:        flags['next'] || '',
  });

  const bp = briefPath(project);
  fs.writeFileSync(bp, content, 'utf8');
  console.log(`Created brief: ${bp}`);
}

function cmdList() {
  const dirs = fs.readdirSync(PROJECTS_DIR).filter(d => {
    const bp = briefPath(d);
    try { return fs.statSync(bp).isFile(); } catch { return false; }
  });

  if (dirs.length === 0) {
    console.log('No project briefs found.');
    return;
  }

  console.log('\nProject Briefs:');
  for (const d of dirs) {
    const content = fs.readFileSync(briefPath(d), 'utf8');
    const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/);
    const updatedMatch = content.match(/\*\*Last Updated:\*\*\s*(.+)/);
    const goalMatch = content.match(/## Goal\n(.+)/);

    const statusText = statusMatch ? statusMatch[1].trim() : '?';
    const updated = updatedMatch ? updatedMatch[1].trim() : '?';
    const goal = goalMatch ? goalMatch[1].trim() : '';
    const goalShort = goal.length > 40 ? goal.slice(0, 37) + '...' : goal;

    console.log(`  ${d.padEnd(20)} ${statusText.padEnd(16)} Updated ${updated}  ${goalShort}`);
  }
  console.log('');
}

function cmdView(args) {
  const project = args[0];
  if (!project) {
    console.error('Usage: brief.cjs view <project>');
    process.exit(1);
  }
  const bp = briefPath(project);
  if (!fs.existsSync(bp)) {
    console.error(`No brief found for project: ${project}`);
    process.exit(1);
  }
  console.log(fs.readFileSync(bp, 'utf8'));
}

function cmdStatus() {
  const dirs = fs.readdirSync(PROJECTS_DIR).filter(d => {
    const bp = briefPath(d);
    try { return fs.statSync(bp).isFile(); } catch { return false; }
  });

  const groups = {};
  for (const d of dirs) {
    const content = fs.readFileSync(briefPath(d), 'utf8');
    const statusMatch = content.match(/\*\*Status:\*\*\s*(.+)/);
    const statusText = statusMatch ? statusMatch[1].trim() : '? Unknown';
    // Extract the text part (after emoji if present)
    const statusLabel = statusText.replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F000}-\u{1F0FF} ]+/gu, '').trim();
    const emoji = statusText.replace(statusLabel, '').trim();
    const key = `${emoji} ${statusLabel}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(d);
  }

  const total = dirs.length;
  console.log(`\nProject Status Overview (${total} project${total !== 1 ? 's' : ''})`);
  console.log('───────────────────────────────────────');
  for (const [label, projects] of Object.entries(groups)) {
    const count = projects.length;
    console.log(`${label} (${count}):  ${projects.join(', ')}`);
  }
  console.log('');
}

function cmdUpdate(args) {
  const project = args[0];
  if (!project) {
    console.error('Usage: brief.cjs update <project> [flags]');
    process.exit(1);
  }

  const bp = briefPath(project);
  if (!fs.existsSync(bp)) {
    console.error(`No brief found for project: ${project}`);
    process.exit(1);
  }

  const flags = parseFlags(args.slice(1));
  let content = fs.readFileSync(bp, 'utf8');
  let changed = false;

  // --status: update Status line
  if (flags['status'] !== undefined) {
    const emoji = getEmoji(flags['status']);
    const newStatus = `${emoji} ${flags['status']}`;
    content = content.replace(/(\*\*Status:\*\*\s*)(.+)/, `$1${newStatus}`);
    changed = true;
  }

  // --current-status: replace Current Status section body
  if (flags['current-status'] !== undefined) {
    const statusEmoji = (() => {
      const m = content.match(/\*\*Status:\*\*\s*([\S]+)/);
      return m ? m[1] : '🔵';
    })();
    // Find the Current Status section and replace its body up to the next ##
    content = content.replace(
      /(## Current Status\n)([\s\S]*?)(?=\n## )/,
      (_, header, _body) => {
        return `${header}${statusEmoji} **${flags['current-status']}**\n`;
      }
    );
    changed = true;
  }

  // --add-next: append to Next Actions
  if (flags['add-next'] !== undefined) {
    const item = `- [ ] ${flags['add-next']}`;
    // Insert before the next ## heading or before --- footer
    content = content.replace(
      /(## Next Actions\n)([\s\S]*?)(?=\n## |\n---)/,
      (_, header, body) => {
        const trimmed = body.trimEnd();
        return `${header}${trimmed}\n${item}\n`;
      }
    );
    changed = true;
  }

  // --check: mark success criteria as done
  if (flags['check'] !== undefined) {
    const needle = flags['check'];
    // Find the line in Success Criteria that contains this text
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(## Success Criteria[\\s\\S]*?)- \\[ \\] (${escaped})`, 'm');
    if (re.test(content)) {
      content = content.replace(re, (_, before, text) => `${before}- [x] ${text}`);
      changed = true;
    } else {
      console.warn(`Warning: could not find unchecked item matching: "${needle}"`);
    }
  }

  // --add-history: append to History section
  if (flags['add-history'] !== undefined) {
    const item = `- ${flags['add-history']}`;
    content = content.replace(
      /(## History\n)([\s\S]*?)(?=\n---)/,
      (_, header, body) => {
        const trimmed = body.trimEnd();
        return `${header}${trimmed}\n${item}\n`;
      }
    );
    changed = true;
  }

  // --add-blocker: append to Blockers section
  if (flags['add-blocker'] !== undefined) {
    const item = `- ${flags['add-blocker']}`;
    content = content.replace(
      /(## Blockers\n)([\s\S]*?)(?=\n## )/,
      (_, header, body) => {
        let trimmed = body.trim();
        // Remove "None." placeholder if present
        if (trimmed === 'None.') trimmed = '';
        return `${header}${trimmed ? trimmed + '\n' : ''}${item}\n`;
      }
    );
    changed = true;
  }

  // --resolve-blocker: remove or strike a blocker
  if (flags['resolve-blocker'] !== undefined) {
    const needle = flags['resolve-blocker'];
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`- ${escaped}\\n?`, 'g');
    if (re.test(content)) {
      content = content.replace(re, '');
      // If Blockers section is now empty, put "None."
      content = content.replace(
        /(## Blockers\n)([ \t]*\n)(## )/,
        '$1None.\n\n$3'
      );
      changed = true;
    } else {
      console.warn(`Warning: could not find blocker matching: "${needle}"`);
    }
  }

  if (!changed) {
    console.log('No changes specified.');
    return;
  }

  // Always update Last Updated
  content = content.replace(/(\*\*Last Updated:\*\*\s*)(.+)/, `$1${today()}`);

  fs.writeFileSync(bp, content, 'utf8');
  console.log(`Updated brief: ${bp}`);
}

// ── Flag parser ───────────────────────────────────────────────────────────────
function parseFlags(args) {
  const flags = {};
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return flags;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const [,, cmd, ...rest] = process.argv;

switch (cmd) {
  case 'new':    cmdNew(rest); break;
  case 'list':   cmdList(); break;
  case 'view':   cmdView(rest); break;
  case 'status': cmdStatus(); break;
  case 'update': cmdUpdate(rest); break;
  default:
    console.log(`Usage: brief.cjs <command> [options]

Commands:
  new      Create a new project brief
  list     List all project briefs
  view     View a project brief
  update   Update a project brief
  status   Show compact status overview

Examples:
  node brief.cjs new --project my-project --goal "..." --status "Active"
  node brief.cjs list
  node brief.cjs view my-project
  node brief.cjs update my-project --status "Complete"
  node brief.cjs status
`);
    break;
}
