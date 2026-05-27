# Contributing

Thanks for your interest in improving this template!

## Scope

This repository is a **template** for building plugin marketplaces. PRs that
fit the scope:

- Bug fixes in the build tool, transpilers, or schemas
- New transpile targets (e.g. additional editors that support MCP plugins)
- Documentation improvements
- Generalizations of the schema or build flow that benefit all consumers

PRs that are **out of scope** here (but welcome in your own fork):

- Adding new plugins beyond the single demonstrator
- Plugins tied to a specific organization, MCP server, or workflow

The included sample plugin (`plugins/web/`) is intentionally minimal — its job
is to exercise every feature of the format. Please keep it that way.

## Development

```bash
npm install
npm run validate          # schema-check without writing
npm run build             # full build
npm run build -- --plugin=web      # iterate on the sample plugin only
npm run clean             # wipe dist/
```

## Pull requests

1. Fork and branch from `main`.
2. Run `npm run build` and verify the diff under `dist/` makes sense.
3. Commit `dist/` changes alongside source changes — the marketplace files
   are checked in so tools can resolve plugin URLs without a build step.
4. Open a PR with a clear description of the motivation and the change.

## Adding a transpile target

See [Adding a transpile target](AGENTS.md#adding-a-transpile-target) in
`AGENTS.md` for the contract a new target module must implement.
