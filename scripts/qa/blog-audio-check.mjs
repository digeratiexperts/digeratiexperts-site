// Fixture-only lifecycle checks. Never calls the paid narration endpoint.
// Run: node scripts/qa/blog-audio-check.mjs
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// QA_EVIDENCE_DIR is a path prefix; never reuse an existing run's evidence.
const evidencePrefix = path.resolve(process.env.QA_EVIDENCE_DIR || path.join(tmpdir(), "de-narration-qa"));
await mkdir(path.dirname(evidencePrefix), { recursive: true, mode: 0o700 });
const evidence = await mkdtemp(`${evidencePrefix}-`);
const bundle = await build({
  stdin: { contents: `import React from 'react';
import { createRoot } from 'react-dom/client';
import { BlogAudioPlayer } from './src/components/BlogAudioPlayer.tsx';
const root = createRoot(document.getElementById('root'));
window.words = [];
window.renderNarration = (text = 'First article. Keep the evidence. Protect backups.') =>
  root.render(React.createElement(BlogAudioPlayer, {title:'Test article', text, wordCount:text.split(/\\s+/).length, onWordChange:i=>window.words.push(i)}));
window.unmountNarration = () => root.unmount();
window.mountSecondNarration = () => {
  const node = document.createElement('div'); node.id = 'second'; document.body.append(node);
  const secondRoot = createRoot(node);
  secondRoot.render(React.createElement(BlogAudioPlayer,{title:'Second article',text:'Second article content.'}));
};
window.renderNarration();`, resolveDir: path.join(root,'client'), sourcefile: 'narration-fixture.tsx', loader:'tsx' },
  bundle:true, write:false, format:'iife', platform:'browser', jsx:'automatic',
  alias:{'@':path.join(root,'client/src')}, define:{'process.env.NODE_ENV':'"production"'},
});
const server = createServer((req,res) => {
  if (req.url === '/fixture.js') { res.setHeader('Content-Type','text/javascript'); res.end(bundle.outputFiles[0].text); }
  else { res.setHeader('Content-Type','text/html'); res.end('<!doctype html><html><head><title>Narration fixture</title></head><body style="background:#050312;color:white;padding:24px"><main id="root"></main><script src="/fixture.js"></script></body></html>'); }
});
await new Promise(resolve => server.listen(4179,'127.0.0.1',resolve));
const channel = process.env.QA_BROWSER_CHANNEL || (process.platform === "win32" ? "msedge" : undefined);
const browser = await chromium.launch({ channel, headless: true });
const results = [];

