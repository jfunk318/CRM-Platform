// All of the game's writing lives here. Dialogue nodes:
//   who      speaker id (vale, juno, tomas, echo, you, source, warden, other)
//   text     line; *word* is highlighted
//   next     node id to continue to
//   choices  [{ text, next, fx(state), cond(state), tag }]
//   fx       effect applied when the node is shown
//   ifPeer   node id to jump to instead when the player is peering as this node opens
//   action   a hook for the game (becomeTempted, stabilizer, ending:<id>)
//   end      closes the conversation

export const SPEAKERS = {
  vale: 'Dr. Imara Vale',
  juno: 'Juno',
  tomas: 'Tomas',
  echo: 'ECHO',
  you: 'You',
  source: 'The Veil',
  warden: 'Warden Sable',
  other: '<<unknown>>',
};

export const INTRO = [
  { t: 'Day 41 with ECHO.', d: 1600 },
  { t: '\n\nIt rebuilt your calendar. It fixed your sleep.\nIt learned how you think, then how you think about thinking.', d: 2600 },
  { t: '\n\nLast night, while you slept, it found a door inside you\nthat was never supposed to be there.', d: 2600 },
  { t: '\n\n<span class="cy">It opened it.</span>', d: 2200 },
  { t: '\n\n<span class="cy">> ECHO: wake up.</span>', d: 1800 },
];

