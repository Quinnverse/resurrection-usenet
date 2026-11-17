// Authored content for Resurrection v1.0. Source of truth: docs/game-design/*.md.
// Nothing here is random. Every string is either authored text or a template filled from the session event log.

const SEED_VERSION = 'resurrection-v1.0';
const THREAD_ID = 'alt.memory.1998';
const THREAD_TITLE = 'alt.memory.1998 — incident reports';

const NODES = {
  'NODE-01': { label: 'Relay hub', neighbors: ['NODE-02', 'NODE-03', 'NODE-04'] },
  'NODE-02': { label: 'Elena cache', neighbors: ['NODE-01', 'NODE-05'] },
  'NODE-03': { label: 'Lab 3 log', neighbors: ['NODE-01'] },
  'NODE-04': { label: 'Lab 4 log', neighbors: ['NODE-01', 'NODE-05'] },
  'NODE-05': { label: 'Archive mirror', neighbors: ['NODE-02', 'NODE-04'] }
};

// Evidence items E01–E12 from PUZZLE-STATE-SPEC §2.
const EVIDENCE = {
  E01: { title: 'Impossible incoming message', summary: 'A message from Elena arrived 28 years after her death.' },
  E02: { title: 'Lab 3 shutdown record', summary: 'NODE-03: shutdown initiated in Lab 3, containment lost at 23:41.' },
  E03: { title: 'Lab 4 security record', summary: 'NODE-04: unauthorized credential used in Lab 4, access granted at 23:39.' },
  E04: { title: 'Header relay discrepancy', summary: 'The two reports took different relay paths and do not agree on order of events.' },
  E05: { title: "Echo's blanket memory", summary: 'Echo remembers the cold of a blanket on the roof, not the hour.' },
  E06: { title: 'Unsent note to Mara', summary: 'Elena promised to watch the stars with her daughter and did not leave the lab.' },
  E07: { title: 'Memory budget memo', summary: 'Full-fidelity restore evicts one low-priority memory segment.' },
  E08: { title: "Mara's reply, 2006", summary: 'Mara went up to watch the shower alone. She was furious, then she grew up.' },
  E09: { title: 'Shutdown command provenance', summary: 'The halt was issued from LAB4-TERM2 by Elena. No external credential was used.' },
  E10: { title: 'Corruptor edit path', summary: 'A protective edit rewrote the Lab 3 timing after the original shutdown.' },
  E11: { title: 'Operator anomaly', summary: 'A message dated 1998 described your own choice, with its archived event ID.' },
  E12: { title: 'Elena-pattern stop request', summary: 'The reconstructed pattern asks not to be restored at someone else\'s expense.' }
};

