/**
 * voiceTranscriber.js
 * 
 * Enterprise Dual-Engine (Hybrid) Voice Architecture:
 * 1. Hardware-level microphone capture via Web Audio API (AudioContext + Analyser).
 * 2. Real-time microphone input volume detection (diagnoses whether the Windows mic is working or muted).
 * 3. Engine A (Browser Web Speech API): Streams live interim words directly to the search bar.
 * 4. Engine B (Gnani AI Cloud STT Fallback): If Chrome or Edge's cloud speech service fails
 *    silently (common on Windows firewalls / ISPs / Windows privacy blocks), the recorded audio
 *    is immediately transcribed by our backend Gnani Prisma v3.0 STT endpoint.
 */

import { getApiUrl } from '../services/api';

/**
 * Encodes raw Float32 audio samples into a standard 16kHz mono 16-bit PCM WAV Blob.
 */
export function encodeWav(audioChunks, sampleRate = 16000) {
  let totalLength = 0;
  for (let i = 0; i < audioChunks.length; i++) {
    totalLength += audioChunks[i].length;
  }
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (let i = 0; i < audioChunks.length; i++) {
    merged.set(audioChunks[i], offset);
    offset += audioChunks[i].length;
  }

  const buffer = new ArrayBuffer(44 + merged.length * 2);
  const view = new DataView(buffer);

  function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + merged.length * 2, true);
  writeString(view, 8, 'WAVE');
  // Subchunk 1 (fmt)
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 1, true); // Mono (1 channel)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate (16000 * 16-bit / 8)
  view.setUint16(32, 2, true); // Block align (1 * 2)
  view.setUint16(34, 16, true); // Bits per sample
  // Subchunk 2 (data)
  writeString(view, 36, 'data');
  view.setUint32(40, merged.length * 2, true);

  // Write PCM 16-bit samples
  let pcmOffset = 44;
  for (let i = 0; i < merged.length; i++, pcmOffset += 2) {
    const s = Math.max(-1, Math.min(1, merged[i]));
    view.setInt16(pcmOffset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

/**
 * Starts a hybrid voice listening session.
 */
export async function startHybridVoiceSession({
  onTranscript,
  onSpeakingChange,
  onMicStatus,
  language = 'en-IN',
}) {
  let stream = null;
  let audioCtx = null;
  let processor = null;
  let recognition = null;
  let isStopped = false;
  let collectedSamples = [];
  let browserTranscript = '';
  let maxVolumeHeard = 0;

  // 1. Acquire Physical Microphone Stream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
  } catch (err) {
    console.error('[ShelfSense Voice] Microphone access denied or not found:', err);
    throw err;
  }

  // 2. Set up Web Audio API for Live Volume & Sample Collection
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass({ sampleRate: 16000 });
    const source = audioCtx.createMediaStreamSource(stream);
    processor = audioCtx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (e) => {
      if (isStopped) return;
      const input = e.inputBuffer.getChannelData(0);
      collectedSamples.push(new Float32Array(input));

      // Calculate Real-Time RMS Volume (Audio Energy)
      let sum = 0;
      for (let i = 0; i < input.length; i++) {
        sum += input[i] * input[i];
      }
      const rms = Math.sqrt(sum / input.length);
      const volumePercent = Math.min(100, Math.round(rms * 400));
      if (volumePercent > maxVolumeHeard) {
        maxVolumeHeard = volumePercent;
      }

      if (volumePercent >= 5) {
        onSpeakingChange?.(true);
      }
    };

    source.connect(processor);
    processor.connect(audioCtx.destination);
  } catch (audioErr) {
    console.warn('[ShelfSense Voice] Web Audio processing fallback:', audioErr);
  }

  // Diagnostics check after 2 seconds: check if physical mic is actually receiving sound
  setTimeout(() => {
    if (!isStopped) {
      if (maxVolumeHeard < 4) {
        console.warn(
          '[ShelfSense Voice] ⚠️ Mic input volume is 0%. Microphone might be muted in Windows Sound Control Panel or browser settings.'
        );
        onMicStatus?.('silent');
      } else {
        console.info(`[ShelfSense Voice] 🎤 Microphone hardware audio active! Peak Level: ${maxVolumeHeard}%`);
        onMicStatus?.('active');
      }
    }
  }, 2200);

  // 3. Engine A: Try Browser Web Speech API in parallel
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    try {
      const rec = new SpeechRecognition();
      // Use continuous=false to prevent Chromium's buffer hang
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = language || 'en-IN';

      rec.onresult = (event) => {
        let current = '';
        for (let i = 0; i < event.results.length; ++i) {
          current += event.results[i][0].transcript;
        }
        const text = current.trim();
        if (text) {
          browserTranscript = text;
          onTranscript?.(text);
          onSpeakingChange?.(true);
        }
      };

      rec.onerror = (e) => {
        console.warn('[ShelfSense Voice] Browser speech recognition notice:', e.error);
      };

      recognition = rec;
      rec.start();
      console.info('[ShelfSense Voice] Engine A (Browser Web Speech) started.');
    } catch (recErr) {
      console.warn('[ShelfSense Voice] Engine A initialization failed:', recErr);
    }
  }

  // 4. Return Session Controller
  return {
    async stop() {
      if (isStopped) return browserTranscript;
      isStopped = true;

      // Stop speech recognition
      if (recognition) {
        try { recognition.abort(); } catch {}
        recognition = null;
      }

      // Stop AudioContext & Streams
      if (processor) {
        try { processor.disconnect(); } catch {}
        processor = null;
      }
      if (audioCtx) {
        try { audioCtx.close(); } catch {}
        audioCtx = null;
      }
      if (stream) {
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch {}
        stream = null;
      }

      // If browser speech recognition already caught words, use them!
      if (browserTranscript.trim()) {
        console.log(`[ShelfSense Voice] ✨ Engine A transcript committed: "${browserTranscript.trim()}"`);
        return browserTranscript.trim();
      }

      // If browser speech recognition returned empty (the Chrome/Edge cloud speech block),
      // fallback to Engine B: Backend Gnani Prisma v3.0 STT with the recorded 16kHz WAV!
      if (collectedSamples.length > 0) {
        console.info('[ShelfSense Voice] 🔄 Engine A returned no words. Fallback: Transcribing via Backend Gnani AI STT...');
        try {
          const wavBlob = encodeWav(collectedSamples, 16000);
          const formData = new FormData();
          formData.append('audio_file', wavBlob, 'recording.wav');
          formData.append('language_code', language || 'en-IN');

          const response = await fetch(getApiUrl('/api/voice/stt'), {
            method: 'POST',
            body: formData,
          });

          if (response.ok) {
            const data = await response.json();
            const gnaniText = (data.transcript || '').trim();
            if (gnaniText) {
              console.log(`[ShelfSense Voice] 🎯 Engine B (Gnani AI) transcript received: "${gnaniText}"`);
              onTranscript?.(gnaniText);
              return gnaniText;
            } else {
              console.warn('[ShelfSense Voice] Gnani STT returned empty transcript (no words detected in audio).');
            }
          } else {
            console.warn('[ShelfSense Voice] Gnani STT endpoint returned status:', response.status);
          }
        } catch (backendErr) {
          console.error('[ShelfSense Voice] Gnani fallback error:', backendErr);
        }
      }

      return browserTranscript.trim();
    },

    abort() {
      isStopped = true;
      if (recognition) {
        try { recognition.abort(); } catch {}
      }
      if (processor) {
        try { processor.disconnect(); } catch {}
      }
      if (audioCtx) {
        try { audioCtx.close(); } catch {}
      }
      if (stream) {
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch {}
      }
    },
  };
}
