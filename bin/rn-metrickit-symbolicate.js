#!/usr/bin/env node
'use strict';

/**
 * Offline symbolication CLI for react-native-metrickit.
 *
 * @author Qamber Haider <qamb565@gmail.com>
 * @license MIT
 * @see https://github.com/qam12/react-native-metrickit
 *
 * Resolves stack frames in an exported DiagnosticEvent JSON using build
 * artifacts that must never ship to a device:
 *   - iOS:     a matching .dSYM (resolved with `atos`, UUID-checked via `dwarfdump`)
 *   - Android: a native tombstone via `ndk-stack -sym <symbols>`, or an
 *              obfuscated JVM trace via `retrace <mapping.txt>`
 *
 * Runs offline / in CI only. Pure helpers are exported for unit testing; the
 * process entry point runs only when invoked directly.
 *
 * Usage:
 *   rn-metrickit-symbolicate --input event.json --platform ios --dsym App.dSYM
 *   rn-metrickit-symbolicate --input event.json --platform android --symbols obj/local/arm64-v8a
 *   rn-metrickit-symbolicate --input event.json --platform android --mapping mapping.txt
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function fail(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const opts = {
    input: null,
    platform: null,
    dsym: null,
    mapping: null,
    symbols: null,
    arch: 'arm64',
    output: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--input':
      case '-i':
        opts.input = argv[++i];
        break;
      case '--platform':
      case '-p':
        opts.platform = argv[++i];
        break;
      case '--dsym':
        opts.dsym = argv[++i];
        break;
      case '--mapping':
        opts.mapping = argv[++i];
        break;
      case '--symbols':
        opts.symbols = argv[++i];
        break;
      case '--arch':
        opts.arch = argv[++i];
        break;
      case '--output':
      case '-o':
        opts.output = argv[++i];
        break;
      case '--help':
      case '-h':
        opts.help = true;
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }
  return opts;
}

/** Flatten an MXCallStackTree JSON object into an ordered list of frames. */
function flattenFrames(tree) {
  const frames = [];
  const visit = (frame) => {
    if (!frame || typeof frame !== 'object') {
      return;
    }
    frames.push({
      binaryName: frame.binaryName,
      binaryUUID: frame.binaryUUID,
      offset:
        typeof frame.offsetIntoBinaryTextSegment === 'number'
          ? frame.offsetIntoBinaryTextSegment
          : null,
      address: typeof frame.address === 'number' ? frame.address : null,
    });
    if (Array.isArray(frame.subFrames)) {
      frame.subFrames.forEach(visit);
    }
  };
  const stacks = Array.isArray(tree && tree.callStacks) ? tree.callStacks : [];
  for (const stack of stacks) {
    const roots = Array.isArray(stack.callStackRootFrames)
      ? stack.callStackRootFrames
      : [];
    roots.forEach(visit);
  }
  return frames;
}

/** Collect the distinct binary UUIDs referenced by a call-stack tree. */
function extractBinaryUUIDs(tree) {
  return Array.from(
    new Set(
      flattenFrames(tree)
        .map((f) => f.binaryUUID)
        .filter((u) => typeof u === 'string' && u.length > 0)
        .map(normalizeUUID)
    )
  );
}

function normalizeUUID(uuid) {
  return String(uuid).replace(/-/g, '').toUpperCase();
}

/** Parse the call-stack payload, which is stored as a JSON string on the event. */
function parseCallStackTree(callStack) {
  if (callStack == null) {
    return null;
  }
  if (typeof callStack === 'object') {
    return callStack;
  }
  try {
    return JSON.parse(callStack);
  } catch {
    return null;
  }
}

function dwarfBinaryPath(dsymPath) {
  const dwarfDir = path.join(dsymPath, 'Contents', 'Resources', 'DWARF');
  const entries = fs.readdirSync(dwarfDir);
  if (entries.length === 0) {
    throw new Error(`no DWARF binary found in ${dwarfDir}`);
  }
  return path.join(dwarfDir, entries[0]);
}

function dsymUUIDs(dwarfPath) {
  // `dwarfdump --uuid` prints: "UUID: XXXX... (arch) path"
  const out = execFileSync('dwarfdump', ['--uuid', dwarfPath], {
    encoding: 'utf8',
  });
  const uuids = [];
  const re = /UUID:\s*([0-9A-Fa-f-]+)/g;
  let match;
  while ((match = re.exec(out)) !== null) {
    uuids.push(normalizeUUID(match[1]));
  }
  return uuids;
}

