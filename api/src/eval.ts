// Reads every sentence in evals/cases.json with the real model and reports
// what it understood differently from what the case expects. Each run costs
// money (a few cents), so it is run by hand, on the server, where the key is:
//
//   cd /opt/fahrplan-ulm/api && sudo bash -c 'set -a; . /etc/fahrplan-ulm/api.env; node dist/eval.js'

import { readFileSync } from 'node:fs'
import { claudeReader, type Intent } from './ask.js'
import { loadConfig } from './config.js'
import { stopDirectory } from './stops.js'
import { getJson } from './upstream.js'

// A place is written "here", "home", "work", "none", "stop:<name as listed>"
// or "text:<part of what was said>"; a time "now", "in <minutes> <role>" or
// "at <HH:MM> [day] <role>".
type Case = { say: string; request?: 'other'; from?: string; to?: string; time?: string }

const AT_ONCE = 4

const plain = (text: string) =>
  text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[^a-z0-9]/g, '')

const placeProblem = (slot: string, expected: string, got: Intent['origin'] | null) => {
  const [kind, value] = expected.includes(':') ? [expected.slice(0, expected.indexOf(':')), expected.slice(expected.indexOf(':') + 1)] : [expected, '']
  const shown = got ? `${got.kind}${got.stop ? ` stop "${got.stop}"` : ''}${got.text ? ` text "${got.text}"` : ''}` : 'nothing'
  // An unsaid start counts as here either way.
  const gotKind = slot === 'from' && got?.kind === 'none' ? 'here' : got?.kind
  const right =
    kind === 'stop' ? gotKind === 'named' && plain(got?.stop ?? '') === plain(value) : kind === 'text' ? gotKind === 'named' && !got?.stop && plain(got?.text ?? '').includes(plain(value)) : gotKind === kind
  return right ? [] : [`${slot}: expected ${expected}, got ${shown}`]
}

const timeProblem = (expected: string, got: Intent['time'] | null) => {
  const shown = got ? [got.kind, got.inMinutes, got.clock, got.day, got.role].filter((part) => part !== null).join(' ') : 'nothing'
  const [kind, ...rest] = expected.split(' ')
  const role = rest.at(-1)
  const right =
    kind === 'now'
      ? got?.kind === 'now'
      : kind === 'in'
        ? got?.kind === 'in' && got.inMinutes === Number(rest[0]) && got.role === role
        : got?.kind === 'at' && got.clock?.padStart(5, '0') === rest[0] && (got.day ?? null) === (rest.length === 3 ? rest[1] : null) && got.role === role
  return right ? [] : [`time: expected "${expected}", got "${shown}"`]
}

const problemsOf = (expected: Case, got: Intent | null) => {
  if (expected.request === 'other') return got === null || got.request === 'other' ? [] : ['expected no journey, got a trip']
  if (!got || got.request !== 'trip') return ['expected a trip, got none']
  return [...placeProblem('from', expected.from!, got.origin), ...placeProblem('to', expected.to!, got.destination), ...timeProblem(expected.time!, got.time)]
}

const cfg = loadConfig()
if (!cfg.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
const stops = stopDirectory(getJson)
await stops.refresh()
const read = claudeReader({ apiKey: cfg.ANTHROPIC_API_KEY, model: cfg.ASK_MODEL, stopNames: stops.names })
const cases = JSON.parse(readFileSync(new URL('../evals/cases.json', import.meta.url), 'utf8')) as Case[]

const results: { say: string; problems: string[]; ms: number; costUsd: number }[] = []
const queue = [...cases]
const worker = async () => {
  for (let next = queue.shift(); next; next = queue.shift()) {
    const started = Date.now()
    try {
      const { intent, costUsd } = await read(next.say)
      results.push({ say: next.say, problems: problemsOf(next, intent), ms: Date.now() - started, costUsd })
    } catch (problem) {
      results.push({ say: next.say, problems: [`the call failed: ${problem instanceof Error ? problem.name : 'unknown'}`], ms: Date.now() - started, costUsd: 0 })
    }
  }
}
await Promise.all(Array.from({ length: AT_ONCE }, worker))

const wrong = results.filter((result) => result.problems.length)
for (const result of wrong) console.log(`✗ ${result.say}\n${result.problems.map((problem) => `    ${problem}`).join('\n')}`)
const times = results.map((result) => result.ms).sort((a, b) => a - b)
const cost = results.reduce((sum, result) => sum + result.costUsd, 0)
console.log(
  `\n${cfg.ASK_MODEL}: ${results.length - wrong.length} of ${results.length} sentences understood as expected. ` +
    `Time per sentence: median ${times[Math.floor(times.length / 2)]} ms, slowest tenth from ${times[Math.floor(times.length * 0.9)]} ms. ` +
    `Cost: $${cost.toFixed(4)} in all, $${(cost / results.length).toFixed(5)} per sentence.`,
)