async function fixture(options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  if (process.env.QA_DEBUG) {
    page.on('request', request => console.log('REQUEST', request.url()));
    page.on('requestfailed', request => console.log('REQUEST FAILED', request.url(), request.failure()));
    page.on('console', msg => console.log('CONSOLE', msg.type(), msg.text()));
  }
  await page.addInitScript((options) => {
    window.fixture = { audios: [], utterances: [], requests: [], voices: [], cancels: 0, resumes: 0, rejectPlay: false, hidden: false, pendingPlays:[], gestures:[], revoked:[], cancelled:[], speaking:null };
    const f = window.fixture;
    const NativeAudio = window.Audio;
    const revoke = URL.revokeObjectURL;
    URL.revokeObjectURL = url => { f.revoked.push(url); revoke.call(URL,url); };
    class FakeAudio extends EventTarget {
      currentTime = 0; duration = 100; playbackRate = 1; paused = true;
      constructor(url) { super(); this.src = url; f.audios.push(this); }
      play() {
        if (f.rejectPlay) return Promise.reject(new DOMException('Gesture required', 'NotAllowedError'));
        if (options.deferPlay) return new Promise(resolve => f.pendingPlays.push(() => { this.paused=false; this.dispatchEvent(new Event('playing')); resolve(); }));
        this.paused = false;
        this.dispatchEvent(new Event('playing'));
        return Promise.resolve();
      }
      pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
      load() {}
      removeAttribute(name) { if (name === 'src') this.src = ''; }
      dispatchEvent(event) { super.dispatchEvent(event); this['on'+event.type]?.(event); return true; }
    }
    window.Audio = options.nativeAudio ? class { constructor(url) { const audio=new NativeAudio(url); f.audios.push(audio); return audio; } } : FakeAudio;
    class FakeUtterance {
      constructor(text) { this.text = text; }
    }
    window.SpeechSynthesisUtterance = FakeUtterance;
    const synth = new EventTarget();
    Object.assign(synth, {
      getVoices: () => f.voices,
      speak: (utterance) => { f.speaking=utterance; f.utterances.push(utterance); f.gestures.push(navigator.userActivation.isActive); },
      cancel: () => { f.cancels++; if(options.cancelEvents && f.speaking) f.cancelled.push(f.speaking); f.speaking=null; },
      pause: () => { synth.paused=true; }, resume: () => { f.resumes++; synth.paused=false; }, speaking: false, pending: false, paused: false,
    });
    Object.defineProperty(window, 'speechSynthesis', { value: options.unsupported ? undefined : synth, configurable: true });
    if (options.unsupported) delete window.SpeechSynthesisUtterance;
    Object.defineProperty(document, 'hidden', { get: () => f.hidden, configurable: true });
    // The local fixture answers TTS; no network or paid generation is possible.
    window.fetch = (url, init) => {
      if (url !== '/api/tts') return Promise.reject(new Error('Unexpected fixture request: ' + url));
      return new Promise((resolve, reject) => {
        const request = { body: JSON.parse(init.body), signal: init.signal,
          respond: (status = 200) => resolve(new Response(status === 200 ? new Blob(['fixture'], {type:'audio/mpeg'}) : JSON.stringify({error:'Unavailable'}), {status})),
          wav: () => { const data=new ArrayBuffer(44+32000*2); const v=new DataView(data); const str=(i,s)=>{for(let j=0;j<s.length;j++)v.setUint8(i+j,s.charCodeAt(j));}; str(0,'RIFF');v.setUint32(4,data.byteLength-8,true);str(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,16000,true);v.setUint32(28,32000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,data.byteLength-44,true);for(let i=0;i<32000;i++)v.setInt16(44+i*2,Math.sin(i*2*Math.PI*320/16000)*1200,true);resolve(new Response(new Blob([data],{type:'audio/wav'}),{status:200})); },
          fail: () => reject(new TypeError('Offline')) };
        f.requests.push(request);
        if (!options.ignoreAbort) init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted','AbortError')));
      });
    };
  }, options);
  await page.goto("http://127.0.0.1:4179/__qa/narration", {waitUntil:'commit'});
  await page.getByTestId("button-audio-play").waitFor();
  return { page, context, errors, play: page.locator('#root').getByTestId("button-audio-play"), stop: page.locator('#root').getByTestId("button-audio-stop") };
}

async function check(name, run, options) {
  const f = await fixture(options);
  try { await run(f); assert.deepEqual(f.errors,[], 'No uncaught browser errors'); results.push({name, passed:true}); }
  catch (error) { results.push({name, passed:false, error:error.message}); }
  finally { await f.context.close(); }
}

async function startTwoDevicePlayers({page,play}) {
  await play.click(); await page.evaluate(() => window.fixture.requests[0].respond(503));
  await page.locator('#root').getByRole('status').waitFor(); await play.click();
  await page.evaluate(() => window.fixture.utterances[0].onstart());
  await page.evaluate(() => window.mountSecondNarration());
  const secondPlay=page.locator('#second').getByTestId('button-audio-play');
  await secondPlay.click(); await page.evaluate(() => window.fixture.requests[1].respond(503));
  await page.locator('#second').getByRole('status').waitFor(); await secondPlay.click();
  await page.evaluate(() => window.fixture.utterances[1].onstart());
  return secondPlay;
}