function symbolicateIOS(event, opts) {
  if (!opts.dsym) {
    fail('--dsym <App.dSYM> is required for --platform ios');
  }
  if (!fs.existsSync(opts.dsym)) {
    fail(`dSYM not found: ${opts.dsym}`);
  }
  const tree = parseCallStackTree(event.callStack);
  if (!tree) {
    fail('event has no parseable callStack to symbolicate');
  }

  const dwarf = dwarfBinaryPath(opts.dsym);
  const dsymIds = dsymUUIDs(dwarf);
  const eventIds = extractBinaryUUIDs(tree);
  const overlap = eventIds.filter((id) => dsymIds.includes(id));
  if (eventIds.length > 0 && overlap.length === 0) {
    fail(
      `dSYM UUID mismatch: event references ${eventIds.join(', ')} but ` +
        `${path.basename(opts.dsym)} provides ${dsymIds.join(', ')}`
    );
  }

  const frames = flattenFrames(tree);
  const resolved = frames.map((frame) => {
    const value = frame.offset != null ? frame.offset : frame.address;
    if (value == null) {
      return { ...frame, symbol: '<no address>' };
    }
    const hex = '0x' + value.toString(16);
    try {
      const symbol = execFileSync(
        'atos',
        ['-o', dwarf, '-arch', opts.arch, '-l', '0x0', hex],
        { encoding: 'utf8' }
      ).trim();
      return { ...frame, symbol };
    } catch {
      return { ...frame, symbol: `<unresolved ${hex}>` };
    }
  });

  return { ...event, symbolicatedCallStack: resolved };
}

function symbolicateAndroid(event, opts) {
  const trace = typeof event.callStack === 'string' ? event.callStack : '';
  if (!trace) {
    fail('event has no callStack/tombstone to symbolicate');
  }

  if (opts.symbols) {
    if (!fs.existsSync(opts.symbols)) {
      fail(`NDK symbols directory not found: ${opts.symbols}`);
    }
    try {
      const out = execFileSync('ndk-stack', ['-sym', opts.symbols], {
        input: trace,
        encoding: 'utf8',
      });
      return { ...event, symbolicatedCallStack: out };
    } catch (e) {
      fail(`ndk-stack failed: ${e.message}`);
    }
  }

  if (opts.mapping) {
    if (!fs.existsSync(opts.mapping)) {
      fail(`mapping.txt not found: ${opts.mapping}`);
    }
    try {
      const out = execFileSync('retrace', [opts.mapping], {
        input: trace,
        encoding: 'utf8',
      });
      return { ...event, symbolicatedCallStack: out };
    } catch (e) {
      fail(`retrace failed (is it on PATH?): ${e.message}`);
    }
  }

  fail(
    'provide --symbols <ndk-symbols-dir> (native) or --mapping <mapping.txt> (JVM) for --platform android'
  );
  return event;
}

function readEvent(inputPath) {
  if (!inputPath) {
    fail('--input <event.json> is required');
  }
  if (!fs.existsSync(inputPath)) {
    fail(`input not found: ${inputPath}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (e) {
    fail(`could not parse ${inputPath}: ${e.message}`);
  }
  return parsed;
}

const HELP = `rn-metrickit-symbolicate — offline symbolication for react-native-metrickit

  --input, -i     <event.json>   exported DiagnosticEvent (or array) [required]
  --platform, -p  <ios|android>  platform to symbolicate [required]
  --dsym          <App.dSYM>     iOS dSYM bundle
  --symbols       <dir>          Android NDK unstripped symbols dir (native)
  --mapping       <mapping.txt>  Android R8/ProGuard mapping (JVM)
  --arch          <arch>         iOS arch for atos (default arm64)
  --output, -o    <file>         write result JSON here (default stdout)
`;

function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
  } catch (e) {
    fail(e.message);
  }
  if (opts.help) {
    process.stdout.write(HELP);
    return;
  }
  if (opts.platform !== 'ios' && opts.platform !== 'android') {
    fail('--platform must be "ios" or "android"');
  }

  const parsed = readEvent(opts.input);
  const events = Array.isArray(parsed) ? parsed : [parsed];
  const symbolicate =
    opts.platform === 'ios' ? symbolicateIOS : symbolicateAndroid;
  const result = events.map((event) => symbolicate(event, opts));
  const output = JSON.stringify(
    Array.isArray(parsed) ? result : result[0],
    null,
    2
  );

  if (opts.output) {
    fs.writeFileSync(opts.output, output);
    process.stdout.write(`wrote ${opts.output}\n`);
  } else {
    process.stdout.write(output + '\n');
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = {
  parseArgs,
  flattenFrames,
  extractBinaryUUIDs,
  normalizeUUID,
  parseCallStackTree,
  main,
};