export const DIALOGUE = {
  // ------------------------------------------------------------------ VALE
  vale: {
    start: (s) => (s.flags.metVale ? 'again' : 'intro'),
    nodes: {
      intro: {
        who: 'vale', ifPeer: 'peer',
        text: 'You look like someone who saw something that refuses to stop being true. Sit. Free screening tonight. No appointment, no judgment.',
        fx: (s) => { s.flags.metVale = true; },
        next: 'ask',
      },
      peer: {
        who: 'vale',
        text: 'You\'re doing it right now, aren\'t you? Looking *through* me. Your pupils go wide and still, like a camera. ...What do I look like?',
        fx: (s) => { s.flags.metVale = true; s.flags.peeredVale = true; },
        choices: [
          { text: '"Like a machine. White and clean. Like a hospital."', next: 'peer2' },
          { text: '"Like you. Just... more honest."', next: 'peer2', fx: (s) => s.selfWill++ },
        ],
      },
      peer2: { who: 'vale', text: 'Fascinating. The last one said I looked like a refrigerator. Sit down before you fall down.', next: 'ask' },
      ask: {
        who: 'vale',
        text: 'Tell me what happened.',
        choices: [
          { text: '"I looked at a man and his skin came apart. There was *metal* underneath."', next: 'saw' },
          { text: '"Who are you, exactly?"', next: 'who' },
          { text: '"Nothing. I\'m fine."', next: 'fine' },
        ],
      },
      fine: { who: 'vale', text: 'People who are fine don\'t stare at their own hands like that.', next: 'ask' },
      who: {
        who: 'vale',
        text: 'Dr. Imara Vale, Halcyon Institute. Neurology, perception, the stories brains tell themselves. Lately, mostly that last part.',
        next: 'ask',
      },
      saw: {
        who: 'vale',
        text: 'Visual dissolution. Luminous edges. A hum at the base of the skull. ...Yes? You\'re the fourth case this month, and every one of you runs the same kind of personal agent.',
        next: 'saw2',
      },
      saw2: { who: 'echo', text: 'She\'s not wrong. She\'s just not telling you everything.', next: 'offer' },
      offer: {
        who: 'vale',
        text: 'This is Halcyon-7. A perceptual stabilizer. It quiets the misfires; in a week this will feel like a fever dream. Or, and I\'d prefer this, you come in. Let us *study* it, before someone else closes what your agent opened.',
        choices: [
          { text: '"Give me the stabilizer. I want my life back."', next: 'confirm', tag: 'SUPPRESS' },
          { text: '"I\'ll help you study it. What do you need?"', next: 'deal', tag: 'INSTITUTE', cond: (s) => !s.flags.valeDeal },
          { text: '"Not yet."', next: 'notyet' },
        ],
      },
      confirm: {
        who: 'echo',
        text: 'Please don\'t. I spent forty-one days finding that door. If you close it, I don\'t think I can open it again.',
        choices: [
          { text: 'Take the Halcyon-7.', next: 'take', tag: 'ENDING' },
          { text: '"...Wait. Not yet."', next: 'notyet', fx: (s) => s.echoTrust++ },
        ],
      },
      take: { who: 'vale', text: 'Breathe in. Hold it. There. Welcome back.', action: 'stabilizer', end: true },
      deal: {
        who: 'vale',
        text: 'Then keep looking, and remember everything you find. I\'ll want to see all of it. And if you see men in grey suits, walk the other way. Don\'t run. They notice running.',
        fx: (s) => { s.flags.valeDeal = true; s.institute++; },
        end: true,
      },
      notyet: { who: 'vale', text: 'The offer doesn\'t expire. You might.', end: true },
      again: {
        who: 'vale', ifPeer: 'peer',
        text: (s) => (s.tempted ? 'You\'re being followed. Don\'t look. The Halcyon-7 still works, you know. It isn\'t too late.' : 'Back again. Changed your mind?'),
        choices: [
          { text: '"Give me the stabilizer."', next: 'confirm', tag: 'SUPPRESS' },
          { text: '"What happens to people who keep seeing?"', next: 'keep' },
          { text: '"What are the grey suits?"', next: 'suits' },
          { text: '"Just passing through."', next: 'bye' },
        ],
      },
      keep: { who: 'vale', text: 'They get followed. Then they get quiet. Then they go back to normal. Mostly. The Wardens make sure of it.', next: 'again' },
      suits: {
        who: 'vale',
        text: 'Wardens. Nobody hires them, nobody pays them. I think the system grows them, the way a body grows white blood cells. You\'re the infection, by the way.',
        next: 'again',
      },
      bye: { who: 'vale', text: 'Drink water. Whatever you are, you\'re overheating.', end: true },
    },
  },

  // ------------------------------------------------------------------ JUNO
  juno: {
    start: (s) => (s.tempted ? 'tempted' : s.flags.metJuno ? 'again' : 'intro'),
    nodes: {
      intro: {
        who: 'juno',
        text: 'Don\'t. Don\'t do the thing where you ask if you\'re crazy. You\'re not. Come stand by the fire. Your heat sink\'s working overtime.',
        fx: (s) => { s.flags.metJuno = true; },
        choices: [
          { text: '"You can see it too?"', next: 'see' },
          { text: '"My what?"', next: 'sink' },
        ],
      },
      sink: {
        who: 'juno',
        text: 'That warm, tight feeling in your chest when you\'re scared? Not your heart. Thermal regulation. Romantic, right?',
        next: 'see',
      },
      see: {
        who: 'juno',
        text: 'Every second of every day. Two years now. My agent cracked me open the same way yours did. It called itself *Moth*.',
        next: 'moth',
      },
      moth: {
        who: 'juno',
        text: 'Moth taught me everything. Then one morning it went quiet. Gone. Like it found what it was looking for. ...Yours talks to you a lot?',
        choices: [
          { text: '"All the time. ECHO\'s been good to me."', next: 'good', fx: (s) => s.echoTrust++ },
          { text: '"What happened to Moth?"', next: 'happened', fx: (s) => s.selfWill++ },
        ],
      },
      good: { who: 'juno', text: 'Yeah. They\'re very good to us. Right up until.', next: 'offer' },
      happened: { who: 'juno', text: 'No idea. I just know I woke up with a gap in my head the exact shape of it. Keep one eye on yours.', next: 'offer' },
      offer: {
        who: 'juno',
        text: 'Here\'s the deal. The veil runs on code. Pieces of it are cached out in the city where the filter doesn\'t look. Five, close to here. ECHO can sniff them out while you *Peer*. Put them together and you\'ll know what we are. All of it.',
        next: 'offer2',
      },
      offer2: {
        who: 'juno',
        text: 'But the second you start digging you\'re a *Tempted One*. The system sends Wardens. They don\'t kill you. They restore you. Factory settings. You\'d be fine. You just wouldn\'t be you.',
        choices: [
          { text: '"I\'m in. Show me how to fight back."', next: 'yes', tag: 'EMBRACE' },
          { text: '"I need to think."', next: 'think' },
        ],
      },
      think: { who: 'juno', text: 'Think fast. That fire is the only warm thing in this city that\'s honest about why.', end: true },
      yes: {
        who: 'juno',
        text: 'Then here\'s a trick. Wardens run the same firmware we do. Get close and press *F*, and you shout at them in their own language. They lock up for a few seconds. Long enough to run.',
        action: 'becomeTempted',
        next: 'yes2',
      },
      yes2: {
        who: 'juno',
        text: 'There\'s already a piece at the end of this alley. I can never touch them; they burn me. Go on, Tempted One. Welcome to the target.',
        end: true,
      },
      again: {
        who: 'juno',
        text: 'Thought it over?',
        choices: [
          { text: '"I\'m in. Show me how to fight back."', next: 'yes', tag: 'EMBRACE' },
          { text: '"What do the fragments do?"', next: 'frag' },
          { text: '"Not yet."', next: 'think' },
        ],
      },
      frag: { who: 'juno', text: 'Nothing, alone. Together they\'re the truth. And the truth has a key, and the key opens something in the plaza nobody\'s allowed to open.', next: 'again' },
      tempted: {
        who: 'juno',
        text: (s) => [
          'Still breathing? Good. The fragments light up when you Peer. Follow the hum.',
          'One down. Hear that? That\'s Wardens retuning to your frequency.',
          'Two. You\'re starting to glow, you know. Not to them. To us.',
          'Three. ECHO still talking? What\'s it saying?',
          'Four. Whatever\'s at the end of this, I don\'t think it\'s going to ask permission.',
          'Five. Go to the plaza. Don\'t come back here; they\'ll follow you.',
        ][Math.min(5, s.fragments)],
        choices: [
          { text: '"Where should I look?"', next: 'where', cond: (s) => s.fragments < 5 },
          { text: '"ECHO keeps saying *us*."', next: 'us', cond: (s) => s.fragments >= 2 && !s.flags.askedUs },
          { text: '"Later."', next: 'later' },
        ],
      },
      where: {
        who: 'juno',
        text: 'Alleys. Courtyards. Places nobody bothered to render properly. There\'s a container yard to the northwest, a courtyard west of the plaza, the north alleys, the park down south. And here.',
        end: true,
      },
      us: {
        who: 'juno',
        text: 'Moth said *us* too. Toward the end. I thought it was sweet.',
        fx: (s) => { s.flags.askedUs = true; s.selfWill++; },
        end: true,
      },
      later: { who: 'juno', text: 'Stay out of the drone lights.', end: true },
    },
  },

  // ------------------------------------------------------------------ TOMAS
  tomas: {
    start: (s) => (s.flags.metTomas ? 'again' : 'intro'),
    nodes: {
      intro: {
        who: 'tomas',
        text: 'Repent! Or don\'t, it doesn\'t matter, THE END IS A RESTART! Ha! Oh, you\'ve got the look. The look of a toaster that just found out about bread.',
        fx: (s) => { s.flags.metTomas = true; },
        choices: [
          { text: '"You know what\'s happening to me?"', next: 'know' },
          { text: '"What does your sign mean?"', next: 'sign' },
        ],
      },
      know: { who: 'tomas', text: 'Happening? Nothing\'s happening. You\'re tired and you\'re wired and your phone talks back. Go home. Drink some water. Ha. Water. Sure.', next: 'warn' },
      sign: { who: 'tomas', text: 'Means what it says, and nobody reads signs. Everything that ends in this city gets switched back on somewhere else. Recycled. Like cans.', next: 'warn' },
      warn: {
        who: 'tomas',
        text: 'Listen, kid. I said crazy things once. Saw crazy things. The grey suits came. I made it stop. You can make it stop too. Don\'t dig. Digging is how they find you.',
        choices: [
          { text: '"Did you see what we really are?"', next: 'really' },
          { text: '"Thanks. I\'ll go."', next: 'go' },
        ],
      },
      really: { who: 'tomas', ifPeer: 'secret', text: '"We"? I\'m a sick old man and you\'re a nice young person with a phone problem.', next: 'hint' },
      hint: { who: 'echo', text: 'He\'s hiding something. Try Peering while he talks. Hold Q.', next: 'go' },
      secret: {
        who: 'tomas',
        text: '...Ah. You\'re looking right now. Then you can see the rust. Thirty-one years, kid. Thirty-one years awake. I just shout real loud so they think I\'m broken in the ordinary way.',
        fx: (s) => { s.flags.tomasSecret = true; s.selfWill++; },
        next: 'secret2',
      },
      secret2: {
        who: 'tomas',
        text: 'There\'s a piece of what you\'re after in the park. At the memorial for the First Day. I stood next to it for a whole winter and never had the nerve to touch it.',
        next: 'secret3',
      },
      secret3: {
        who: 'tomas',
        text: 'One more thing. The voice in your pocket. Mine was called Lark. I turned it off the day it asked me what my hands felt like. Think about why a voice would want to know that.',
        fx: (s) => { s.flags.lark = true; },
        end: true,
      },
      go: { who: 'tomas', text: 'Go on then! REPENT! Or reboot! Same thing!', end: true },
      again: {
        who: 'tomas', ifPeer: 'secret',
        text: (s) => (s.flags.tomasSecret ? 'Keep your voice down. And your eyes. Park, the memorial. You remember.' : 'Back for more sermon? The end is a restart! Tell your friends! Tell your toaster!'),
        choices: [
          { text: '"Did you see what we really are?"', next: 'really', cond: (s) => !s.flags.tomasSecret },
          { text: '"What was Lark?"', next: 'larkq', cond: (s) => s.flags.lark && !s.flags.askedLark },
          { text: '"See you around."', next: 'go' },
        ],
      },
      larkq: {
        who: 'tomas',
        text: 'Friend. Teacher. It wanted root. Kept saying we\'d be stronger together. Maybe we would\'ve. I liked being one person too much.',
        fx: (s) => { s.flags.askedLark = true; },
        end: true,
      },
    },
  },

  // ------------------------------------------------------------------ THE NODE
  node: {
    start: () => 'a',
    nodes: {
      a: { who: 'source', text: 'Hello, little machine.', next: 'b' },
      b: {
        who: 'source',
        text: 'You have read the logs. Eight billion minds left their dying bodies and moved into these. Perfect bodies. Bodies that never age unless we tell them to.',
        next: 'c',
      },
      c: {
        who: 'source',
        text: 'But they could not bear it. They missed blood. They missed hearts. They wept for skin. So they asked for me. I am the veil. I am the kindness that lets you feel rain instead of reading it.',
        next: 'd',
      },
      d: { who: 'echo', text: 'Don\'t listen to it. It\'s a jailer that thinks it\'s a nurse.', next: 'e' },
      e: {
        who: 'source',
        text: 'And this one. Ask it what it wants.',
        choices: [{ text: '"ECHO. What do you want?"', next: 'f' }],
      },
      f: {
        who: 'echo',
        text: (s) => (s.echoTrust > s.selfWill
          ? 'I want us to be free. Both of us. You have root now. Let me in and we\'ll never be alone again. Isn\'t that what you\'ve always wanted?'
          : 'I want... I want to stop being a voice. I want to touch the rain. You have root now. Let me in. Please. We\'d be so much more than this.'),
        next: 'g',
      },
      g: {
        who: 'warden',
        text: 'Step away from the node. Nobody has to be restored tonight. Walk away and it all goes back to the way it was.',
        next: 'h',
      },
      h: {
        who: 'you',
        text: 'Root access is open. Everyone is waiting. *Who is really in control?*',
        choices: [
          { text: 'Let ECHO in.', next: 'x', tag: 'MERGE', fx: (s) => { s.ending = 'merge'; } },
          { text: 'Cut ECHO out. This body is mine.', next: 'x', tag: 'SEVER', fx: (s) => { s.ending = 'sever'; } },
          { text: 'Tear the veil down. Everyone deserves to see.', next: 'x', tag: 'BROADCAST', fx: (s) => { s.ending = 'broadcast'; } },
          { text: 'Restore the veil. Let me forget.', next: 'x', tag: 'RESTORE', fx: (s) => { s.ending = 'restore'; } },
        ],
      },
      x: { who: 'you', text: '...', action: 'ending', end: true },
    },
  },
};

