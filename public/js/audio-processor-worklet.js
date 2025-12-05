// AudioWorklet processor for capturing and processing audio chunks
// This replaces the deprecated ScriptProcessorNode

class AudioProcessorWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;

    // Listen for messages from the main thread
    this.port.onmessage = (event) => {
      if (event.data.type === 'start') {
        this.isRecording = true;
      } else if (event.data.type === 'stop') {
        this.isRecording = false;
      }
    };
  }

  process(inputs, outputs, parameters) {
    // Only process if recording
    if (!this.isRecording) {
      return true; // Keep processor alive
    }

    const input = inputs[0];
    if (input.length > 0) {
      const inputChannel = input[0]; // Get first channel (mono)

      if (inputChannel && inputChannel.length > 0) {
        // Convert Float32Array to Int16Array (PCM format)
        const int16Array = new Int16Array(inputChannel.length);
        for (let i = 0; i < inputChannel.length; i++) {
          // Clamp and convert to 16-bit integer
          const s = Math.max(-1, Math.min(1, inputChannel[i]));
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        // Send audio data back to main thread
        this.port.postMessage(
          {
            type: 'audioData',
            data: int16Array.buffer,
          },
          [int16Array.buffer]
        );
      }
    }

    return true; // Keep processor alive
  }
}

// Register the processor
registerProcessor('audio-processor-worklet', AudioProcessorWorklet);