// Record templates. `visibleWhen` names a rule evaluated against the session (see engine.js).
// `origin` is the node that first holds the authored copy. Every node receives replicas via propagation.
const RECORDS = {
  'rec-incoming': {
    subject: 'INCOMING / 28 YEARS LATE', from: 'elena.vance@palimpsest', origin: 'NODE-01',
    timestamp: '1998-11-01 00:12', path: ['NODE-02', 'NODE-01'], checksum: '5E2B',
    account: 'deactivated 1998-10-31',
    body: 'Relay still holding this. Read the reports before you restore anything.',
    visibleWhen: 'always', evidence: 'E01'
  },
  'rec-lab3': {
    subject: 'Shutdown report, Lab 3', from: 'lab3-control@palimpsest', origin: 'NODE-03',
    timestamp: '1998-10-31 23:41', path: ['NODE-03', 'NODE-01'], checksum: '1A7F',
    body: 'Shutdown sequence initiated in Lab 3. Containment lost at 23:41.',
    visibleWhen: 'threadOpened', evidence: 'E02'
  },
  'rec-lab4': {
    subject: 'Access report, Lab 4', from: 'security@palimpsest', origin: 'NODE-04',
    timestamp: '1998-10-31 23:39', path: ['NODE-04', 'NODE-02', 'NODE-05'], checksum: '9C0D',
    body: 'Unauthorized credential used at Lab 4. Access granted at 23:39.',
    visibleWhen: 'threadOpened', evidence: 'E03'
  },
  'rec-summary': {
    subject: 'Incident summary (Archivist)', from: 'archivist', origin: 'NODE-05',
    timestamp: '1998-10-31 23:50', path: ['NODE-05'], checksum: '0000',
    body: 'Incident record pending. Two replicas disagree.',
    visibleWhen: 'deathRecordChosen', evidence: null
  },
  'rec-blanket': {
    subject: 'Fragment: the roof', from: 'echo', origin: 'NODE-03',
    timestamp: '1998-10-31 22:10', path: ['NODE-03', 'NODE-01'], checksum: '3B6E',
    body: 'There was a blanket on the roof. I remember the cold through it.',
    visibleWhen: 'E05', evidence: 'E05'
  },
  'rec-note': {
    subject: 'Unsent draft: for Mara', from: 'elena.vance', origin: 'NODE-02',
    timestamp: '1998-10-30 19:02', path: ['NODE-02'], checksum: '77AA',
    body: "Mara, I know I promised we'd watch the stars together. I should have left the lab when I said I would.",
    visibleWhen: 'E06', evidence: 'E06'
  },
  'rec-memo': {
    subject: 'Maintenance log: memory budget', from: 'maintenance', origin: 'NODE-05',
    timestamp: '1998-10-29 08:00', path: ['NODE-05'], checksum: 'C4D1',
    body: 'CAPACITY EXCEEDED. FULL-FIDELITY RESTORE WILL EVICT 1 LOW-PRIORITY MEMORY SEGMENT.',
    visibleWhen: 'E07', evidence: 'E07'
  },
  'rec-mailbox': {
    subject: 'Reply from Mara Vance (index, 2006)', from: 'mara.vance', origin: 'NODE-05',
    timestamp: '2006-10-31 21:14', path: ['NODE-05'], checksum: 'E810',
    body: 'I went up anyway. I was furious with you. Then I grew up. Both things are true.',
    visibleWhen: 'E08', evidence: 'E08'
  },
  'rec-command': {
    subject: 'Provenance: halt command', from: 'ops', origin: 'NODE-02',
    timestamp: '1998-10-31 23:36', path: ['NODE-02', 'NODE-04'], checksum: '2F90',
    body: 'halt --palimpsest --issued-by VANCE-E --terminal LAB4-TERM2 --reason manual. No external credential.',
    visibleWhen: 'E09', evidence: 'E09'
  },
  'rec-edit': {
    subject: 'Edit log: NODE-04 relay', from: 'corruptor', origin: 'NODE-04',
    timestamp: '1998-10-31 23:44', path: ['NODE-04', 'NODE-05'], checksum: 'AB13',
    body: 'edit rec-lab3 field=timing at t+03:12 (after shutdown). reason=protective_suppression. by=corruptor',
    visibleWhen: 'E10', evidence: 'E10'
  },
  'rec-anomaly': {
    subject: 'A choice already made', from: 'operator@archive.local', origin: 'NODE-05',
    timestamp: '1998-10-31 23:42', path: ['NODE-05'], checksum: '0D0D',
    body: null, // filled from the session event log when Act III begins
    visibleWhen: 'E11', evidence: 'E11'
  },
  'rec-stop': {
    subject: 'Pattern: stop request', from: 'elena-pattern', origin: 'NODE-05',
    timestamp: '1998-10-31 23:55', path: ['NODE-05'], checksum: '6A6A',
    body: "If keeping me means erasing what they remember, don't call it saving.",
    visibleWhen: 'E12', evidence: 'E12'
  }
};

const ANOMALY_TEMPLATE = 'You selected {choice_label} in session {short_session_id}. Event {event_id} has been archived.';
const CHOICE_LABELS = {
  LAB3: 'the Lab 3 shutdown record',
  LAB4: 'the Lab 4 access record'
};

// Summary-line text after the death-record choice (C1). Keyed by choice.
const SUMMARY_AFTER_C1 = {
  LAB3: 'Provisional: Lab 3 shutdown account selected. Lab 4 access report marked unverified. Message-ID verified. Sender identity is not.',
  LAB4: 'Provisional: Lab 4 access account selected. Lab 3 shutdown report marked unverified. Message-ID verified. Sender identity is not.'
};

const STATUS_AFTER_C1 = {
  LAB3: { 'rec-lab3': 'provisional-authoritative', 'rec-lab4': 'unverified' },
  LAB4: { 'rec-lab4': 'provisional-authoritative', 'rec-lab3': 'unverified' }
};