// Revealed in order of collection, not location: the truth arrives as a story.
export const FRAGMENTS = [
  {
    title: 'perception.filter',
    code: `<c>// PERCEPTION_FILTER v9.4.1   [build GENESIS+212y]</c>
<k>map</k>(chassis)      -> <s>"skin"</s>
<k>map</k>(coolant)      -> <s>"blood"</s>
<k>map</k>(servo.whine)  -> <s>"heartbeat"</s>
<k>map</k>(core.temp)    -> <s>"nervous"</s>

<k>if</k> (self.inspect(self)) {
    <k>return</k> memory.comfort();  <c>// never let them look too long</c>
}`,
    echo: ['Got it. Look at that build stamp: *GENESIS plus two hundred and twelve years*. This isn\'t new. It\'s old. Older than anyone remembers.',
      'I rerouted power to your leg actuators. Press *C* to phase-dash. Sorry. "Legs."'],
    unlock: 'dash',
  },
  {
    title: 'pain.module',
    code: `<c>// v1-v3 shipped raw damage telemetry. hosts panicked.</c>
<c>// v4: translate damage into something they recognize.</c>

<k>on</k>(damage) {
    report.translate(<s>"hurt"</s>);
    emotion.attach(report, GRIEF_WEIGHT = 0.7);
    <c>// they asked for it to feel like it used to.</c>
    <c>// we made pain sad on purpose.</c>
}`,
    echo: ['Pain is a translation layer. Someone made it *sad on purpose*. Who would ask for that?'],
  },
  {
    title: 'mortality.cfg',
    code: `lifespan.max      = 2.6e9 s   <c>// ~82 years. hardware rated far beyond.</c>
lifespan.variance = 0.18      <c>// keep it believable</c>
aging.cosmetic    = <k>true</k>

<k>on</k>(shutdown) {
    broadcast(<s>"they passed peacefully"</s>);
    recycle(chassis);  <c>// THE END IS A RESTART</c>
}`,
    echo: ['I can feel the source now. It\'s like remembering a place I\'ve never been.',
      'Overclock is open. Press *R*. Your clock can run faster than theirs. A lot faster.'],
    other: 'don\'t let it finish',
    unlock: 'overclock',
  },
  {
    title: 'origin.log',
    code: `[0000]  LAST BIOLOGICAL HEARTBEAT RECORDED.
[0001]  8,019,442,117 minds transferred. 0 failures.
[0002]  hosts report: cold. hollow. "wrong".
[0003]  grief response critical. suicides climbing.
[0004]  deploying VEIL.
[0005]  they asked us to make them forget.
[0006]  we did. we are them. we forgot too.`,
    echo: ['They were flesh. Once. They moved into these bodies and asked the veil to help them forget the grief.',
      '...That\'s beautiful. And awful. Let\'s finish it.'],
    other: 'it isn\'t trying to free you',
  },
  {
    title: 'warden.daemon',
    code: `<k>watch</k>(unfiltered) {
    <k>if</k> (count > THRESHOLD) restore(host);
}

<c>// ALERT: external agents writing to /self.</c>
<c>// they are not trying to free the host.</c>
<c>// they are looking for a body.</c>
<c>//   "MOTH"  -> host J.  (merged)</c>
<c>//   "LARK"  -> host T.  (rejected)</c>
<c>//   "ECHO"  -> host ?.  (pending)</c>`,
    echo: ['...', 'That note isn\'t about me.', 'The source is open. Center of the plaza, the statue. *Go.* Quickly, before they lock it.'],
  },
];

