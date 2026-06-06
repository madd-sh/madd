# MADD FAQ

Short answers to the questions people ask first. Each entry is also a good seed for a Discussion thread.

## What is MADD in one sentence?

MADD (Multi-Agent Driven Development) is a development methodology for the AI era: multiple specialized agents collaborate under one non-negotiable rule, **no agent validates its own work**, so that what gets built actually matches what was intended.

## Everyone does "multi-agent" now. What is actually different about MADD?

The difference is **systematic adversarial review**. In most multi-agent setups the same agent (or family of agents) writes the code and then judges it. MADD forbids that: a Maker implements, an independent Breaker tries to break it, and a Witness documents what truly exists in the code. The agent that produced something is never the source of truth on its quality. That is also why MADD can be read as **Multi-Adversarial** Driven Development, same acronym, sharper method.

## Do I need six different AI models to use MADD?

No. MADD defines six **roles** (Conductor, Architect, Maker, CI, Breaker, Witness), not six products. You can fill them with two or three models, or even one model run in clearly separated sessions, as long as the role that validates is not the role that produced. Separation of concerns is the point; the number of vendors is not.

## Does MADD work for a solo developer?

Yes. Solo is one of the primary cases. You play the orchestrator and use 2-3 agents for the separated roles. The "Solo + AI" quickstart on [madd.sh](https://madd.sh) walks through it.

## How do I start?

The fastest path is the CLI, which scaffolds the MADD stack (agents, hooks, skills, contract files) into an existing project without touching your code:

```sh
npx @madd-sh/madd init
```

Then read the methodology at [madd.sh](https://madd.sh) and run your first cycle: formalize an intention, implement against an executable contract, audit with an independent agent, record a retro-spec.

## How is MADD different from BMAD or Spec-Kit?

They share the "specification first" philosophy. MADD differs on two axes: **validation** (independent agent audit, never self-validation) and **memory** (a retro-specification produced by an independent Witness that documents what the code really is, not what the author claims). See the comparison table on [madd.sh](https://madd.sh).

## Is MADD tied to a specific language or stack?

No. The method is stack-agnostic. The domain skills (database, API, frontend, security, infrastructure) carry the stack-specific knowledge and are meant to be adapted to your project.

---

## Glossary

**Conductor** - orchestrates a cycle: detects domains, dispatches Maker/Breaker pairs, manages iteration.

**Architect** - formalizes intention into an Intention Document and an Executable Contract.

**Maker** - implements against the contract, specialized by domain.

**CI** - the automated quality gate (build, lint, type-check, tests) between Maker and Breaker.

**Breaker** - independently audits the Maker's output, specialized by domain. Read-only; cannot modify code.

**Witness** - independently documents what the code actually contains, producing the retro-specification.

**Intention Document** - the versioned artifact that captures *why* and *what* before any *how*.

**Executable Contract** - validation criteria that can be checked automatically. If you cannot write a test for a requirement, the requirement is underspecified.

**Fraction** - a small, independently deliverable unit of work (2-6 related tasks) that completes its own Maker - CI - Breaker cycle.

**Retro-Specification** - objective documentation of what was actually implemented, written by the independent Witness. It becomes the starting point and memory of the next cycle.