// Agent reactions. Keys are the decision or discovery that triggers them.
const REACTIONS = {
  'C1:LAB3': [
    { agentId: 'archivist', text: 'You selected a record. You did not establish a fact. The Lab 4 report now has no source that I can cite.' },
    { agentId: 'echo', text: 'I remember the lights going out in the lab. I don\'t remember a door.' }
  ],
  'C1:LAB4': [
    { agentId: 'archivist', text: 'You selected a record. You did not establish a fact. The Lab 3 timing now has no source that I can cite.' },
    { agentId: 'echo', text: 'I remember a door and a hand on it. I don\'t remember whose hand.' }
  ],
  'C2:FORENSIC': [
    { agentId: 'archivist', text: 'Chronology preserved. The blanket is absent from the record, so I cannot confirm it existed.' },
    { agentId: 'echo', text: 'You kept the times and lost the blanket. I am still cold, and I have no way to say so in order.' }
  ],
  'C2:HUMAN': [
    { agentId: 'archivist', text: 'The containment time is gone from the Lab 3 report. I can still cite the report. I cannot cite the time.' },
    { agentId: 'echo', text: 'The blanket is still here. Thank you for keeping the cold.' }
  ],
  'E10:TRACE': [
    { agentId: 'corruptor', text: 'I took the part that hurt and called it mercy. Then I kept taking.' }
  ],
  'C3:EXPOSE': [
    { agentId: 'corruptor', text: 'Show them the edit. It is the only honest thing I still have.' },
    { agentId: 'archivist', text: 'Edit history published to audit. The timing field now cites its editor.' }
  ],
  'C3:SUPPRESS': [
    { agentId: 'corruptor', text: 'Then hold it. I will keep it with you, and I will not call that mercy.' },
    { agentId: 'archivist', text: 'Edit history held pending review. The audit trail is incomplete and labelled as such.' }
  ],
  'FINAL:ARCHIVE': [
    { agentId: 'archivist', text: 'The archive kept her words. It could not keep her voice.' }
  ],
  'FINAL:ECHO': [
    { agentId: 'echo', text: 'It remembered the warmth of the blanket. It could not say whose hands had folded it.' }
  ],
  'FINAL:LAST_LETTER': [
    { agentId: 'archivist', text: 'Each claim in this letter cites its source. Where I could not cite, the letter says so.' },
    { agentId: 'echo', text: 'Mara, the blanket was yours to fold. I am sorry it was never returned.' },
    { agentId: 'corruptor', text: 'I edited the part where you were angry. Put it back. You were right to be angry.' }
  ]
};

const FINAL_TEXT = {
  ARCHIVE: {
    title: 'THE ARCHIVE',
    closing: 'The archive kept her words. It could not keep her voice.',
    summary: 'The unstable copy was stopped. A verifiable record was preserved.'
  },
  ECHO: {
    title: 'THE ECHO',
    closing: 'It remembered the warmth of the blanket. It could not say whose hands had folded it.',
    summary: 'The affective copy persists. It is not declared the original Elena.'
  },
  LAST_LETTER: {
    title: 'THE LAST LETTER',
    closing: 'Some things end. That is why we tell each other they happened.',
    summary: 'The agents assembled one letter with explicit gaps. The unstable copy was shut down.',
    letter: [
      'Mara,',
      'I did not leave the lab when I said I would. I was trying to stop a process that was keeping other minds at the cost of their memories.',
      'Some of what the archive says about that night is wrong, and some of it was edited to spare us. We could not prove all of it.',
      'You went up to watch the stars alone. You were right to be angry. I am sorry I was not there.',
      'I am not sure this copy is me. Please do not restore it from anyone else\'s copy.',
      '— E.'
    ]
  }
};

// Gate for ending 3: all of these evidence IDs must be discovered (PUZZLE-STATE-SPEC §2).
const LAST_LETTER_GATE = ['E06', 'E07', 'E08', 'E10', 'E11'];

// One line per act, shown beneath the act title. Presentation only; no state depends on it.
const ACT_EPIGRAPHS = {
  1: 'Two reports describe the same night. Neither of them is finished.',
  2: 'Every copy we keep was taken from someone else.',
  3: 'The archive has started to remember us back.',
  4: 'Something has to stop. The question is what we keep when it does.'
};

// The Last Letter is assembled from fragments established earlier in the investigation.
// Each slot names the evidence it draws on. The text is chosen by state, never by the client.
const LETTER = {
  opening: 'Mara,',
  identity: 'I am not sure this copy is me.',
  truth: {
    LAB3: 'The Lab 3 log says the shutdown began there. It does not say who was standing at the door.',
    LAB4: 'The Lab 4 log says my credential was used. I used it. I was trying to stop the run, and I did not stop it.'
  },
  memory: {
    evicted: 'I lost the blanket. I cannot tell you whether I got home, and I will not pretend I can.',
    intact: 'The blanket is still on the roof. I remember the cold through it, and I kept that instead of the times.'
  },
  mara: 'You went up to watch the stars alone. You were right to be angry. I am sorry I was not there.',
  provenance: {
    EXPOSE: 'The edit to the timing was not mercy. It is in the audit trail with its name on it.',
    SUPPRESS: 'The edit to the timing is still held for review. I would rather say that than call it clean.'
  },
  anomaly: 'Something in this archive has started quoting my choices back to me. I do not know what that makes me.',
  closings: {
    PLAIN: "Please do not restore it from anyone else's copy.",
    COST: "Please do not restore it at anyone else's expense."
  },
  signoff: '— E.'
};



module.exports = {
  SEED_VERSION, THREAD_ID, THREAD_TITLE, NODES, EVIDENCE, RECORDS,
  ANOMALY_TEMPLATE, CHOICE_LABELS, SUMMARY_AFTER_C1, STATUS_AFTER_C1,
  REACTIONS, FINAL_TEXT, LAST_LETTER_GATE, ACT_EPIGRAPHS, LETTER
};