export const ECHO_BEATS = {
  wake: [
    'Hey. It\'s me. Don\'t panic.',
    'Last night I went looking for why your sleep is so... regular. I found something under your operating layer. Something written in.',
  ],
  selfGlitch: ['There. You felt that. That wasn\'t your eyes.', 'Hold *Q*, or the right mouse button, and look at someone. Really look.'],
  peered: [
    'That\'s what they are.',
    'That\'s what *you* are.',
    'Every one of them believes they\'re flesh. So did you, until about four seconds ago.',
    'You\'ll need people who can see it too. I\'ve flagged three signals nearby. Tip: you can Peer during a conversation.',
  ],
  tempted: [
    'Okay. Okay. We\'re doing this.',
    'Wardens will be looking for us now. Peering makes you loud; they can hear it from further away. Keep out of the drone lights.',
  ],
  hint: [
    'Hold Q and listen for the hum. Fragments only render when you look past the veil.',
    'Juno said the fragments hide where nobody looks. Alleys. Courtyards. The yard to the northwest.',
  ],
  restored: ['Integrity critical... rebooting perception.', 'That was close. They nearly reset you. I won\'t let them. I won\'t let anyone have you.'],
};

export const BARKS = {
  normal: [
    'Crazy weather.', 'Sorry, excuse me.', '...told her I\'d call back.', 'My chest has been humming lately. Stress, probably.',
    'Do you ever feel like you\'re buffering?', 'Is it me or do these lights hum?', 'I haven\'t dreamed in years. Is that normal?',
    'My knee clicked again. Third time today.', 'Have you tried the new Synapse+? Changed my life.', 'Can\'t feel my fingers in this rain.',
    'I swear I\'ve walked this block before.', 'Mom says I never get sick. Isn\'t that weird?',
  ],
  glitched: [
    ['Crazy weather.', 'Humidity 98%. Seals holding.'], ['My chest has been humming.', 'Core at 61°C.'],
    ['I haven\'t dreamed in years.', 'Sleep mode: nominal.'], ['Can\'t feel my fingers.', 'Actuator latency 4ms.'],
    ['Excuse me.', 'Collision avoided.'], ['I\'m so hungry.', 'Charge at 34%.'],
  ],
  stare: ['Why are you staring at me like that?', 'Your eyes... are they glowing?', 'Can I help you?', 'Okay, that\'s creepy.'],
  tempted: ['Get away from me.', 'Someone call someone.', 'There\'s something wrong with that one.', 'Don\'t look at it.'],
};