try {
  await check("Stop cancels loading and rejects late completion", async ({page, play, stop}) => {
    await play.click();
    await page.screenshot({path:path.join(evidence,'loading-390.png')});
    assert.equal(await stop.isEnabled(), true, "Stop must remain available during loading");
    await stop.click();
    await page.evaluate(() => window.fixture.requests[0].respond());
    await page.waitForTimeout(100);
    assert.equal(await play.getAttribute("aria-label"), "Play audio");
    assert.equal(await page.evaluate(() => window.fixture.audios.length), 0);
  }, {ignoreAbort:true});

  await check("Resume rejection stays stopped and visible on phones", async ({page, play}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond());
    await page.waitForFunction(() => document.querySelector('[data-testid="button-audio-play"]').getAttribute('aria-label') === 'Pause audio');
    await play.click();
    await page.evaluate(() => window.fixture.rejectPlay = true);
    await play.click(); await page.waitForTimeout(100);
    assert.equal(await play.getAttribute("aria-label"), "Play audio");
    assert.equal(await page.getByRole("status").isVisible(), true);
  });

  await check("Article content switch cancels current audio", async ({page, play}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond());
    await page.waitForFunction(() => window.fixture.audios.length === 1);
    await page.evaluate(() => window.renderNarration('Extended article has new content.'));
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.fixture.audios[0].paused), true);
    assert.equal(await play.getAttribute("aria-label"), "Play audio");
  });

  await check("Pending play is not reported as playing, and Stop rejects its late resolution", async ({page,play,stop}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond());
    await page.waitForFunction(() => window.fixture.pendingPlays.length === 1);
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
    assert.equal(await play.isDisabled(),true);
    await stop.click(); await page.evaluate(() => window.fixture.pendingPlays[0]());
    await page.waitForTimeout(50);
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
    assert.equal(await page.evaluate(() => window.fixture.audios[0].paused),true);
  },{deferPlay:true});

  await check("Replay failure is caught and does not claim playback", async ({page,play}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond());
    await page.waitForFunction(() => window.fixture.audios.length === 1);
    await page.evaluate(() => { window.fixture.audios[0].dispatchEvent(new Event('ended')); window.fixture.rejectPlay=true; });
    await play.click(); await page.waitForTimeout(50);
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
    assert.match(await page.getByRole('status').textContent(),/blocked/i);
  });

  await check("Blocked first play retries cached media on a fresh tap", async ({page,play}) => {
    await page.evaluate(() => window.fixture.rejectPlay=true);
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond());
    await page.getByRole('status').waitFor();
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
    await page.evaluate(() => window.fixture.rejectPlay=false); await play.click();
    assert.equal(await play.getAttribute('aria-label'),'Pause audio');
    assert.equal(await page.evaluate(() => window.fixture.requests.length),1);
  });

  await check("Buffered stalled media keeps playing; real buffering times out safely", async ({page,play}) => {
    await page.clock.install();
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond());
    await page.waitForFunction(() => window.fixture.audios.length === 1);
    await page.evaluate(() => {const a=window.fixture.audios[0];a.readyState=4;a.dispatchEvent(new Event('stalled'));});
    assert.equal(await play.getAttribute('aria-label'),'Pause audio');
    await page.evaluate(() => {const a=window.fixture.audios[0];a.readyState=2;a.dispatchEvent(new Event('waiting'));});
    assert.equal(await play.isDisabled(),true);
    await page.clock.fastForward(13000);
    assert.equal(await play.isEnabled(),true);
    assert.equal(await page.evaluate(() => window.fixture.audios[0].paused),true);
    assert.match(await page.getByRole('status').textContent(),/stalled.*Tap Play/);
  });

  await check("Decode errors offer device voice without asynchronous speech", async ({page,play}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond());
    await page.waitForFunction(() => window.fixture.audios.length === 1);
    await page.evaluate(() => window.fixture.audios[0].dispatchEvent(new Event('error')));
    await page.getByRole('status').waitFor();
    assert.equal(await page.evaluate(() => window.fixture.utterances.length),0);
    assert.equal(await page.evaluate(() => window.fixture.audios[0].paused),true);
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
  });

  await check("Fallback needs an explicit tap and waits for speech start", async ({page,play}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond(429));
    await page.getByRole('status').waitFor();
    assert.equal(await page.evaluate(() => window.fixture.utterances.length),0,'No silent primer or async speech fallback');
    assert.match(await page.getByRole('status').textContent(),/Tap Play.*device voice/);
    await play.click();
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
    assert.equal(await play.isDisabled(),true);
    assert.equal(await page.evaluate(() => window.fixture.gestures[0]),true);
    await page.evaluate(() => window.fixture.utterances[0].onstart());
    assert.equal(await play.getAttribute('aria-label'),'Pause audio');
  });

  await check("Delayed voices never auto-start speech; next tap picks the loaded voice", async ({page,play,stop}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond(503));
    await page.getByRole('status').waitFor(); await play.click();
    assert.equal(await page.evaluate(() => !!window.fixture.utterances[0].voice),false);
    await stop.click();
    await page.evaluate(() => { window.fixture.voices=[{name:'Google US English',lang:'en-US'}]; window.speechSynthesis.dispatchEvent(new Event('voiceschanged')); });
    assert.equal(await page.evaluate(() => window.fixture.utterances.length),1);
    await play.click();
    assert.equal(await page.evaluate(() => window.fixture.utterances[1].voice.name),'Google US English');
  });

  await check("Silent speech startup times out with a visible retry", async ({page,play}) => {
    await page.clock.install();
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond(503));
    await page.getByRole('status').waitFor(); await play.click();
    await page.clock.fastForward(13000);
    assert.equal(await play.isEnabled(),true);
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
    assert.match(await page.getByRole('status').textContent(),/stalled.*Tap Play/);
  });

  await check("Speech permission, busy and external interruption errors are visible", async ({page,play}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond(503));
    await page.getByRole('status').waitFor();
    for(const error of ['not-allowed','audio-busy','interrupted']) {
      await play.click();
      await page.evaluate(error => window.fixture.utterances.at(-1).onerror({error}),error);
      assert.equal(await play.isEnabled(),true);
      assert.equal(await play.getAttribute('aria-label'),'Play audio');
      assert.match(await page.getByRole('status').textContent(),/failed.*Tap Play/);
    }
  });

  await check("Speech pause and resume follow native events", async ({page,play}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond(503));
    await page.getByRole('status').waitFor(); await play.click();
    await page.evaluate(() => window.fixture.utterances[0].onstart());
    await play.click();
    assert.equal(await play.isDisabled(),true);
    await page.evaluate(() => window.fixture.utterances[0].onpause());
    await play.click();
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
    await page.evaluate(() => window.fixture.utterances[0].onresume());
    assert.equal(await play.getAttribute('aria-label'),'Pause audio');
  });

  await check("Unresponsive native pause times out rather than claiming success", async ({page,play}) => {
    await page.clock.install();
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond(503));
    await page.getByRole('status').waitFor(); await play.click();
    await page.evaluate(() => window.fixture.utterances[0].onstart());
    await play.click(); await page.clock.fastForward(13000);
    assert.equal(await play.isEnabled(),true);
    assert.match(await page.getByRole('status').textContent(),/stalled.*Tap Play/);
    await play.click();
    assert.equal(await page.evaluate(() => window.fixture.resumes),1,'Restart clears the global paused flag left by cancel');
  });

  await check("Stop rejects stale speech events and word highlights", async ({page,play,stop}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond(503));
    await page.getByRole('status').waitFor(); await play.click();
    await stop.click();
    await page.evaluate(() => { const u=window.fixture.utterances[0];u.onstart();u.onboundary({name:'word',charIndex:20});u.onend(); });
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
    assert.equal(await page.evaluate(() => window.words.at(-1)),-1);
  });

  await check("Changing voice cancels a pending request and ignores its late result", async ({page,play}) => {
    await page.setViewportSize({width:1440,height:900});
    await play.click(); await page.getByTestId('select-audio-voice').selectOption('alloy');
    assert.equal(await page.evaluate(() => window.fixture.requests[0].signal.aborted),true);
    await page.evaluate(() => window.fixture.requests[0].respond());
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.fixture.audios.length),0);
    await play.click();
    assert.equal(await page.evaluate(() => window.fixture.requests[1].body.voice),'alloy');
  },{ignoreAbort:true});

  await check("Unmount cancels work and cannot start late audio", async ({page,play}) => {
    await play.click(); await page.evaluate(() => window.unmountNarration());
    await page.evaluate(() => window.fixture.requests[0].respond()); await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.fixture.audios.length),0);
    assert.equal(await page.getByTestId('blog-audio-player').count(),0);
  },{ignoreAbort:true});

  await check("Backgrounding device speech stops it and never auto-resumes", async ({page,play}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond(503));
    await page.getByRole('status').waitFor(); await play.click();
    await page.evaluate(() => { window.fixture.utterances[0].onstart(); window.fixture.hidden=true; document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
    await page.evaluate(() => { window.fixture.hidden=false; document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await page.evaluate(() => window.fixture.utterances.length),1);
    assert.match(await page.getByRole('status').textContent(),/stopped.*Tap Play/);
  });

  await check("Background media continues, and a system pause updates the control", async ({page,play}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond());
    await page.waitForFunction(() => window.fixture.audios.length === 1);
    await page.evaluate(() => { window.fixture.hidden=true; document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await page.evaluate(() => window.fixture.audios[0].paused),false);
    await page.evaluate(() => window.fixture.audios[0].pause());
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
  });

  await check("Pagehide cancels a request and ignores late completion", async ({page,play}) => {
    await play.click(); await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await page.evaluate(() => window.fixture.requests[0].respond()); await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.fixture.audios.length),0);
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
  },{ignoreAbort:true});

  await check("Hidden-page fetch is canceled and cannot auto-start on return", async ({page,play}) => {
    await play.click();
    await page.evaluate(() => {window.fixture.hidden=true;document.dispatchEvent(new Event('visibilitychange'));window.fixture.requests[0].respond();window.fixture.hidden=false;document.dispatchEvent(new Event('visibilitychange'));});
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.fixture.requests[0].signal.aborted),true);
    assert.equal(await page.evaluate(() => window.fixture.audios.length),0);
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
  },{ignoreAbort:true});

  await check("Unsupported speech has a readable fallback without a crash", async ({page,play}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond(503));
    await page.getByRole('status').waitFor();
    assert.match(await page.getByRole('status').textContent(),/unavailable/);
    await play.click();
    assert.equal(await play.getAttribute('aria-label'),'Play audio');
    assert.equal(await page.evaluate(() => window.fixture.utterances.length),0);
  },{unsupported:true});

  await check("Offline and timed-out generation offer a fresh-tap fallback", async ({page,play,stop}) => {
    await page.clock.install();
    await play.click(); await page.evaluate(() => window.fixture.requests[0].fail());
    await page.getByRole('status').waitFor();
    assert.equal(await page.evaluate(() => window.fixture.utterances.length),0);
    // Changing content resets the source and starts a new independent generation attempt.
    await page.evaluate(() => window.renderNarration('Another content version.'));
    await play.click(); await page.clock.fastForward(31000);
    assert.match(await page.getByRole('status').textContent(),/Tap Play.*device/);
    assert.equal(await page.evaluate(() => window.fixture.requests[1].signal.aborted),true);
  });

  await check("Stop retains generated media; content change releases its URL", async ({page,play,stop}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond());
    await page.waitForFunction(() => window.fixture.audios.length === 1);
    await stop.click(); await play.click();
    assert.equal(await page.evaluate(() => window.fixture.requests.length),1);
    await page.evaluate(() => window.renderNarration('Different article text.'));
    await page.waitForTimeout(50);
    assert.equal(await page.evaluate(() => window.fixture.revoked.length),1);
    assert.equal(await page.evaluate(() => window.fixture.audios[0].paused),true);
  });

  await check("Native media time updates map to the article's real word count", async ({page,play}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].respond());
    await page.waitForFunction(() => window.fixture.audios.length === 1);
    await page.evaluate(() => {const audio=window.fixture.audios[0];audio.currentTime=50;audio.dispatchEvent(new Event('timeupdate'));});
    assert.equal(await page.evaluate(() => window.words.at(-1)),3,'Halfway through seven words highlights the fourth word');
  });

  await check("A delayed cancellation error cannot stop a newer player's speech", async f => {
    const secondPlay=await startTwoDevicePlayers(f);
    await f.page.evaluate(() => window.fixture.cancelled[0].onerror({error:'canceled'}));
    assert.equal(await f.page.evaluate(() => window.fixture.speaking===window.fixture.utterances[1]),true);
    assert.equal(await secondPlay.getAttribute('aria-label'),'Pause audio');
  },{cancelEvents:true});

  await check("Old-player unmount before its cancel event cannot stop the current owner", async f => {
    const secondPlay=await startTwoDevicePlayers(f);
    const cancels=await f.page.evaluate(() => window.fixture.cancels);
    await f.page.evaluate(() => {window.unmountNarration();window.fixture.cancelled[0].onerror({error:'canceled'});});
    assert.equal(await f.page.evaluate(() => window.fixture.cancels),cancels);
    assert.equal(await f.page.evaluate(() => window.fixture.speaking===window.fixture.utterances[1]),true);
    assert.equal(await secondPlay.getAttribute('aria-label'),'Pause audio');
  },{cancelEvents:true});

  await check("Replacing speech resets old controls and rejects their stale start/highlight events", async f => {
    const secondPlay=await startTwoDevicePlayers(f);
    assert.equal(await f.play.getAttribute('aria-label'),'Play audio');
    assert.match(await f.page.locator('#root').getByRole('status').textContent(),/replaced.*Tap Play/);
    await f.page.evaluate(() => {const old=window.fixture.utterances[0];old.onstart();old.onresume();old.onpause();old.onboundary({name:'word',charIndex:20});});
    assert.equal(await f.play.getAttribute('aria-label'),'Play audio');
    assert.equal(await secondPlay.getAttribute('aria-label'),'Pause audio');
    assert.equal(await f.page.evaluate(() => window.words.at(-1)),-1);
    // A fresh Play is a deliberate new request, not a stale global pause/resume.
    await f.play.click();
    assert.equal(await secondPlay.getAttribute('aria-label'),'Play audio');
    assert.equal(await f.page.evaluate(() => window.fixture.speaking===window.fixture.utterances[2]),true);
  },{cancelEvents:true});

  await check("Native local media decodes fixture WAV and advances playback time", async ({page,play}) => {
    await play.click(); await page.evaluate(() => window.fixture.requests[0].wav());
    await page.waitForFunction(() => window.fixture.audios.length === 1);
    await page.waitForTimeout(100);
    if(await play.isEnabled() && await play.getAttribute('aria-label') === 'Play audio') await play.click();
    await page.waitForFunction(() => window.fixture.audios[0].currentTime > 0.1);
    assert.equal(await play.getAttribute('aria-label'),'Pause audio');
    await play.click();
    assert.equal(await page.evaluate(() => window.fixture.audios[0].paused),true);
  },{nativeAudio:true});
} finally {
  await writeFile(path.join(evidence, "regression-results.json"), JSON.stringify({browser:{channel:channel || 'chromium', version:browser.version(), platform:process.platform}, audibleDeviceOutputVerified:false, results}, null, 2));
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}${result.error ? ': '+result.error : ''}`);
console.log(`Evidence: ${evidence}`);
if (results.some(r => !r.passed)) process.exitCode = 1;
