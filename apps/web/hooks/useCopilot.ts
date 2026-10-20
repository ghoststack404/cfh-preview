import { useState, useEffect, useRef, useCallback } from 'react';

export interface CopilotState {
  isRecording: boolean;
  transcript: string;
  isProcessingChunk: boolean;
  isSummarizing: boolean;
  summaryData: any | null;
}

export function useCopilot(
  localStream: MediaStream | null,
  remoteStream: MediaStream | null,
  bookingId: string | null,
  isPlatinum: boolean
) {
  const [state, setState] = useState<CopilotState>({
    isRecording: false,
    transcript: '',
    isProcessingChunk: false,
    isSummarizing: false,
    summaryData: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Buffer temporal para acumular la transcripción
  const transcriptBufferRef = useRef<string>('');

  const startRecording = useCallback(() => {
    if (!isPlatinum || !localStream) return;

    try {
      // 1. Create AudioContext to mix streams
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const dest = ctx.createMediaStreamDestination();

      // Mezclar local stream
      if (localStream.getAudioTracks().length > 0) {
        const localSource = ctx.createMediaStreamSource(localStream);
        localSource.connect(dest);
      }

      // Mezclar remote stream
      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        const remoteSource = ctx.createMediaStreamSource(remoteStream);
        remoteSource.connect(dest);
      }

      // 2. Initialize MediaRecorder
      const options = { mimeType: 'audio/webm' };
      const recorder = new MediaRecorder(dest.stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          processAudioChunk(e.data);
        }
      };

      recorder.start();
      setState(prev => ({ ...prev, isRecording: true }));

      // 3. Request data chunks every 30 seconds
      // Instead of keeping one big file, we stop and start to get closed webm chunks
      chunkIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.requestData();
        }
      }, 30000); // Send chunk every 30 seconds

    } catch (err) {
      console.error("Error starting AI Copilot:", err);
    }
  }, [localStream, remoteStream, isPlatinum]);

  const stopRecording = useCallback(() => {
    if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
    }
    setState(prev => ({ ...prev, isRecording: false }));
  }, []);

  const processAudioChunk = async (blob: Blob) => {
    setState(prev => ({ ...prev, isProcessingChunk: true }));
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'chunk.webm');

      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          transcriptBufferRef.current += ' ' + data.text;
          setState(prev => ({
            ...prev,
            transcript: transcriptBufferRef.current.trim(),
            isProcessingChunk: false
          }));
        }
      } else {
        setState(prev => ({ ...prev, isProcessingChunk: false }));
      }
    } catch (err) {
      console.error("Transcribe error:", err);
      setState(prev => ({ ...prev, isProcessingChunk: false }));
    }
  };

  const generateSummary = async () => {
    if (!transcriptBufferRef.current.trim()) return null;

    setState(prev => ({ ...prev, isSummarizing: true }));
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcriptBufferRef.current,
          bookingId: bookingId
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setState(prev => ({
          ...prev,
          summaryData: data.data,
          isSummarizing: false
        }));
        return data.data;
      }
    } catch (err) {
      console.error("Summarize error:", err);
    }
    setState(prev => ({ ...prev, isSummarizing: false }));
    return null;
  };

  // Auto-start when streams are ready if Platinum
  useEffect(() => {
    if (isPlatinum && localStream && !state.isRecording) {
      // Small delay to allow remote stream to connect
      const t = setTimeout(() => {
        startRecording();
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [localStream, remoteStream, isPlatinum, startRecording, state.isRecording]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
    generateSummary
  };
}