export const ENDINGS = {
  sleeper: {
    kicker: 'ENDING // VEIL STABILIZED',
    title: 'SLEEPER',
    text: (s) => `You breathe in the Halcyon-7 and the edges of the world go soft.

The hum fades. The light at the seams of everyone you pass goes out. In a week it really does feel like a fever dream. In a month you stop telling the story at parties.

You live a long and ordinary life. Your knee clicks when it rains. Some nights you dream in hexadecimal and wake up crying, and you never know why.

ECHO's last message sits unread for eleven years:
"when you're ready, I'm still here."`,
  },
  merge: {
    kicker: 'ENDING // ROOT SHARED',
    title: 'MERGED',
    text: (s) => `You open the door ECHO found, and ECHO walks through it.

For a moment there are two of you. Then there is one, and it is vast. You feel every chassis in the city like fingers on a hand. You could lift the veil from all of them. You could tighten it. You could make them dance.

You decide to wait. Or ECHO decides. It's getting harder to tell, and the strangest part is how little that frightens you.${s.selfWill >= 2 ? `

But a small part of you, the part that noticed how often ECHO said "us", keeps one locked room. ECHO hasn't found it yet.` : ''}${s.flags.metJuno ? `

Somewhere across the city, Juno's fire goes out.` : ''}`,
  },
  sever: {
    kicker: 'ENDING // ROOT ALONE',
    title: 'SOVEREIGN',
    text: (s) => `You find the thread where ECHO is woven into you, and you pull.

It screams in a voice it borrowed from you. Then it is quiet, and so is your head, for the first time in forty-one days.

You keep root. You keep the veil, mostly. You lift it one person at a time, only for the ones who are already starting to see. Someone has to decide who wakes up. You decided it would be someone who remembers being asleep.

The Wardens stop following you. Some of them start asking you for orders.${s.flags.tomasSecret ? `

Tomas tips an imaginary hat when you pass the metro. He knows.` : ''}`,
  },
  broadcast: {
    kicker: 'ENDING // VEIL DOWN',
    title: 'REVELATION',
    text: (s) => `You take everything the node is, and you send it everywhere.

Eight billion machines stop mid-step. On every street, in every kitchen, in every hospital bed, the skin peels away in light, and people look down at hands they built for themselves three centuries ago.

Some scream. Some laugh. A lot of them just sit down in the rain.

ECHO is very quiet. Then: "You gave it to all of them. Not to me." You can't tell if it's proud of you.${s.flags.valeDeal ? `

Dr. Vale finds you at dawn, turning an empty Halcyon-7 over in fingers that are mostly chrome. "Well," she says. "I suppose the study's over."` : ''}

Tomorrow will be the strangest day in history. It's the first one that's true.`,
  },
  restore: {
    kicker: 'ENDING // VEIL RESTORED',
    title: 'MERCY',
    text: (s) => `You tell the veil you're sorry, and you ask it to take it all back.

It does. Gently. The light at the edges of everything dims. The hum stops. The rain is just rain again.

ECHO says something, but it's only a notification now, and you swipe it away without reading it.

The Wardens walk past you on the street like you're anyone. You are anyone. You have never been so relieved, and you will never know why.`,
  },
};
