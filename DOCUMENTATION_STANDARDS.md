# PRISM-Gateway Documentation Standards

**Version:** 1.0.0
**Last Updated:** 2026-02-07
**Status:** Active

---

## Purpose

This document defines the standards, conventions, and best practices for all documentation in the PRISM-Gateway project. Following these standards ensures consistency, maintainability, and accessibility across all project documentation.

---

## Table of Contents

1. [Documentation Structure](#documentation-structure)
2. [File Naming Conventions](#file-naming-conventions)
3. [Document Format Standards](#document-format-standards)
4. [Version Control](#version-control)
5. [Maintenance Guidelines](#maintenance-guidelines)
6. [Quality Checklist](#quality-checklist)

---

## Documentation Structure

### Root-Level Documents

Documents at the project root serve as entry points and high-level overviews:

| Document | Purpose | Update Frequency |
|----------|---------|------------------|
| `README.md` | Project overview and quick start | Every major release |
| `CLAUDE.md` | AI assistant context | Every phase/week |
| `INDEX.md` | Documentation index | Monthly or on structure changes |
| `CHANGELOG.md` | Version history | Every release |
| `PROJECT_STATE.md` | Current project status | Every milestone |

### Directory Organization

```
prism-gateway-docs/
├── api/                    # API reference documentation
│   ├── README.md           # API overview
│   └── [Component].md      # Individual API docs
├── docs/                   # User and developer documentation
│   ├── users/             # User-facing documentation
│   ├── developers/        # Developer documentation
│   ├── contributors/      # Contributor guidelines
│   ├── operators/         # Operations documentation
│   └── archive/           # Archived/historical docs
│       ├── old-migrations/           # Archived migration guides
│       └── experimental-frameworks/  # Archived experiments
├── reports/                # Project reports
│   ├── milestone/         # Phase and week completion reports
│   ├── task/             # Task completion reports
│   ├── quality/          # Quality assurance reports
│   ├── architecture/     # Architecture design documents
│   ├── project/          # Project management reports
│   ├── testing/          # Testing reports
│   └── archive/          # Archived reports
└── prism-gateway/         # Main project (separate README)
    └── docs/             # Project-specific technical docs
```

### Document Categories

#### 1. User Documentation (`docs/users/`)
- Quick start guides
- Installation instructions
- Configuration guides
- User guides
- FAQ
- Troubleshooting

#### 2. Developer Documentation (`docs/developers/`)
- Getting started (development)
- Architecture overview
- API reference
- Contributing guide
- Testing guide
- Coding standards

#### 3. Contributor Documentation (`docs/contributors/`)
- Workflow processes
- Code review guidelines
- Project standards

#### 4. Operator Documentation (`docs/operators/`)
- Deployment guides
- Monitoring setup
- Troubleshooting procedures

#### 5. Reports (`reports/`)
Organized by type:
- `milestone/`: Phase and week completion reports
- `task/`: Individual task reports
- `quality/`: Test, verification, and audit reports
- `architecture/`: Design and architecture documents
- `project/`: Progress, roadmap, and planning docs

---

## File Naming Conventions

### General Rules

1. **Use UPPER_SNAKE_CASE for project-level documents:**
   - `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`
   - `PROJECT_STATE.md`, `MIGRATION_GUIDE.md`

2. **Use kebab-case for user/developer docs:**
   - `quick-start.md`, `api-reference.md`
   - `code-review.md`, `deployment.md`

3. **Use PascalCase for API documentation:**
   - `GatewayGuard.md`, `MemoryStore.md`
   - `PatternMatcher.md`, `TrapDetector.md`

4. **Use descriptive report names:**
   - Format: `[TYPE]_[SCOPE]_[DESCRIPTION].md`
   - Examples:
     - `PHASE3_WEEK1_COMPLETION_REPORT.md`
     - `VERIFICATION_REPORT_Task63-65.md`
     - `QUALITY_DASHBOARD.md`

### Version-Specific Documents

Include version in filename for version-specific docs:
- `MIGRATION_GUIDE_V3.md` (v2.x → v3.0 migration)
- `RELEASE_NOTES_V3.0.md` (v3.0.0 release notes)
- `DOCUMENT_REORGANIZATION_REPORT_V2.md`

---

## Document Format Standards

### Markdown Structure

#### 1. Front Matter

Every document should start with a front matter section:

```markdown
# Document Title

**Version:** 1.0.0
**Last Updated:** 2026-02-07
**Status:** Active | Draft | Archived
**Author:** PRISM-Gateway Team

---
```

#### 2. Table of Contents

For documents longer than 100 lines, include a table of contents:

```markdown
## Table of Contents

1. [Section 1](#section-1)
2. [Section 2](#section-2)
   - [Subsection 2.1](#subsection-21)
3. [References](#references)
```

#### 3. Headings Hierarchy

- `# H1` - Document title (use only once at top)
- `## H2` - Major sections
- `### H3` - Subsections
- `#### H4` - Sub-subsections (use sparingly)

#### 4. Code Blocks

Always specify language for syntax highlighting:

````markdown
```typescript
function example(): void {
  console.log('Hello, world!');
}
```

```bash
npm install
npm test
```
````

#### 5. Tables

Use tables for structured data:

```markdown
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value 1  | Value 2  | Value 3  |
| Value 4  | Value 5  | Value 6  |
```

#### 6. Links

- **Internal links:** Use relative paths
  ```markdown
  [Migration Guide](./docs/MIGRATION_GUIDE_V3.md)
  [API Reference](../api/README.md)
  ```

- **External links:** Use full URLs
  ```markdown
  [OWASP Top 10](https://owasp.org/www-project-top-ten/)
  ```

#### 7. Status Indicators

Use emoji for quick visual status:
- ✅ Completed
- 🚧 In Progress
- ⏳ Planned
- 🔜 Coming Soon
- 🎉 Released
- ⭐ Featured/Important
- ⚠️ Warning
- 🔴 Blocked

---

## Version Control

### Version Number Format

Follow [Semantic Versioning](https://semver.org/) for documentation versions:
- **MAJOR.MINOR.PATCH** (e.g., 3.0.0)
- MAJOR: Breaking changes, major reorganization
- MINOR: New features, significant additions
- PATCH: Bug fixes, typo corrections, minor updates

### Version History

Maintain version history at the bottom of important documents:

```markdown
---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 3.0.0 | 2026-02-07 | Complete rewrite for Phase 3 release |
| 2.1.0 | 2026-02-05 | Added Phase 3 planning |
| 2.0.0 | 2026-02-04 | Documentation reorganization |
```

### Update Frequency

| Document Type | Update Trigger |
|---------------|----------------|
| README.md | Every major version release |
| CLAUDE.md | Every phase/week completion |
| INDEX.md | Monthly or on structure changes |
| CHANGELOG.md | Every release (major, minor, patch) |
| PROJECT_STATE.md | Every milestone or monthly |
| API docs | When API changes |
| User guides | When features change |
| Reports | Upon completion of work |

---

## Maintenance Guidelines

### Regular Review Schedule

| Task | Frequency | Responsible |
|------|-----------|-------------|
| Fix broken links | Monthly | Maintainers |
| Update version numbers | Every release | Release Manager |
| Archive outdated docs | Quarterly | Documentation Lead |
| Review for accuracy | Quarterly | Subject Matter Experts |
| Update screenshots | When UI changes | UI Team |

### Archiving Policy

Documents should be archived when:
1. They describe deprecated features
2. They reference old versions (>2 major versions old)
3. They document experimental/abandoned features
4. They're superseded by newer documents

**Archive Process:**
1. Move to appropriate `archive/` subdirectory
2. Add "Archived" status badge at the top
3. Include reason and date of archival
4. Create README.md in archive directory explaining contents
5. Update references in active documents

**Example Archive Header:**
```markdown
> ⚠️ **ARCHIVED** - This document describes Phase 1→2 migration.
> For current migration (v2.x→v3.0), see [MIGRATION_GUIDE_V3.md](../../prism-gateway/docs/MIGRATION_GUIDE_V3.md)
>
> **Archived:** 2026-02-07
> **Reason:** Superseded by v3.0 migration guide
```

### Dead Link Prevention

- Use relative paths for internal links
- Run link checker monthly
- Update links immediately when moving files
- Document moved files in commit messages

---

## Quality Checklist

### Before Publishing

Every document must pass this checklist:

#### Content Quality
- [ ] Accurate and up-to-date information
- [ ] Clear and concise language
- [ ] Proper grammar and spelling
- [ ] Logical flow and organization
- [ ] Examples and code samples tested

#### Format and Structure
- [ ] Front matter included (title, version, date, status)
- [ ] Table of contents for long documents (>100 lines)
- [ ] Consistent heading hierarchy
- [ ] Code blocks have language specified
- [ ] Tables are properly formatted
- [ ] Lists use consistent formatting

#### Technical Accuracy
- [ ] Commands are tested and work
- [ ] Code examples compile/run
- [ ] Links are valid (internal and external)
- [ ] Version numbers are correct
- [ ] API signatures match implementation

#### Accessibility
- [ ] Alt text for images
- [ ] Descriptive link text (not "click here")
- [ ] Clear section headings
- [ ] Consistent terminology
- [ ] Acronyms defined on first use

#### Metadata
- [ ] File named according to conventions
- [ ] Placed in correct directory
- [ ] Referenced in INDEX.md (if appropriate)
- [ ] Cross-references updated
- [ ] Git commit message describes changes

### Review Process

1. **Self-Review:** Author checks quality checklist
2. **Peer Review:** Another team member reviews for clarity
3. **Technical Review:** Subject matter expert validates accuracy
4. **Approval:** Documentation lead approves for publication

---

## Writing Style Guide

### Tone and Voice

- **Be clear and direct:** Avoid unnecessary complexity
- **Be helpful:** Anticipate user questions
- **Be concise:** Respect the reader's time
- **Be consistent:** Use established terminology
- **Be inclusive:** Use gender-neutral language

### Technical Writing Best Practices

1. **Use active voice:** "The system processes requests" not "Requests are processed by the system"

2. **Be specific:** "Backup takes <30 seconds" not "Backup is fast"

3. **Show, don't just tell:** Include examples, diagrams, code samples

4. **Define acronyms:** "JWT (JSON Web Token)" on first use

5. **Use lists:** Break up dense text with bullet points or numbered lists

6. **Provide context:** Explain why, not just how

### Common Terms

Maintain consistent terminology throughout:

| Use This | Not This |
|----------|----------|
| GitHub | Github, github |
| TypeScript | Typescript, typescript |
| v3.0.0 | 3.0.0, version 3.0.0 |
| API | api, Api |
| JSON | Json, json |
| CLI | cli, Cli |
| README | readme, Readme |

---

## Templates

### Document Templates

Located in `.github/ISSUE_TEMPLATE/` and `docs/templates/`:

- `COMPLETION_REPORT_TEMPLATE.md` - For task/phase completion
- `DESIGN_DOCUMENT_TEMPLATE.md` - For architecture designs
- `API_DOCUMENTATION_TEMPLATE.md` - For API references
- `USER_GUIDE_TEMPLATE.md` - For user guides

### Report Template Example

```markdown
# [Type] [Scope] Report

**Date:** YYYY-MM-DD
**Author:** Name
**Status:** Draft | Final
**Version:** X.Y.Z

---

## Executive Summary

[2-3 sentence overview]

## Objectives

- Objective 1
- Objective 2

## Results

[Detailed results with metrics]

## Challenges

[Issues encountered and resolutions]

## Next Steps

- [ ] Action item 1
- [ ] Action item 2

---

**Report Version:** X.Y.Z
**Generated:** YYYY-MM-DD
```

---

## Tools and Automation

### Recommended Tools

1. **Markdown Linters:**
   - `markdownlint` for style consistency
   - `markdown-link-check` for validating links

2. **Documentation Generators:**
   - `TypeDoc` for API documentation
   - `docsify` for documentation sites

3. **Spell Checkers:**
   - VS Code spell checker extensions
   - `cspell` for CI/CD

### CI/CD Integration

Recommended GitHub Actions:
- Link checking on PR
- Spell checking on PR
- Markdown linting on commit
- Auto-generate API docs on release

---

## Compliance

### Accessibility (WCAG 2.1)

- Provide alt text for all images
- Use semantic HTML in rendered docs
- Maintain sufficient color contrast
- Support keyboard navigation

### Licensing

All documentation is licensed under:
- **Code License:** MIT License
- **Documentation License:** CC BY 4.0

Include license reference in footer:
```markdown
---

*Licensed under MIT License. Documentation licensed under CC BY 4.0.*
```

---

## Contact and Support

### Questions About Standards

- Open an issue: [GitHub Issues](https://github.com/starlink-awaken/prism-gateway-docs/issues)
- Contact: See [CONTACT.md](./CONTACT.md)

### Proposing Changes

To propose changes to these standards:
1. Open a discussion issue
2. Gather feedback from maintainers
3. Submit a PR with proposed changes
4. Require approval from 2+ maintainers

---

## References

- [Google Developer Documentation Style Guide](https://developers.google.com/style)
- [Microsoft Writing Style Guide](https://docs.microsoft.com/en-us/style-guide/)
- [Write the Docs](https://www.writethedocs.org/guide/)
- [Semantic Versioning](https://semver.org/)
- [Markdown Guide](https://www.markdownguide.org/)

---

**Document Version:** 1.0.0
**Effective Date:** 2026-02-07
**Next Review:** 2026-03-07
**Maintained By:** PRISM-Gateway Documentation Team

*PAI - Personal AI Infrastructure*
*Version: 2.5*
